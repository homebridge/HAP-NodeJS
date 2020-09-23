import { getNetAddress } from "@homebridge/ciao/lib/util/domain-formatter";
import createDebug from 'debug';
import { SrpServer } from "fast-srp-hap";
import http, { IncomingMessage, OutgoingMessage, ServerResponse } from 'http';
import net, { AddressInfo, Socket } from 'net';
import os from "os";
import { Nullable, SessionIdentifier } from '../../types';
import { EventEmitter } from '../EventEmitter';
import { HAPEncryption } from '../HAPServer';
import * as uuid from './uuid';

const debug = createDebug('HAP-NodeJS:EventedHTTPServer');

export const enum EventedHTTPServerEvents {
  LISTENING = 'listening',
  REQUEST = 'request',
  DECRYPT = 'decrypt',
  ENCRYPT = 'encrypt',
  CLOSE = 'close',
  SESSION_CLOSE = 'session-close',
}

export type Events = {
  [EventedHTTPServerEvents.LISTENING]: (port: number, hostname: string) => void;
  [EventedHTTPServerEvents.REQUEST]: (request: IncomingMessage, response: ServerResponse, session: Session, events: any) => void;
  [EventedHTTPServerEvents.DECRYPT]: (data: Buffer, decrypted: { data: Buffer; error: Error | null }, session: Session) => void;
  [EventedHTTPServerEvents.ENCRYPT]: (data: Buffer, encrypted: { data: number | Buffer; }, session: Session) => void;
  [EventedHTTPServerEvents.CLOSE]: (events: any) => void;
  [EventedHTTPServerEvents.SESSION_CLOSE]: (sessionID: SessionIdentifier, events: any) => void;
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
 *        Fired when we receive data from the client device. You may determine whether the data is encrypted, and if
 *        so, you can decrypt the data and store it into a new 'data' property of the 'decrypted' argument. If data is not
 *        encrypted, you can simply leave 'data' as null and the original data will be passed through as-is.
 *
 * @event 'encrypt' => function(data, {encrypted.data}, session) { }
 *        Fired when we wish to send data to the client device. If necessary, set the 'data' property of the
 *        'encrypted' argument to be the encrypted data and it will be sent instead.
 */
export class EventedHTTPServer extends EventEmitter<Events> {

  _tcpServer: net.Server;
  _connections: EventedHTTPServerConnection[];

  /**
   * Session dictionary indexed by username/identifier. The username uniquely identifies every person added to the home.
   * So there can be multiple sessions open for a single username (multiple devices connected to the same Apple ID).
   */
  sessions: Record<string, Session[]> = {};

  constructor() {
    super();
    this._tcpServer = net.createServer();
    this._connections = []; // track all open connections (for sending events)
  }

  listen = (targetPort: number, hostname?: string) => {
    this._tcpServer.listen(targetPort, hostname);

    this._tcpServer.on('listening', () => {
      const address = this._tcpServer.address();

      if (address && typeof address !== 'string') {
        const hostname = address.address;
        const port = address.port;

        debug("Server listening on %s:%s", address.family === "IPv6"? `[${hostname}]`: hostname, port);
        this.emit(EventedHTTPServerEvents.LISTENING, port, hostname);
      }

    });

    this._tcpServer.on('connection', this._onConnection);
  }

  stop = () => {
    this._tcpServer.close();
    this._connections.forEach((connection) => {
      connection.close();
    });
    this._connections = [];
  }

  sendEvent = (
    event: string,
    data: Buffer | string,
    contentType: string,
    exclude?: Record<string, boolean>
  ) => {
    for (const connection of this._connections) {
      connection.sendEvent(event, data, contentType, exclude);
    }
  }

// Called by net.Server when a new client connects. We will set up a new EventedHTTPServerConnection to manage the
// lifetime of this connection.
  _onConnection = (socket: Socket) => {
    const connection = new EventedHTTPServerConnection(this, socket);

    // pass on session events to our listeners directly
    connection.on(EventedHTTPServerEvents.REQUEST, (request: IncomingMessage, response: ServerResponse, session: Session, events: any) => { this.emit(EventedHTTPServerEvents.REQUEST, request, response, session, events); });
    connection.on(EventedHTTPServerEvents.ENCRYPT, (data: Buffer, encrypted: { data: Buffer; }, session: Session) => { this.emit(EventedHTTPServerEvents.ENCRYPT, data, encrypted, session); });
    connection.on(EventedHTTPServerEvents.DECRYPT, (data: Buffer, decrypted: { data: number | Buffer; }, session: Session) => { this.emit(EventedHTTPServerEvents.DECRYPT, data, decrypted, session); });
    connection.on(EventedHTTPServerEvents.CLOSE, (events: any) => { this._handleConnectionClose(connection, events); });
    this._connections.push(connection);
  }

  _handleConnectionClose = (
    connection: EventedHTTPServerConnection,
    events: Record<string, boolean>
  ) => {
    this.emit(EventedHTTPServerEvents.SESSION_CLOSE, connection.sessionID, events);

    // remove it from our array of connections for events
    this._connections.splice(this._connections.indexOf(connection), 1);
  }
}

export const enum HAPSessionEvents {
  CLOSED = "closed",
}

export type HAPSessionEventMap = {
  [HAPSessionEvents.CLOSED]: () => void;
}

export class Session extends EventEmitter<HAPSessionEventMap> {

  readonly _server: EventedHTTPServer;
  readonly _connection: EventedHTTPServerConnection;
  /*
    Session dictionary indexed by sessionID. SessionID is a custom generated id by HAP-NodeJS unique to every open connection.
    SessionID gets passed to get/set handlers for characteristics. We mainly need this dictionary in order
    to access the sharedSecret in the HAPEncryption object from the SetupDataStreamTransport characteristic set handler.
   */
  private static sessionsBySessionID: Record<SessionIdentifier, Session> = {};

  sessionID: SessionIdentifier; // uuid unique to every HAP connection
  _pairSetupState?: number;
  srpServer?: SrpServer;
  _pairVerifyState?: number;
  encryption?: HAPEncryption;
  authenticated = false;
  username?: string; // username is unique to every user in the home

  timedWritePid?: number;
  timedWriteTimeout?: NodeJS.Timeout;

  constructor(connection: EventedHTTPServerConnection) {
    super();
    this._server = connection.server;
    this._connection = connection;
    this.sessionID = connection.sessionID;

    Session.sessionsBySessionID[this.sessionID] = this;
  }

  public getLocalAddress(ipVersion: "ipv4" | "ipv6"): string {
    const infos = os.networkInterfaces()[this._connection.networkInterface];

    if (ipVersion === "ipv4") {
      for (const info of infos) {
        if (info.family === "IPv4") {
          return info.address;
        }
      }

      throw new Error("Could not find " + ipVersion + " address for interface " + this._connection.networkInterface);
    } else {
      let localUniqueAddress: string | undefined = undefined;

      for (const info of infos) {
        if (info.family === "IPv6") {
          if (!info.scopeid) {
            return info.address;
          } else if (!localUniqueAddress) {
            localUniqueAddress = info.address;
          }
        }
      }

      if (!localUniqueAddress) {
        throw new Error("Could not find " + ipVersion + " address for interface " + this._connection.networkInterface);
      }
      return localUniqueAddress;
    }
  }

  /**
   * establishSession gets called after a pair verify.
   * establishSession does not get called after the first pairing gets added, as any HomeKit controller will initiate a
   * pair verify after the pair setup procedure.
   */
  establishSession = (username: string) => {
    this.authenticated = true;
    this.username = username;

    let sessions: Session[] = this._server.sessions[username];
    if (!sessions) {
      sessions = [];
      this._server.sessions[username] = sessions;
    }

    if (sessions.includes(this)) {
      return; // ensure this doesn't get added more than one time
    }

    sessions.push(this);
  };

  // called when socket of this session is destroyed
  _connectionDestroyed = () => {
    delete Session.sessionsBySessionID[this.sessionID];

    if (this.username) {
      const sessions: Session[] = this._server.sessions[this.username];
      if (sessions) {
        const index = sessions.indexOf(this);
        if (index >= 0) {
          sessions[index].authenticated = false;
          sessions.splice(index, 1);
        }
        if (!sessions.length) delete this._server.sessions[this.username];
      }
    }

    this.emit(HAPSessionEvents.CLOSED);
  };

  static destroyExistingConnectionsAfterUnpair = (initiator: Session, username: string) => {
    const sessions: Session[] = initiator._server.sessions[username];

    if (sessions) {
      sessions.forEach(session => {
        session.authenticated = false;
        if (initiator.sessionID === session.sessionID) {
          // the session which initiated the unpair removed it's own username, wait until the unpair request is finished
          // until we kill his connection
          session._connection._killSocketAfterWrite = true;
        } else {
          // as HomeKit requires it, destroy any active session which got unpaired
          session._connection._clientSocket.destroy();
        }
      });
    }
  };

  static getSession(sessionID: SessionIdentifier) {
    return this.sessionsBySessionID[sessionID];
  }

}

/**
 * Manages a single iOS-initiated HTTP connection during its lifetime.
 *
 * @event 'request' => function(request, response) { }
 * @event 'decrypt' => function(data, {decrypted.data}, session) { }
 * @event 'encrypt' => function(data, {encrypted.data}, session) { }
 * @event 'close' => function() { }
 */
class EventedHTTPServerConnection extends EventEmitter<Events> {

  readonly server: EventedHTTPServer;
  readonly sessionID: SessionIdentifier;
  readonly _remoteAddress: string;
  readonly networkInterface: string;
  _pendingClientSocketData: Nullable<Buffer>;
  _fullySetup: boolean;
  _writingResponse: boolean;
  _killSocketAfterWrite: boolean;
  _pendingEventData: Buffer[];
  _clientSocket: Socket;
  _httpServer: http.Server;
  _serverSocket: Nullable<Socket>;
  _session: Session;
  _events: Record<string, boolean>;
  _httpPort?: number;

  constructor(server: EventedHTTPServer, clientSocket: Socket) {
    super();

    this.server = server;
    this.sessionID = uuid.generate(clientSocket.remoteAddress + ':' + clientSocket.remotePort);
    this._remoteAddress = clientSocket.remoteAddress!; // cache because it becomes undefined in 'onClientSocketClose'
    this.networkInterface = EventedHTTPServerConnection.getLocalNetworkInterface(clientSocket);
    this._pendingClientSocketData = Buffer.alloc(0); // data received from client before HTTP proxy is fully setup
    this._fullySetup = false; // true when we are finished establishing connections
    this._writingResponse = false; // true while we are composing an HTTP response (so events can wait)
    this._killSocketAfterWrite = false;
    this._pendingEventData = []; // queue of unencrypted event data waiting to be sent until after an in-progress HTTP response is being written
    // clientSocket is the socket connected to the actual iOS device
    this._clientSocket = clientSocket;
    this._clientSocket.on('data', this._onClientSocketData);
    this._clientSocket.on('close', this._onClientSocketClose);
    this._clientSocket.on('error', this._onClientSocketError); // we MUST register for this event, otherwise the error will bubble up to the top and crash the node process entirely.
    this._clientSocket.setNoDelay(true); // disable Nagle algorithm
    this._clientSocket.setKeepAlive(true);

    // serverSocket is our connection to our own internal httpServer
    this._serverSocket = null; // created after httpServer 'listening' event
    // create our internal HTTP server for this connection that we will proxy data to and from
    this._httpServer = http.createServer();
    this._httpServer.timeout = 0; // clients expect to hold connections open as long as they want
    this._httpServer.keepAliveTimeout = 0; // workaround for https://github.com/nodejs/node/issues/13391
    this._httpServer.on('listening', this._onHttpServerListening);
    this._httpServer.on('request', this._onHttpServerRequest);
    this._httpServer.on('error', this._onHttpServerError);
    this._httpServer.listen(0);
    // an arbitrary dict that users of this class can store values in to associate with this particular connection
    this._session = new Session(this);
    // a collection of event names subscribed to by this connection
    this._events = {}; // this._events[eventName] = true (value is arbitrary, but must be truthy)
    debug("[%s] New connection from client at interface %s", this._remoteAddress, this.networkInterface);
  }

  sendEvent = (event: string, data: Buffer | string, contentType: string, excludeEvents?: Record<string, boolean>) => {
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
    if (typeof data === 'string') {
      data = Buffer.from(data);
    }
    // format this payload as an HTTP response
    const linebreak = Buffer.from("0D0A", "hex");
    data = Buffer.concat([
      Buffer.from('EVENT/1.0 200 OK'), linebreak,
      Buffer.from('Content-Type: ' + contentType), linebreak,
      Buffer.from('Content-Length: ' + data.length), linebreak,
      linebreak,
      data
    ]);

    // if we're in the middle of writing an HTTP response already, put this event in the queue for when
    // we're done. otherwise send it immediately.
    if (this._writingResponse) {
      this._pendingEventData.push(data);
    } else {
      // give listeners an opportunity to encrypt this data before sending it to the client
      const encrypted = {data: null};
      this.emit(EventedHTTPServerEvents.ENCRYPT, data, encrypted, this._session);
      if (encrypted.data) {
        // @ts-ignore
        data = encrypted.data as Buffer;
      }

      this._clientSocket.write(data);
    }
  }

  close = () => {
    this._clientSocket.end();
  }

  _sendPendingEvents = () => {
    if (this._pendingEventData.length === 0) {
      return;
    }

    // an existing HTTP response was finished, so let's flush our pending event buffer if necessary!
    debug("[%s] Writing pending HTTP event data", this._remoteAddress);
    this._pendingEventData.forEach(event => {
      const encrypted = {data: null};
      this.emit(EventedHTTPServerEvents.ENCRYPT, event, encrypted, this._session);
      if (encrypted.data) {
        // @ts-ignore
        event = encrypted.data as Buffer;
      }

      this._clientSocket.write(event);
    });

    // clear the queue
    this._pendingEventData = [];
  }

  // Called only once right after constructor finishes
  _onHttpServerListening = () => {
    this._httpPort = (this._httpServer.address() as AddressInfo).port;
    debug("[%s] HTTP server listening on port %s", this._remoteAddress, this._httpPort);
    // closes before this are due to retrying listening, which don't need to be handled
    this._httpServer.on('close', this._onHttpServerClose);
    // now we can establish a connection to this running HTTP server for proxying data
    this._serverSocket = net.createConnection(this._httpPort);
    this._serverSocket.on('connect', this._onServerSocketConnect);
    this._serverSocket.on('data', this._onServerSocketData);
    this._serverSocket.on('close', this._onServerSocketClose);
    this._serverSocket.on('error', this._onServerSocketError); // we MUST register for this event, otherwise the error will bubble up to the top and crash the node process entirely.

    this._serverSocket.setNoDelay(true); // disable Nagle algorithm
    this._serverSocket.setKeepAlive(true);
  }

  // Called only once right after onHttpServerListening
  _onServerSocketConnect = () => {
    // we are now fully set up:
    //  - clientSocket is connected to the iOS device
    //  - serverSocket is connected to the httpServer
    //  - ready to proxy data!
    this._fullySetup = true;
    // start by flushing any pending buffered data received from the client while we were setting up
    if (this._pendingClientSocketData && this._pendingClientSocketData.length > 0) {
      this._serverSocket && this._serverSocket.write(this._pendingClientSocketData);
      this._pendingClientSocketData = null;
    }
  }

  // Received data from client (iOS)
  _onClientSocketData = (data: Buffer) => {
    // _writingResponse is reverted to false in _onHttpServerRequest(...) after response was written
    this._writingResponse = true;

    // give listeners an opportunity to decrypt this data before processing it as HTTP
    const decrypted: { data: Buffer | null, error: Error | null } = {data: null, error: null};
    this.emit(EventedHTTPServerEvents.DECRYPT, data, decrypted, this._session);

    if (decrypted.error) {
      // decryption and/or verification failed, disconnect the client
      debug("[%s] Error occurred trying to decrypt incoming packet: %s", this._remoteAddress, decrypted.error.message);
      this.close();
    } else {
      if (decrypted.data) {
        data = decrypted.data;
      }

      if (this._fullySetup) {
        // proxy it along to the HTTP server
        this._serverSocket && this._serverSocket.write(data);
      } else {
        // we're not setup yet, so add this data to our buffer
        this._pendingClientSocketData = Buffer.concat([this._pendingClientSocketData!, data]);
      }
    }
  }

  // Received data from HTTP Server
  _onServerSocketData = (data: Buffer | string) => {
    // give listeners an opportunity to encrypt this data before sending it to the client
    const encrypted = {data: null};
    this.emit(EventedHTTPServerEvents.ENCRYPT, data, encrypted, this._session);
    if (encrypted.data)
      data = encrypted.data!;
    // proxy it along to the client (iOS)
    this._clientSocket.write(data);

    if (this._killSocketAfterWrite) {
      setTimeout(() => {
        this._clientSocket.destroy();
      }, 10);
    }
  }

  // Our internal HTTP Server has been closed (happens after we call this._httpServer.close() below)
  _onServerSocketClose = () => {
    debug("[%s] HTTP connection was closed", this._remoteAddress);
    // make sure the iOS side is closed as well
    this._clientSocket.destroy();
    // we only support a single long-lived connection to our internal HTTP server. Since it's closed,
    // we'll need to shut it down entirely.
    this._httpServer.close();
  }

  // Our internal HTTP Server has been closed (happens after we call this._httpServer.close() below)
  _onServerSocketError = (err: Error) => {
    debug("[%s] HTTP connection error: ", this._remoteAddress, err.message);
    // _onServerSocketClose will be called next
  }

  _onHttpServerRequest = (request: IncomingMessage, response: OutgoingMessage) => {
    debug("[%s] HTTP request: %s", this._remoteAddress, request.url);

    // sign up to know when the response is ended, so we can safely send EVENT responses
    response.on('finish', () => {
      debug("[%s] HTTP Response is finished", this._remoteAddress);
      this._writingResponse = false;
      this._sendPendingEvents();
    });
    // pass it along to listeners
    this.emit(EventedHTTPServerEvents.REQUEST, request, response, this._session, this._events);
  }

  _onHttpServerClose = () => {
    debug("[%s] HTTP server was closed", this._remoteAddress);
    // notify listeners that we are completely closed
    this.emit(EventedHTTPServerEvents.CLOSE, this._events);
  }

  _onHttpServerError = (err: Error & { code?: string }) => {
    debug("[%s] HTTP server error: %s", this._remoteAddress, err.message);
    if (err.code === 'EADDRINUSE') {
      this._httpServer.close();
      this._httpServer.listen(0);
    }
  }

  _onClientSocketClose = () => {
    debug("[%s] Client connection closed", this._remoteAddress);
    // shutdown the other side
    this._serverSocket && this._serverSocket.destroy();
    this._session._connectionDestroyed();
  }

  _onClientSocketError = (err: Error) => {
    debug("[%s] Client connection error: %s", this._remoteAddress, err.message);
    // _onClientSocketClose will be called next
  }

  private static getLocalNetworkInterface(socket: Socket): string {
    let localAddress = socket.localAddress;

    if (localAddress.startsWith("::ffff:")) { // IPv4-Mapped IPv6 Address https://tools.ietf.org/html/rfc4291#section-2.5.5.2
      localAddress = localAddress.substring(7);
    } else {
      const index = localAddress.indexOf("%");
      if (index !== -1) { // link-local ipv6
        localAddress = localAddress.substring(0, index);
      }
    }

    const interfaces = os.networkInterfaces();
    for (const [name, infos] of Object.entries(interfaces)) {
      for (const info of infos) {
        if (info.address === localAddress) {
          return name;
        }
      }
    }

    // we couldn't map the address from above, we try now to match subnets (see https://github.com/homebridge/HAP-NodeJS/issues/847)
    const family = net.isIPv4(localAddress)? "IPv4": "IPv6";
    for (const [name, infos] of Object.entries(interfaces)) {
      for (const info of infos) {
        if (info.family !== family) {
          continue;
        }

        // check if the localAddress is in the same subnet
        if (getNetAddress(localAddress, info.netmask) === getNetAddress(info.address, info.netmask)) {
          return name;
        }
      }
    }

    console.log(`WARNING couldn't map socket coming from remote address ${socket.remoteAddress}:${socket.remotePort} at local address ${socket.localAddress} to a interface!`);

    return Object.keys(interfaces)[1]; // just use the first interface after the loopback interface as fallback
  }

}
