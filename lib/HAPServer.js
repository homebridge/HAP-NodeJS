var debug = require('debug')('HAPServer');
var crypto = require("crypto");
var srp = require("srp");
var url = require("url");
var inherits = require('util').inherits;
var ed25519 = require("ed25519");
var hkdf = require("./util/hkdf");
var tlv = require("./util/tlv");
var encryption = require("./util/encryption")
var EventEmitter = require('events').EventEmitter;
var EventedHTTPServer = require("./util/eventedhttp").EventedHTTPServer;
var once = require('./util/once').once;

'use strict';

module.exports = {
  HAPServer: HAPServer
}


/**
 * The actual HAP server that iOS devices talk to.
 *
 * Notes
 * -----
 * It turns out that the IP-based version of HomeKit's HAP protocol operates over a sort of pseudo-HTTP.
 * Accessories are meant to host a TCP socket server that initially behaves exactly as an HTTP/1.1 server.
 * So iOS devices will open up a long-lived connection to this server and begin issuing HTTP requests.
 * So far, this conforms with HTTP/1.1 Keepalive. However, after the "pairing" process is complete, the
 * connection is expected to be "upgraded" to support full-packet encryption of both HTTP headers and data.
 * This encryption is NOT SSL. It is a customized ChaCha20+Poly1305 encryption layer.
 *
 * Additionally, this "HTTP Server" supports sending "event" responses at any time without warning. The iOS
 * device simply keeps the connection open after it's finished with HTTP request/response traffic, and while
 * the connection is open, the server can elect to issue "EVENT/1.0 200 OK" HTTP-style responses. These are
 * typically sent to inform the iOS device of a characteristic change for the accessory (like "Door was Unlocked").
 *
 * See eventedhttp.js for more detail on the implementation of this protocol.
 *
 * @event 'listening' => function() { }
 *        Emitted when the server is fully set up and ready to receive connections.
 *
 * @event 'identify' => function(callback(err)) { }
 *        Emitted when a client wishes for this server to identify itself before pairing. You must call the
 *        callback to respond to the client with success.
 *
 * @event 'pair' => function(username, publicKey, callback(err)) { }
 *        This event is emitted when a client completes the "pairing" process and exchanges encryption keys.
 *        Note that this does not mean the "Add Accessory" process in iOS has completed. You must call the
 *        callback to complete the process.
 *
 * @event 'verify' => function() { }
 *        This event is emitted after a client successfully completes the "verify" process, thereby authenticating
 *        itself to an Accessory as a known-paired client.
 *
 * @event 'unpair' => function(username, callback(err)) { }
 *        This event is emitted when a client has requested us to "remove their pairing info", or basically to unpair.
 *        You must call the callback to complete the process.
 *
 * @event 'accessories' => function(callback(err, accessories)) { }
 *        This event is emitted when a client requests the complete representation of Accessory data for
 *        this Accessory (for instance, what services, characteristics, etc. are supported) and any bridged
 *        Accessories in the case of a Bridge Accessory. The listener must call the provided callback function
 *        when the accessory data is ready. We will automatically JSON.stringify the data.
 *
 * @event 'get-characteristics' => function(data, events, callback(err, characteristics)) { }
 *        This event is emitted when a client wishes to retrieve the current value of one or more characteristics.
 *        The listener must call the provided callback function when the values are ready. iOS clients can typically
 *        wait up to 10 seconds for this call to return. We will automatically JSON.stringify the data (which must 
 *        be an array) and wrap it in an object with a top-level "characteristics" property.
 *
 * @event 'set-characteristics' => function(data, events, callback(err)) { }
 *        This event is emitted when a client wishes to set the current value of one or more characteristics and/or
 *        subscribe to one or more events. The 'events' param is an initially-empty object, associated with the current
 *        connection, on which you may store event registration keys for later processing. The listener must call
 *        the provided callback when the request has been processed.
 */


function HAPServer(accessoryInfo, accessoryController) {
  this.accessoryInfo = accessoryInfo;
  
  // internal server that does all the actual communication
  this._httpServer = new EventedHTTPServer();
  this._httpServer.on('listening', this._onListening.bind(this));
  this._httpServer.on('request', this._onRequest.bind(this));
  this._httpServer.on('encrypt', this._onEncrypt.bind(this));
  this._httpServer.on('decrypt', this._onDecrypt.bind(this));
  
  // so iOS is very reluctant to actually disconnect HAP connections (as in, sending a FIN packet).
  // For instance, if you turn off wifi on your phone, it will not close the connection, instead
  // it will leave it open and hope that it's still valid when it returns to the network. And Node,
  // by itself, does not ever "discover" that the connection has been closed behind it, until a
  // potentially very long system-level socket timeout (like, days). To work around this, we have
  // invented a manual "keepalive" mechanism where we send "empty" events perodicially, such that
  // when Node attempts to write to the socket, it discovers that it's been disconnected after
  // an additional one-minute timeout (this timeout appears to be hardcoded).
  this._keepAliveTimerID = setInterval(this._onKeepAliveTimerTick.bind(this), 1000 * 60 * 10); // send keepalive every 10 minutes
}

inherits(HAPServer, EventEmitter);

HAPServer.handlers = {
  '/identify': '_handleIdentify',
  '/pair-setup': '_handlePair',
  '/pair-verify': '_handlePairVerify',
  '/pairings': '_handlePairings',
  '/accessories': '_handleAccessories',
  '/characteristics': '_handleCharacteristics'
}

// Various "type" constants for HAP's TLV encoding.
HAPServer.Types = {
  REQUEST_TYPE: 0x00,
  USERNAME: 0x01,
  SALT: 0x02,
  PUBLIC_KEY: 0x03,
  PASSWORD_PROOF: 0x04,
  ENCRYPTED_DATA: 0x05,
  SEQUENCE_NUM: 0x06,
  ERROR_CODE: 0x07,
  PROOF: 0x0a
}

// Error codes and the like, guessed by packet inspection
HAPServer.Codes = {
  INVALID_REQUEST: 0x02,
  INVALID_SIGNATURE: 0x04
}

HAPServer.prototype.listen = function(port) {
  this._httpServer.listen(port);
}

HAPServer.prototype._onKeepAliveTimerTick = function() {
  // send out a "keepalive" event which all connections automatically sign up for once pairVerify is
  // completed. The event contains no actual data, so iOS devices will simply ignore it.
  this.notifyClients('keepalive', {characteristics: []});
}

/**
 * Notifies connected clients who have subscribed to a particular event.
 *
 * @param event {string} - the name of the event (only clients who have subscribed to this name will be notified)
 * @param data {object} - the object containing the event data; will be JSON.stringify'd automatically
 */
HAPServer.prototype.notifyClients = function(event, data, excludeEvents) {
  // encode notification data as JSON, set content-type, and hand it off to the server.
  this._httpServer.sendEvent(event, JSON.stringify(data), "application/hap+json", excludeEvents);
}

HAPServer.prototype._onListening = function() {
  this.emit('listening');
}

// Called when an HTTP request was detected.
HAPServer.prototype._onRequest = function(request, response, session, events) {
  
  debug("[%s] HAP Request: %s %s", this.accessoryInfo.username, request.method, request.url);
  
  // collect requst data, if any
  var requestData = Buffer("");
  request.on('data', function(data) { requestData = Buffer.concat([requestData, data]); });
  request.on('end', function() {
    
    // parse request.url (which can contain querystring, etc.) into components, then extract just the path
    var pathname = url.parse(request.url).pathname;
    
    // all request data received; now process this request
    for (var path in HAPServer.handlers)
      if (new RegExp('^'+path+'/?$').test(pathname)) { // match exact string and allow trailing slash
        this[HAPServer.handlers[path]](request, response, session, events, requestData);
        return;
      }
    
    // nobody handled this? reply 404
    debug("[%s] WARNING: Handler for %s not implemented", this.accessoryInfo.username, request.url);
    response.writeHead(404, "Not found", {'Content-Type': 'text/html'});
    response.end();

  }.bind(this));
}

HAPServer.prototype._onEncrypt = function(data, encrypted, session) {
  
  // instance of HAPEncryption (created in handlePairVerifyStepOne)
  var enc = session.encryption;
  
  // if accessoryToControllerKey is not empty, then encryption is enabled for this connection. However, we'll
  // need to be careful to ensure that we don't encrypt the last few bytes of the response from handlePairVerifyStepTwo.
  // Since all communication calls are asynchronous, we could easily receive this 'encrypt' event for those bytes.
  // So we want to make sure that we aren't encrypting data until we have *received* some encrypted data from the
  // client first.
  if (enc && enc.accessoryToControllerKey.length > 0 && enc.controllerToAccessoryCount.value > 0) {
    encrypted.data = encryption.layerEncrypt(data, enc.accessoryToControllerCount, enc.accessoryToControllerKey);
  }
}

HAPServer.prototype._onDecrypt = function(data, decrypted, session) {

  // possibly an instance of HAPEncryption (created in handlePairVerifyStepOne)
  var enc = session.encryption;

  // if controllerToAccessoryKey is not empty, then encryption is enabled for this connection.
  if (enc && enc.controllerToAccessoryKey.length > 0) {
    decrypted.data = encryption.layerDecrypt(data, enc.controllerToAccessoryCount, enc.controllerToAccessoryKey);
  }
}

/**
 * Unpaired Accessory identification.
 */

HAPServer.prototype._handleIdentify = function(request, response, session, events, requestData) {
  
  this.emit('identify', once(function(err) {
    
    if (!err) {
      debug("[%s] Identification success", this.accessoryInfo.username);
      response.writeHead(204);
      response.end();
    }
    else {
      debug("[%s] Identification error: %s", this.accessoryInfo.username, err.message);
      response.writeHead(500);
      response.end();
    }
  
  }.bind(this)));
}

/**
 * iOS <-> Accessory pairing process.
 */

HAPServer.prototype._handlePair = function(request, response, session, events, requestData) {

  var objects = tlv.decode(requestData);
  var sequence = objects[HAPServer.Types.SEQUENCE_NUM][0]; // value is single byte with sequence number
  
  if (sequence == 0x01)
    this._handlePairStepOne(request, response, session);
  else if (sequence == 0x03)
    this._handlePairStepTwo(request, response, session, objects);
  else if (sequence == 0x05)
    this._handlePairStepThree(request, response, session, objects);
}

// M1 + M2
HAPServer.prototype._handlePairStepOne = function(request, response, session) {
  debug("[%s] Pair step 1/5", this.accessoryInfo.username);

  var salt = crypto.randomBytes(16);
  var srpParams = srp.params["3072"];

  srp.genKey(32, function (error, key) {
    
    // create a new SRP server
    var srpServer = new srp.Server(srpParams, Buffer(salt), Buffer("Pair-Setup"), Buffer(this.accessoryInfo.pincode), key);
    var srpB = srpServer.computeB();

    // attach it to the current TCP session
    session.srpServer = srpServer;
    
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.SEQUENCE_NUM, 0x02,
      HAPServer.Types.SALT, salt,
      HAPServer.Types.PUBLIC_KEY, srpB
    ));
    
  }.bind(this));
}

// M3 + M4
HAPServer.prototype._handlePairStepTwo = function(request, response, session, objects) {
  debug("[%s] Pair step 2/5", this.accessoryInfo.username);

  var A = objects[HAPServer.Types.PUBLIC_KEY]; // "A is a public key that exists only for a single login session."
  var M1 = objects[HAPServer.Types.PASSWORD_PROOF]; // "M1 is the proof that you actually know your own password."

  // pull the SRP server we created in stepOne out of the current session
  var srpServer = session.srpServer;
  srpServer.setA(A);
  
  try {  
    srpServer.checkM1(M1);
  }
  catch (err) {
    // most likely the client supplied an incorrect pincode.
    debug("[%s] Error while checking pincode: %s", this.accessoryInfo.username, err.message);
    
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.SEQUENCE_NUM, 0x04,
      HAPServer.Types.ERROR_CODE, HAPServer.Codes.INVALID_REQUEST
    ));
    
    return;
  }

  // "M2 is the proof that the server actually knows your password."
  var M2 = srpServer.computeM2();
  
  response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
  response.end(tlv.encode(
    HAPServer.Types.SEQUENCE_NUM, 0x04,
    HAPServer.Types.PASSWORD_PROOF, M2
  ));
}

// M5-1
HAPServer.prototype._handlePairStepThree = function(request, response, session, objects) {
  debug("[%s] Pair step 3/5", this.accessoryInfo.username);

  // pull the SRP server we created in stepOne out of the current session
  var srpServer = session.srpServer;

  var encryptedData = objects[HAPServer.Types.ENCRYPTED_DATA];
  
  var messageData = Buffer(encryptedData.length - 16);
  var authTagData = Buffer(16);
  
  encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
  encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);

  var S_private = srpServer.computeK();
  var encSalt = Buffer("Pair-Setup-Encrypt-Salt");
  var encInfo = Buffer("Pair-Setup-Encrypt-Info");

  var outputKey = hkdf.HKDF("sha512", encSalt, S_private, encInfo, 32);
  
  var plaintextBuffer = Buffer(messageData.length);
  encryption.verifyAndDecrypt(outputKey, Buffer("PS-Msg05"), messageData, authTagData, null, plaintextBuffer);
  
  // decode the client payload and pass it on to the next step
  var M5Packet = tlv.decode(plaintextBuffer);
  
  var clientUsername = M5Packet[HAPServer.Types.USERNAME];
  var clientLTPK = M5Packet[HAPServer.Types.PUBLIC_KEY];
  var clientProof = M5Packet[HAPServer.Types.PROOF];
  var hkdfEncKey = outputKey;
  
  this._handlePairStepFour(request, response, session, clientUsername, clientLTPK, clientProof, hkdfEncKey);
}

// M5-2
HAPServer.prototype._handlePairStepFour = function(request, response, session, clientUsername, clientLTPK, clientProof, hkdfEncKey) {
  debug("[%s] Pair step 4/5", this.accessoryInfo.username);

  var S_private = session.srpServer.computeK();
  var controllerSalt = Buffer("Pair-Setup-Controller-Sign-Salt");
  var controllerInfo = Buffer("Pair-Setup-Controller-Sign-Info");
  var outputKey = hkdf.HKDF("sha512", controllerSalt, S_private, controllerInfo, 32);
  
  var completeData = Buffer.concat([outputKey, clientUsername, clientLTPK]);
  
  if (!ed25519.Verify(completeData, clientProof, clientLTPK)) {
    debug("[%s] Invalid signature", this.accessoryInfo.username);
    
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.SEQUENCE_NUM, 0x06,
      HAPServer.Types.ERROR_CODE, HAPServer.Codes.INVALID_REQUEST
    ));
    
    return;
  }
  
  this._handlePairStepFive(request, response, session, clientUsername, clientLTPK, hkdfEncKey);
}

// M5 - F + M6
HAPServer.prototype._handlePairStepFive = function(request, response, session, clientUsername, clientLTPK, hkdfEncKey) {
  debug("[%s] Pair step 5/5", this.accessoryInfo.username);
  
  var S_private = session.srpServer.computeK();
  var accessorySalt = Buffer("Pair-Setup-Accessory-Sign-Salt");
  var accessoryInfo = Buffer("Pair-Setup-Accessory-Sign-Info");
  var outputKey = hkdf.HKDF("sha512", accessorySalt, S_private, accessoryInfo, 32);

  var serverLTPK = this.accessoryInfo.signPk;
  var usernameData = Buffer(this.accessoryInfo.username);
  
  var material = Buffer.concat([outputKey, usernameData, serverLTPK]);
  var privateKey = Buffer(this.accessoryInfo.signSk);

  var serverProof = ed25519.Sign(material, privateKey);

  var message = tlv.encode(
    HAPServer.Types.USERNAME, usernameData,
    HAPServer.Types.PUBLIC_KEY, serverLTPK,
    HAPServer.Types.PROOF, serverProof
  );
  
  var ciphertextBuffer = Buffer(Array(message.length));
  var macBuffer = Buffer(Array(16));
  encryption.encryptAndSeal(hkdfEncKey, Buffer("PS-Msg06"), message, null, ciphertextBuffer, macBuffer);

  // finally, notify listeners that we have been paired with a client
  this.emit('pair', clientUsername.toString(), clientLTPK, once(function(err) {

    if (err) {
      debug("[%s] Error adding pairing info: %s", this.accessoryInfo.username, err.message);
      response.writeHead(500, "Server Error");
      response.end();
      return;
    }

    // send final pairing response to client
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.SEQUENCE_NUM, 0x06,
      HAPServer.Types.ENCRYPTED_DATA, Buffer.concat([ciphertextBuffer,macBuffer])
    ));
  }));
}

/**
 * iOS <-> Accessory pairing verification.
 */

HAPServer.prototype._handlePairVerify = function(request, response, session, events, requestData) {
  
  var objects = tlv.decode(requestData);
  var sequence = objects[HAPServer.Types.SEQUENCE_NUM][0]; // value is single byte with sequence number
  
  if (sequence == 0x01)
    this._handlePairVerifyStepOne(request, response, session, objects);
  else if (sequence == 0x03)
    this._handlePairVerifyStepTwo(request, response, session, events, objects);
}

HAPServer.prototype._handlePairVerifyStepOne = function(request, response, session, objects) {
  debug("[%s] Pair verify step 1/2", this.accessoryInfo.username);

  var clientPublicKey = objects[HAPServer.Types.PUBLIC_KEY]; // Buffer
  
  // generate new encryption keys for this session
  var secretKey = encryption.generateCurve25519SecretKey();
  var publicKey = encryption.generateCurve25519PublicKeyFromSecretKey(secretKey);
  var sharedSec = encryption.generateCurve25519SharedSecKey(secretKey, clientPublicKey);
    
  var usernameData = Buffer(this.accessoryInfo.username);
  var material = Buffer.concat([publicKey, usernameData, clientPublicKey]);
  var privateKey = Buffer(this.accessoryInfo.signSk);
  var serverProof = ed25519.Sign(material, privateKey);

  var encSalt = Buffer("Pair-Verify-Encrypt-Salt");
  var encInfo = Buffer("Pair-Verify-Encrypt-Info");

  var outputKey = hkdf.HKDF("sha512", encSalt, sharedSec, encInfo, 32).slice(0,32);

  // store keys in a new instance of HAPEncryption
  var enc = new HAPEncryption();
  enc.clientPublicKey = clientPublicKey;
  enc.secretKey = secretKey;
  enc.publicKey = publicKey;
  enc.sharedSec = sharedSec;
  enc.hkdfPairEncKey = outputKey;
  
  // store this in the current TCP session
  session.encryption = enc;

  // compose the response data in TLV format
  var message = tlv.encode(
    HAPServer.Types.USERNAME, usernameData,
    HAPServer.Types.PROOF, serverProof
  );
  
  // encrypt the response
  var ciphertextBuffer = Buffer(Array(message.length));
  var macBuffer = Buffer(Array(16));
  encryption.encryptAndSeal(outputKey, Buffer("PV-Msg02"), message, null, ciphertextBuffer, macBuffer);

  response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
  response.end(tlv.encode(
    HAPServer.Types.SEQUENCE_NUM, 0x02,
    HAPServer.Types.ENCRYPTED_DATA, Buffer.concat([ciphertextBuffer, macBuffer]),
    HAPServer.Types.PUBLIC_KEY, publicKey
  ));
}

HAPServer.prototype._handlePairVerifyStepTwo = function(request, response, session, events, objects) {
  debug("[%s] Pair verify step 2/2", this.accessoryInfo.username);

  var encryptedData = objects[HAPServer.Types.ENCRYPTED_DATA];
  
  var messageData = Buffer(encryptedData.length - 16);
  var authTagData = Buffer(16);
  encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
  encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);

  var plaintextBuffer = Buffer(messageData.length);
  
  // instance of HAPEncryption (created in handlePairVerifyStepOne)
  var enc = session.encryption;
  
  if (!encryption.verifyAndDecrypt(enc.hkdfPairEncKey, Buffer("PV-Msg03"), messageData, authTagData, null, plaintextBuffer)) {
    debug("[%s] M3: Invalid signature", this.accessoryInfo.username);
    
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.ERROR_CODE, HAPServer.Codes.INVALID_REQUEST
    ));
    
    return;
  }
  
  var decoded = tlv.decode(plaintextBuffer);
  var clientUsername = decoded[HAPServer.Types.USERNAME];
  var proof = decoded[HAPServer.Types.PROOF];

  var material = Buffer.concat([enc.clientPublicKey, clientUsername, enc.publicKey]);

  // since we're paired, we should have the public key stored for this client
  var clientPublicKey = this.accessoryInfo.getClientPublicKey(clientUsername.toString());
  
  // if we're not actually paired, then there's nothing to verify - this client thinks it's paired with us but we
  // disagree. Respond with invalid request (seems to match HomeKit Accessory Simulator behavior)
  if (!clientPublicKey) {
    debug("[%s] Client %s attempting to verify, but we are not paired; rejecting client", this.accessoryInfo.username, clientUsername);
    
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.ERROR_CODE, HAPServer.Codes.INVALID_REQUEST
    ));
    
    return;
  }

  if (!ed25519.Verify(material, proof, clientPublicKey)) {
    debug("[%s] Client %s provided an invalid signature", this.accessoryInfo.username, clientUsername);
    
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(
      HAPServer.Types.ERROR_CODE, HAPServer.Codes.INVALID_REQUEST
    ));
    
    return;
  }

  debug("[%s] Client %s verification complete", this.accessoryInfo.username, clientUsername);
  
  response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
  response.end(tlv.encode(
    HAPServer.Types.SEQUENCE_NUM, 0x04
  ));
  
  // now that the client has been verified, we must "upgrade" our pesudo-HTTP connection to include
  // TCP-level encryption. We'll do this by adding some more encryption vars to the session, and using them
  // in future calls to onEncrypt, onDecrypt.
  
  var encSalt = new Buffer("Control-Salt");
  var infoRead = new Buffer("Control-Read-Encryption-Key");
  var infoWrite = new Buffer("Control-Write-Encryption-Key");

  enc.accessoryToControllerKey = hkdf.HKDF("sha512", encSalt, enc.sharedSec, infoRead, 32);
  enc.controllerToAccessoryKey = hkdf.HKDF("sha512", encSalt, enc.sharedSec, infoWrite, 32);
  
  // Our connection is now completely setup. We now want to subscribe this connection to special
  // "keepalive" events for detecting when connections are closed by the client.
  events['keepalive'] = true;
}

/**
 * Pair add/remove
 */

HAPServer.prototype._handlePairings = function(request, response, session, events, requestData) {
  var objects = tlv.decode(requestData);
  var requestType = objects[HAPServer.Types.REQUEST_TYPE][0]; // value is single byte with request type
  
  if (requestType == 3) {
    
    // technically we're already paired and communicating securely if the client is able to call /pairings at all!
    // but maybe the client wants to change their public key? so we'll emit 'pair' like we just paired again
    
    debug("[%s] Adding pairing info for client", this.accessoryInfo.username);
    var clientUsername = objects[HAPServer.Types.USERNAME];
    var clientLTPK = objects[HAPServer.Types.PUBLIC_KEY];
    
    this.emit('pair', clientUsername.toString(), clientLTPK, once(function(err) {

      if (err) {
        debug("[%s] Error adding pairing info: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500, "Server Error");
        response.end();
        return;
      }
      
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(HAPServer.Types.SEQUENCE_NUM, 0x02));

    }.bind(this)));
  }
  else if (requestType == 4) {
    
    debug("[%s] Removing pairing info for client", this.accessoryInfo.username);
    var clientUsername = objects[HAPServer.Types.USERNAME];

    this.emit('unpair', clientUsername.toString(), once(function(err) {

      if (err) {
        debug("[%s] Error removing pairing info: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500, "Server Error");
        response.end();
        return;
      }
      
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(HAPServer.Types.SEQUENCE_NUM, 0x02));

    }.bind(this)));
  }
}


/*
 * Handlers for all after-pairing communication, or the bulk of HAP.
 */

// Called when the client wishes to fetch all data regarding our published Accessories.
HAPServer.prototype._handleAccessories = function(request, response, session, events, requestData) {

  // call out to listeners to retrieve the latest accessories JSON
  this.emit('accessories', once(function(err, accessories) {
    
    if (err) {
      debug("[%s] Error getting accessories: %s", this.accessoryInfo.username, err.message);
      response.writeHead(500, "Server Error");
      response.end();
      return;
    }
    
    response.writeHead(200, {"Content-Type": "application/hap+json"});
    response.end(JSON.stringify(accessories));
  }));
}

// Called when the client wishes to get or set particular characteristics
HAPServer.prototype._handleCharacteristics = function(request, response, session, events, requestData) {
  
  if (request.method == "GET") {
    
    // Extract the query params from the URL which looks like: /characteristics?id=1.9,2.14,...
    var parseQueryString = true;
    var query = url.parse(request.url, parseQueryString).query; // { id: '1.9,2.14' }
    var sets = query.id.split(','); // ["1.9","2.14"]
    var data = []; // [{aid:1,iid:9},{aid:2,iid:14}]
    
    for (var i in sets) {
      var ids = sets[i].split('.'); // ["1","9"]
      var aid = parseInt(ids[0]); // accessory ID
      var iid = parseInt(ids[1]); // instance ID (for characteristic)
      data.push({aid:aid,iid:iid});
    }

    this.emit('get-characteristics', data, events, function(err, characteristics) {

      if (!characteristics && !err)
        err = new Error("characteristics not supplied by the get-characteristics event callback");

      if (err) {
        debug("[%s] Error getting characteristics: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500, "Server Error");
        response.end();
        return;
      }
      
      // 207 is "multi-status" since HomeKit is requesting multiple things and any one can fail independently      
      response.writeHead(207, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({characteristics:characteristics}));
    }.bind(this));
  }
  else if (request.method == "PUT") {
    
    // requestData is a JSON payload
    var data = JSON.parse(requestData.toString());
    
    // call out to listeners to retrieve the latest accessories JSON
    this.emit('set-characteristics', data, events, once(function(err) {
      
      if (err) {
        debug("[%s] Error setting characteristics: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500, "Server Error");
        response.end();
        return;
      }
      
      response.writeHead(204, {"Content-Type": "application/hap+json"});
      response.end();
    }.bind(this)));
  }
}


/**
 * Simple struct to hold vars needed to support HAP encryption.
 */
 
function HAPEncryption() {
  // initialize member vars with null-object values
  this.clientPublicKey = new Buffer(0);
  this.secretKey = new Buffer(0);
  this.publicKey = new Buffer(0);
  this.sharedSec = new Buffer(0);
  this.hkdfPairEncKey = new Buffer(0);
  this.accessoryToControllerCount = { value: 0 };
  this.controllerToAccessoryCount = { value: 0 };
  this.accessoryToControllerKey = new Buffer(0);
  this.controllerToAccessoryKey = new Buffer(0);
}