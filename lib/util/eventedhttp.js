'use strict';

var debug = require('debug')('EventedHTTPServer');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var net = require('net');
var http = require('http');
var uuid = require('./uuid');
var bufferShim = require('buffer-shims');

module.exports = {
  EventedHTTPServer: EventedHTTPServer
};


/**
 * EventedHTTPServer provides an HTTP-like server that supports HAP "extensions" for security and events.
 *
 * Implementation
 * --------------
 * In order to implement the "custom HTTP" server required by the HAP protocol (see HAPServer.js) without completely
 * reinventing the wheel, we create both a generic TCP socket server as well as a standard Node HTTP server.
 * The TCP socket server acts as a proxy, allowing users of this class to transform data (for encryption) as necessary
 * and passing through bytes directly to the HTTP server for processing. This way we get Node to do all
 * the "heavy lifting" of HTTP like parsing headers and formatting responses.
 *
 * Events are sent by simply waiting for current HTTP traffic to subside and then sending a custom response packet
 * directly down the wire via the socket.
 *
 * Each connection to the main TCP server gets its own internal HTTP server, so we can track ongoing requests/responses
 * for safe event insertion.
 *
 * @event 'listening' => function() { }
 *        Emitted when the server is fully set up and ready to receive connections.
 *
 * @event 'request' => function(request, response, session, events) { }
 *        Just like the 'http' module, request is http.IncomingMessage and response is http.ServerResponse.
 *        The 'session' param is an arbitrary object that you can use to store data associated with this connection;
 *        it will not be used by this class. The 'events' param is an object where the keys are the names of
 *        events that this connection has signed up for. It is initially empty and listeners are expected to manage it.
 *
 * @event 'decrypt' => function(data, {decrypted.data}, session) { }
 *        Fired when we receive data from the client device. You may detemine whether the data is encrypted, and if
 *        so, you can decrypt the data and store it into a new 'data' property of the 'decrypted' argument. If data is not
 *        encrypted, you can simply leave 'data' as null and the original data will be passed through as-is.
 *
 * @event 'encrypt' => function(data, {encrypted.data}, session) { }
 *        Fired when we wish to send data to the client device. If necessary, set the 'data' property of the
 *        'encrypted' argument to be the encrypted data and it will be sent instead.
 */

function EventedHTTPServer() {
  this._tcpServer = net.createServer();
  this._connections = []; // track all open connections (for sending events)
}

inherits(EventedHTTPServer, EventEmitter);

EventedHTTPServer.prototype.listen = function(targetPort) {
  this._tcpServer.listen(targetPort);

  this._tcpServer.on('listening', function() {
    var port = this._tcpServer.address().port;
    debug("Server listening on port %s", port);
    this.emit('listening', port);
  }.bind(this));

  this._tcpServer.on('connection', this._onConnection.bind(this));
}

EventedHTTPServer.prototype.stop = function() {
  this._tcpServer.close();
  this._connections = [];
}

EventedHTTPServer.prototype.sendEvent = function(event, data, contentType, exclude) {
  for (var index in this._connections) {
    var connection = this._connections[index];
    connection.sendEvent(event, data, contentType, exclude);
  }
}

// Called by net.Server when a new client connects. We will set up a new EventedHTTPServerConnection to manage the
// lifetime of this connection.
EventedHTTPServer.prototype._onConnection = function(socket) {
  var connection = new EventedHTTPServerConnection(socket);

  // pass on session events to our listeners directly
  connection.on('request', function(request, response, session, events) { this.emit('request', request, response, session, events); }.bind(this));
  connection.on('encrypt', function(data, encrypted, session) { this.emit('encrypt', data, encrypted, session); }.bind(this));
  connection.on('decrypt', function(data, decrypted, session) { this.emit('decrypt', data, decrypted, session); }.bind(this));
  connection.on('close', function() { this._handleConnectionClose(connection); }.bind(this));
  this._connections.push(connection);
}

EventedHTTPServer.prototype._handleConnectionClose = function(connection) {
  this.emit('session-close', connection.sessionID);

  // remove it from our array of connections for events
  this._connections.splice(this._connections.indexOf(connection), 1);
}


/**
 * Manages a single iOS-initiated HTTP connection during its lifetime.
 *
 * @event 'request' => function(request, response) { }
 * @event 'decrypt' => function(data, {decrypted.data}, session) { }
 * @event 'encrypt' => function(data, {encrypted.data}, session) { }
 * @event 'close' => function() { }
 */

function EventedHTTPServerConnection(clientSocket) {
  this.sessionID = uuid.generate(clientSocket.remoteAddress + ':' + clientSocket.remotePort);

  this._remoteAddress = clientSocket.remoteAddress; // cache because it becomes undefined in 'onClientSocketClose'
  this._pendingClientSocketData = bufferShim.alloc(0); // data received from client before HTTP proxy is fully setup
  this._fullySetup = false; // true when we are finished establishing connections
  this._writingResponse = false; // true while we are composing an HTTP response (so events can wait)
  this._pendingEventData = bufferShim.alloc(0); // event data waiting to be sent until after an in-progress HTTP response is being written

  // clientSocket is the socket connected to the actual iOS device
  this._clientSocket = clientSocket;
  this._clientSocket.on('data', this._onClientSocketData.bind(this));
  this._clientSocket.on('close', this._onClientSocketClose.bind(this));
  this._clientSocket.on('error', this._onClientSocketError.bind(this)); // we MUST register for this event, otherwise the error will bubble up to the top and crash the node process entirely.

  // serverSocket is our connection to our own internal httpServer
  this._serverSocket = null; // created after httpServer 'listening' event

  // create our internal HTTP server for this connection that we will proxy data to and from
  this._httpServer = http.createServer();

  this._httpServer.timeout = 0; // clients expect to hold connections open as long as they want
  this._httpServer.keepAliveTimeout = 0; // workaround for https://github.com/nodejs/node/issues/13391
  this._httpServer.on('listening', this._onHttpServerListening.bind(this));
  this._httpServer.on('request', this._onHttpServerRequest.bind(this));
  this._httpServer.on('error', this._onHttpServerError.bind(this));
  this._httpServer.listen(0);

  // an arbitrary dict that users of this class can store values in to associate with this particular connection
  this._session = {
    sessionID: this.sessionID
  };

  // a collection of event names subscribed to by this connection
  this._events = {}; // this._events[eventName] = true (value is arbitrary, but must be truthy)

  debug("[%s] New connection from client", this._remoteAddress);
}

inherits(EventedHTTPServerConnection, EventEmitter);

EventedHTTPServerConnection.prototype.sendEvent = function(event, data, contentType, excludeEvents) {

  // has this connection subscribed to the given event? if not, nothing to do!
  if (!this._events[event]) {
    return;
  }

  // does this connection's 'events' object match the excludeEvents object? if so, don't send the event.
  if (excludeEvents === this._events) {
    debug("[%s] Muting event '%s' notification for this connection since it originated here.", this._remoteAddress, event);
    return;
  }

  debug("[%s] Sending HTTP event '%s' with data: %s", this._remoteAddress, event, data.toString('utf8'));

  // ensure data is a Buffer
  data = bufferShim.from(data);

  // format this payload as an HTTP response
  var linebreak = bufferShim.from("0D0A","hex");
  data = Buffer.concat([
    bufferShim.from('EVENT/1.0 200 OK'), linebreak,
    bufferShim.from('Content-Type: ' + contentType), linebreak,
    bufferShim.from('Content-Length: ' + data.length), linebreak,
    linebreak,
    data
  ]);

  // give listeners an opportunity to encrypt this data before sending it to the client
  var encrypted = { data: null };
  this.emit('encrypt', data, encrypted, this._session);
  if (encrypted.data) data = encrypted.data;

  // if we're in the middle of writing an HTTP response already, put this event in the queue for when
  // we're done. otherwise send it immediately.
  if (this._writingResponse)
    this._pendingEventData = Buffer.concat([this._pendingEventData, data]);
  else
    this._clientSocket.write(data);
}

EventedHTTPServerConnection.prototype._sendPendingEvents = function() {

  // an existing HTTP response was finished, so let's flush our pending event buffer if necessary!
  if (this._pendingEventData.length > 0) {
    debug("[%s] Writing pending HTTP event data", this._remoteAddress);
    this._clientSocket.write(this._pendingEventData);
  }

  // clear the buffer
  this._pendingEventData = bufferShim.alloc(0);
}

// Called only once right after constructor finishes
EventedHTTPServerConnection.prototype._onHttpServerListening = function() {
  this._httpPort = this._httpServer.address().port;
  debug("[%s] HTTP server listening on port %s", this._remoteAddress, this._httpPort);

  // closes before this are due to retrying listening, which don't need to be handled
  this._httpServer.on('close', this._onHttpServerClose.bind(this));

  // now we can establish a connection to this running HTTP server for proxying data
  this._serverSocket = net.createConnection(this._httpPort);
  this._serverSocket.on('connect', this._onServerSocketConnect.bind(this));
  this._serverSocket.on('data', this._onServerSocketData.bind(this));
  this._serverSocket.on('close', this._onServerSocketClose.bind(this));
  this._serverSocket.on('error', this._onServerSocketError.bind(this)); // we MUST register for this event, otherwise the error will bubble up to the top and crash the node process entirely.
}

// Called only once right after onHttpServerListening
EventedHTTPServerConnection.prototype._onServerSocketConnect = function() {

  // we are now fully set up:
  //  - clientSocket is connected to the iOS device
  //  - serverSocket is connected to the httpServer
  //  - ready to proxy data!
  this._fullySetup = true;

  // start by flushing any pending buffered data received from the client while we were setting up
  if (this._pendingClientSocketData.length > 0) {
    this._serverSocket.write(this._pendingClientSocketData);
    this._pendingClientSocketData = null;
  }
}

// Received data from client (iOS)
EventedHTTPServerConnection.prototype._onClientSocketData = function(data) {

  // give listeners an opportunity to decrypt this data before processing it as HTTP
  var decrypted = { data: null };
  this.emit('decrypt', data, decrypted, this._session);
  if (decrypted.data) data = decrypted.data;

  if (this._fullySetup) {
    // proxy it along to the HTTP server
    this._serverSocket.write(data);
  }
  else {
    // we're not setup yet, so add this data to our buffer
    this._pendingClientSocketData = Buffer.concat([this._pendingClientSocketData, data]);
  }
}

// Received data from HTTP Server
EventedHTTPServerConnection.prototype._onServerSocketData = function(data) {

  // give listeners an opportunity to encrypt this data before sending it to the client
  var encrypted = { data: null };
  this.emit('encrypt', data, encrypted, this._session);
  if (encrypted.data) data = encrypted.data;

  // proxy it along to the client (iOS)
  this._clientSocket.write(data);
}

// Our internal HTTP Server has been closed (happens after we call this._httpServer.close() below)
EventedHTTPServerConnection.prototype._onServerSocketClose = function() {
  debug("[%s] HTTP connection was closed", this._remoteAddress);

  // make sure the iOS side is closed as well
  this._clientSocket.destroy();

  // we only support a single long-lived connection to our internal HTTP server. Since it's closed,
  // we'll need to shut it down entirely.
  this._httpServer.close();
}

// Our internal HTTP Server has been closed (happens after we call this._httpServer.close() below)
EventedHTTPServerConnection.prototype._onServerSocketError = function(err) {
  debug("[%s] HTTP connection error: ", this._remoteAddress, err.message);

  // _onServerSocketClose will be called next
}

EventedHTTPServerConnection.prototype._onHttpServerRequest = function(request, response) {
  debug("[%s] HTTP request: %s", this._remoteAddress, request.url);

  this._writingResponse = true;

  // sign up to know when the response is ended, so we can safely send EVENT responses
  response.on('finish', function() {

    debug("[%s] HTTP Response is finished", this._remoteAddress);
    this._writingResponse = false;
    this._sendPendingEvents();

  }.bind(this));

  // pass it along to listeners
  this.emit('request', request, response, this._session, this._events);
}

EventedHTTPServerConnection.prototype._onHttpServerClose = function() {
  debug("[%s] HTTP server was closed", this._remoteAddress);

  // notify listeners that we are completely closed
  this.emit('close');
}

EventedHTTPServerConnection.prototype._onHttpServerError = function(err) {
  debug("[%s] HTTP server error: %s", this._remoteAddress, err.message);

  if (err.code === 'EADDRINUSE') {
    this._httpServer.close();
    this._httpServer.listen(0);
  }
}

EventedHTTPServerConnection.prototype._onClientSocketClose = function() {
  debug("[%s] Client connection closed", this._remoteAddress);

  // shutdown the other side
  this._serverSocket.destroy();
}

EventedHTTPServerConnection.prototype._onClientSocketError = function(err) {
  debug("[%s] Client connection error: %s", this._remoteAddress, err.message);

  // _onClientSocketClose will be called next
}
