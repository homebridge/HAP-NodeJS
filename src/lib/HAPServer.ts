import crypto from 'crypto';

import bufferShim from 'buffer-shims';
import createDebug from 'debug';
import srp from 'fast-srp-hap';
import tweetnacl from 'tweetnacl';
import url from 'url';

import * as encryption from './util/encryption';
import * as hkdf from './util/hkdf';
import * as tlv from './util/tlv';
import { EventedHTTPServer, EventedHTTPServerEvents, Session } from './util/eventedhttp';
import { once } from './util/once';
import { IncomingMessage, ServerResponse } from "http";
import { Characteristic } from './Characteristic';
import { Accessory, CharacteristicEvents, Resource } from './Accessory';
import { CharacteristicData, NodeCallback, PairingsCallback, SessionIdentifier, VoidCallback } from '../types';
import { EventEmitter } from './EventEmitter';
import { PairingInformation, PermissionTypes } from "./model/AccessoryInfo";

const debug = createDebug('HAPServer');

// Various "type" constants for HAP's TLV encoding.
export type Types = TLVValues; // backwards compatibility
export enum TLVValues {
  REQUEST_TYPE = 0x00,
  METHOD = 0x00, // (match the terminology of the spec sheet but keep backwards compatibility with entry above)
  USERNAME = 0x01,
  IDENTIFIER = 0x01,
  SALT = 0x02,
  PUBLIC_KEY = 0x03,
  PASSWORD_PROOF = 0x04,
  ENCRYPTED_DATA = 0x05,
  SEQUENCE_NUM = 0x06,
  STATE = 0x06,
  ERROR_CODE = 0x07,
  RETRY_DELAY = 0x08,
  CERTIFICATE = 0x09, // x.509 certificate
  PROOF = 0x0A,
  SIGNATURE = 0x0A,  // apple authentication coprocessor
  PERMISSIONS = 0x0B, // None (0x00): regular user, 0x01: Admin (able to add/remove/list pairings)
  FRAGMENT_DATA = 0x0C,
  FRAGMENT_LAST = 0x0D,
  SEPARATOR = 0x0FF // Zero-length TLV that separates different TLVs in a list.
}

export enum Methods {
  PAIR_SETUP = 0x00,
  PAIR_SETUP_WITH_AUTH = 0x01,
  PAIR_VERIFY = 0x02,
  ADD_PAIRING = 0x03,
  REMOVE_PAIRING = 0x04,
  LIST_PAIRINGS = 0x05
}

export enum States {
  M1 = 0x01,
  M2 = 0x02,
  M3 = 0x03,
  M4 = 0x04,
  M5 = 0x05,
  M6 = 0x06
}

// Error codes and the like, guessed by packet inspection
export enum Codes {
  UNKNOWN = 0x01,
  INVALID_REQUEST = 0x02,
  AUTHENTICATION = 0x02, // setup code or signature verification failed
  BACKOFF = 0x03, // // client must look at retry delay tlv item
  MAX_PEERS = 0x04, // server cannot accept any more pairings
  MAX_TRIES = 0x05, // server reached maximum number of authentication attempts
  UNAVAILABLE = 0x06, // server pairing method is unavailable
  BUSY = 0x07 // cannot accept pairing request at this time
}

// Status codes for underlying HAP calls
export enum Status {
  SUCCESS = 0,
  INSUFFICIENT_PRIVILEGES = -70401,
  SERVICE_COMMUNICATION_FAILURE = -70402,
  RESOURCE_BUSY = -70403,
  READ_ONLY_CHARACTERISTIC = -70404,
  WRITE_ONLY_CHARACTERISTIC = -70405,
  NOTIFICATION_NOT_SUPPORTED = -70406,
  OUT_OF_RESOURCE = -70407,
  OPERATION_TIMED_OUT = -70408,
  RESOURCE_DOES_NOT_EXIST = -70409,
  INVALID_VALUE_IN_REQUEST = -70410,
  INSUFFICIENT_AUTHORIZATION = -70411
}

export enum HapRequestMessageTypes {
  PAIR_VERIFY = 'pair-verify',
  DISCOVERY = 'discovery',
  WRITE_CHARACTERISTICS = 'write-characteristics',
  READ_CHARACTERISTICS = 'read-characteristics'
}

export type RemoteSession = {
  responseMessage(request: HapRequest, data: Buffer): void;
}

export type HapRequest = {
  messageType: HapRequestMessageTypes
  requestBody: any;
}

export enum HAPServerEventTypes {
  IDENTIFY = "identify",
  LISTENING = "listening",
  PAIR = 'pair',
  ADD_PAIRING = 'add-pairing',
  REMOVE_PAIRING = 'remove_pairing',
  LIST_PAIRINGS = 'list-pairings',
  ACCESSORIES = 'accessories',
  GET_CHARACTERISTICS = 'get-characteristics',
  SET_CHARACTERISTICS = 'set-characteristics',
  SESSION_CLOSE = "session-close",
  REQUEST_RESOURCE = 'request-resource'
}

export type Events = {
  [HAPServerEventTypes.IDENTIFY]: (cb: VoidCallback) => void;
  [HAPServerEventTypes.LISTENING]: (port: number) => void;
  [HAPServerEventTypes.PAIR]: (clientUsername: string, clientLTPK: Buffer, cb: VoidCallback) => void;
  [HAPServerEventTypes.ADD_PAIRING]: (controller: Session, username: string, publicKey: Buffer, permission: number, callback: PairingsCallback<void>) => void;
  [HAPServerEventTypes.REMOVE_PAIRING]: (controller: Session, username: string, callback: PairingsCallback<void>) => void;
  [HAPServerEventTypes.LIST_PAIRINGS]: (controller: Session, callback: PairingsCallback<PairingInformation[]>) => void;
  [HAPServerEventTypes.ACCESSORIES]: (cb: NodeCallback<Accessory[]>) => void;
  [HAPServerEventTypes.GET_CHARACTERISTICS]: (
    data: CharacteristicData[],
    events: CharacteristicEvents,
    cb: NodeCallback<CharacteristicData[]>,
    remote: boolean,
    connectionID: string,
  ) => void;
  [HAPServerEventTypes.SET_CHARACTERISTICS]: (
    data: CharacteristicData[],
    events: CharacteristicEvents,
    cb: NodeCallback<CharacteristicData[]>,
    remote: boolean,
    connectionID: string,
  ) => void;
  [HAPServerEventTypes.SESSION_CLOSE]: (sessionID: string, events: CharacteristicEvents) => void;
  [HAPServerEventTypes.REQUEST_RESOURCE]: (data: Resource, cb: NodeCallback<Buffer>) => void;
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
 * @event 'get-characteristics' => function(data, events, callback(err, characteristics), remote, connectionID) { }
 *        This event is emitted when a client wishes to retrieve the current value of one or more characteristics.
 *        The listener must call the provided callback function when the values are ready. iOS clients can typically
 *        wait up to 10 seconds for this call to return. We will automatically JSON.stringify the data (which must
 *        be an array) and wrap it in an object with a top-level "characteristics" property.
 *
 * @event 'set-characteristics' => function(data, events, callback(err), remote, connectionID) { }
 *        This event is emitted when a client wishes to set the current value of one or more characteristics and/or
 *        subscribe to one or more events. The 'events' param is an initially-empty object, associated with the current
 *        connection, on which you may store event registration keys for later processing. The listener must call
 *        the provided callback when the request has been processed.
 */
export class HAPServer extends EventEmitter<Events> {

  static Types = TLVValues; // backwards compatibility
  static TLVValues = TLVValues;
  static Codes = Codes;
  static Status = Status;

  static handlers: Record<string, string> = {
    '/identify': '_handleIdentify',
    '/pair-setup': '_handlePair',
    '/pair-verify': '_handlePairVerify',
    '/pairings': '_handlePairings',
    '/accessories': '_handleAccessories',
    '/characteristics': '_handleCharacteristics',
    '/resource': '_handleResource'
  };

  _httpServer: EventedHTTPServer;
  _relayServer?: any;

  allowInsecureRequest: boolean;
  _keepAliveTimerID: NodeJS.Timeout;

  constructor(public accessoryInfo: any, public relayServer?: any) {
    super();
    this.accessoryInfo = accessoryInfo;
    this.allowInsecureRequest = false;
    // internal server that does all the actual communication
    this._httpServer = new EventedHTTPServer();
    this._httpServer.on(EventedHTTPServerEvents.LISTENING, this._onListening);
    this._httpServer.on(EventedHTTPServerEvents.REQUEST, this._onRequest);
    this._httpServer.on(EventedHTTPServerEvents.ENCRYPT, this._onEncrypt);
    this._httpServer.on(EventedHTTPServerEvents.DECRYPT, this._onDecrypt);
    this._httpServer.on(EventedHTTPServerEvents.SESSION_CLOSE, this._onSessionClose);
    if (relayServer) {
      this._relayServer = relayServer;
      this._relayServer.on('request', this._onRemoteRequest);
      this._relayServer.on('encrypt', this._onEncrypt);
      this._relayServer.on('decrypt', this._onDecrypt);
    }
    // so iOS is very reluctant to actually disconnect HAP connections (as in, sending a FIN packet).
    // For instance, if you turn off wifi on your phone, it will not close the connection, instead
    // it will leave it open and hope that it's still valid when it returns to the network. And Node,
    // by itself, does not ever "discover" that the connection has been closed behind it, until a
    // potentially very long system-level socket timeout (like, days). To work around this, we have
    // invented a manual "keepalive" mechanism where we send "empty" events perodicially, such that
    // when Node attempts to write to the socket, it discovers that it's been disconnected after
    // an additional one-minute timeout (this timeout appears to be hardcoded).
    this._keepAliveTimerID = setInterval(this._onKeepAliveTimerTick, 1000 * 60 * 10); // send keepalive every 10 minutes
  }

  listen = (port: number) => {
    this._httpServer.listen(port);
  }

  stop = () => {
    this._httpServer.stop();
    clearInterval(this._keepAliveTimerID);
  }

  _onKeepAliveTimerTick = () => {
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
  notifyClients = (event: string, data: any, excludeEvents?: Record<string, boolean>) => {
    // encode notification data as JSON, set content-type, and hand it off to the server.
    this._httpServer.sendEvent(event, JSON.stringify(data), "application/hap+json", excludeEvents);
    if (this._relayServer) {
      if (event !== 'keepalive') {
        this._relayServer.sendEvent(event, data, excludeEvents);
      }
    }
  }

  _onListening = (port: number) => {
    this.emit(HAPServerEventTypes.LISTENING, port);
  }

  // Called when an HTTP request was detected.
  _onRequest = (request: IncomingMessage, response: ServerResponse, session: Session, events: any) => {
    debug("[%s] HAP Request: %s %s", this.accessoryInfo.username, request.method, request.url);
    // collect request data, if any
    var requestData = bufferShim.alloc(0);
    request.on('data', (data) => {
      requestData = Buffer.concat([requestData, data]);
    });
    request.on('end', () => {
      // parse request.url (which can contain querystring, etc.) into components, then extract just the path
      var pathname = url.parse(request.url!).pathname!;
      // all request data received; now process this request
      for (var path in HAPServer.handlers)
        if (new RegExp('^' + path + '/?$').test(pathname)) { // match exact string and allow trailing slash
          const handler = HAPServer.handlers[path] as keyof HAPServer;
          this[handler](request, response, session, events, requestData);
          return;
        }
      // nobody handled this? reply 404
      debug("[%s] WARNING: Handler for %s not implemented", this.accessoryInfo.username, request.url);
      response.writeHead(404, "Not found", {'Content-Type': 'text/html'});
      response.end();
    });
  }

  _onRemoteRequest = (request: HapRequest, remoteSession: RemoteSession, session: Session, events: any) => {
    debug('[%s] Remote Request: %s', this.accessoryInfo.username, request.messageType);
    if (request.messageType === HapRequestMessageTypes.PAIR_VERIFY)
      this._handleRemotePairVerify(request, remoteSession, session);
    else if (request.messageType === HapRequestMessageTypes.DISCOVERY)
      this._handleRemoteAccessories(request, remoteSession, session);
    else if (request.messageType === HapRequestMessageTypes.WRITE_CHARACTERISTICS)
      this._handleRemoteCharacteristicsWrite(request, remoteSession, session, events);
    else if (request.messageType === HapRequestMessageTypes.READ_CHARACTERISTICS)
      this._handleRemoteCharacteristicsRead(request, remoteSession, session, events);
    else
      debug('[%s] Remote Request Detail: %s', this.accessoryInfo.username, require('util').inspect(request, {
        showHidden: false,
        depth: null
      }));
  }

  _onEncrypt = (data: Buffer, encrypted: { data: Buffer; }, session: Session) => {
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

  _onDecrypt = (data: Buffer, decrypted: { data: number | Buffer; }, session: Session) => {
    // possibly an instance of HAPEncryption (created in handlePairVerifyStepOne)
    var enc = session.encryption;
    // if controllerToAccessoryKey is not empty, then encryption is enabled for this connection.
    if (enc && enc.controllerToAccessoryKey.length > 0) {
      decrypted.data = encryption.layerDecrypt(data, enc.controllerToAccessoryCount, enc.controllerToAccessoryKey, enc.extraInfo);
    }
  }

  _onSessionClose = (sessionID: SessionIdentifier, events: any) => {
    this.emit(HAPServerEventTypes.SESSION_CLOSE, sessionID, events);
  }

  /**
   * Unpaired Accessory identification.
   */
  _handleIdentify = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: any) => {
    // /identify only works if the accesory is not paired
    if (!this.allowInsecureRequest && this.accessoryInfo.paired()) {
      response.writeHead(400, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }
    this.emit(HAPServerEventTypes.IDENTIFY, once((err: Error) => {
      if (!err) {
        debug("[%s] Identification success", this.accessoryInfo.username);
        response.writeHead(204);
        response.end();
      } else {
        debug("[%s] Identification error: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500);
        response.end();
      }
    }));
  }

  /**
   * iOS <-> Accessory pairing process.
   */
  _handlePair = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: Buffer) => {
    // Can only be directly paired with one iOS device
    if (!this.allowInsecureRequest && this.accessoryInfo.paired()) {
        response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, Codes.UNAVAILABLE));
        return;
    }
    var objects = tlv.decode(requestData);
    var sequence = objects[TLVValues.SEQUENCE_NUM][0]; // value is single byte with sequence number
    if (sequence == 0x01)
      this._handlePairStepOne(request, response, session);
    else if (sequence == 0x03)
      this._handlePairStepTwo(request, response, session, objects);
    else if (sequence == 0x05)
      this._handlePairStepThree(request, response, session, objects);
  }

  // M1 + M2
  _handlePairStepOne = (request: IncomingMessage, response: ServerResponse, session: Session) => {
    debug("[%s] Pair step 1/5", this.accessoryInfo.username);
    var salt = crypto.randomBytes(16);
    var srpParams = srp.params["3072"];
    srp.genKey(32, (error: Error, key: Buffer) => {
      // create a new SRP server
      var srpServer = new srp.Server(srpParams, bufferShim.from(salt), bufferShim.from("Pair-Setup"), bufferShim.from(this.accessoryInfo.pincode), key);
      var srpB = srpServer.computeB();
      // attach it to the current TCP session
      session.srpServer = srpServer;
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x02, TLVValues.SALT, salt, TLVValues.PUBLIC_KEY, srpB));
    });
  }

  // M3 + M4
  _handlePairStepTwo = (request: IncomingMessage, response: ServerResponse, session: Session, objects: Record<number, Buffer>) => {
    debug("[%s] Pair step 2/5", this.accessoryInfo.username);
    var A = objects[TLVValues.PUBLIC_KEY]; // "A is a public key that exists only for a single login session."
    var M1 = objects[TLVValues.PASSWORD_PROOF]; // "M1 is the proof that you actually know your own password."
    // pull the SRP server we created in stepOne out of the current session
    var srpServer = session.srpServer!;
    srpServer.setA(A);
    try {
      srpServer.checkM1(M1);
    } catch (err) {
      // most likely the client supplied an incorrect pincode.
      debug("[%s] Error while checking pincode: %s", this.accessoryInfo.username, err.message);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x04, TLVValues.ERROR_CODE, Codes.INVALID_REQUEST));
      return;
    }
    // "M2 is the proof that the server actually knows your password."
    var M2 = srpServer.computeM2();
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x04, TLVValues.PASSWORD_PROOF, M2));
  }

  // M5-1
  _handlePairStepThree = (request: IncomingMessage, response: ServerResponse, session: Session, objects: Record<number, Buffer>) => {
    debug("[%s] Pair step 3/5", this.accessoryInfo.username);
    // pull the SRP server we created in stepOne out of the current session
    var srpServer = session.srpServer!;
    var encryptedData = objects[TLVValues.ENCRYPTED_DATA];
    var messageData = bufferShim.alloc(encryptedData.length - 16);
    var authTagData = bufferShim.alloc(16);
    encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
    encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);
    var S_private = srpServer.computeK();
    var encSalt = bufferShim.from("Pair-Setup-Encrypt-Salt");
    var encInfo = bufferShim.from("Pair-Setup-Encrypt-Info");
    var outputKey = hkdf.HKDF("sha512", encSalt, S_private, encInfo, 32);
    var plaintextBuffer = bufferShim.alloc(messageData.length);
    encryption.verifyAndDecrypt(outputKey, bufferShim.from("PS-Msg05"), messageData, authTagData, null, plaintextBuffer);
    // decode the client payload and pass it on to the next step
    var M5Packet = tlv.decode(plaintextBuffer);
    var clientUsername = M5Packet[TLVValues.USERNAME];
    var clientLTPK = M5Packet[TLVValues.PUBLIC_KEY];
    var clientProof = M5Packet[TLVValues.PROOF];
    var hkdfEncKey = outputKey;
    this._handlePairStepFour(request, response, session, clientUsername, clientLTPK, clientProof, hkdfEncKey);
  }

  // M5-2
  _handlePairStepFour = (request: IncomingMessage, response: ServerResponse, session: Session, clientUsername: Buffer, clientLTPK: Buffer, clientProof: Buffer, hkdfEncKey: Buffer) => {
    debug("[%s] Pair step 4/5", this.accessoryInfo.username);
    var S_private = session.srpServer!.computeK();
    var controllerSalt = bufferShim.from("Pair-Setup-Controller-Sign-Salt");
    var controllerInfo = bufferShim.from("Pair-Setup-Controller-Sign-Info");
    var outputKey = hkdf.HKDF("sha512", controllerSalt, S_private, controllerInfo, 32);
    var completeData = Buffer.concat([outputKey, clientUsername, clientLTPK]);
    if (!tweetnacl.sign.detached.verify(completeData, clientProof, clientLTPK)) {
      debug("[%s] Invalid signature", this.accessoryInfo.username);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x06, TLVValues.ERROR_CODE, Codes.INVALID_REQUEST));
      return;
    }
    this._handlePairStepFive(request, response, session, clientUsername, clientLTPK, hkdfEncKey);
  }

  // M5 - F + M6
  _handlePairStepFive = (request: IncomingMessage, response: ServerResponse, session: Session, clientUsername: Buffer, clientLTPK: Buffer, hkdfEncKey: Buffer) => {
    debug("[%s] Pair step 5/5", this.accessoryInfo.username);
    var S_private = session.srpServer!.computeK();
    var accessorySalt = bufferShim.from("Pair-Setup-Accessory-Sign-Salt");
    var accessoryInfo = bufferShim.from("Pair-Setup-Accessory-Sign-Info");
    var outputKey = hkdf.HKDF("sha512", accessorySalt, S_private, accessoryInfo, 32);
    var serverLTPK = this.accessoryInfo.signPk;
    var usernameData = bufferShim.from(this.accessoryInfo.username);
    var material = Buffer.concat([outputKey, usernameData, serverLTPK]);
    var privateKey = bufferShim.from(this.accessoryInfo.signSk);
    var serverProof = tweetnacl.sign.detached(material, privateKey);
    var message = tlv.encode(TLVValues.USERNAME, usernameData, TLVValues.PUBLIC_KEY, serverLTPK, TLVValues.PROOF, serverProof);
    var ciphertextBuffer = bufferShim.alloc(message.length);
    var macBuffer = bufferShim.alloc(16);
    encryption.encryptAndSeal(hkdfEncKey, bufferShim.from("PS-Msg06"), message, null, ciphertextBuffer, macBuffer);
    // finally, notify listeners that we have been paired with a client
    this.emit(HAPServerEventTypes.PAIR, clientUsername.toString(), clientLTPK, once((err?: Error) => {
      if (err) {
        debug("[%s] Error adding pairing info: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500, "Server Error");
        response.end();
        return;
      }
      // send final pairing response to client
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x06, TLVValues.ENCRYPTED_DATA, Buffer.concat([ciphertextBuffer, macBuffer])));
    }));
  }

  /**
   * iOS <-> Accessory pairing verification.
   */
  _handlePairVerify = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: Buffer) => {
    var objects = tlv.decode(requestData);
    var sequence = objects[TLVValues.SEQUENCE_NUM][0]; // value is single byte with sequence number
    if (sequence == 0x01)
      this._handlePairVerifyStepOne(request, response, session, objects);
    else if (sequence == 0x03)
      this._handlePairVerifyStepTwo(request, response, session, events, objects);
  }

  _handlePairVerifyStepOne = (request: IncomingMessage, response: ServerResponse, session: Session, objects: Record<number, Buffer>) => {
    debug("[%s] Pair verify step 1/2", this.accessoryInfo.username);
    var clientPublicKey = objects[TLVValues.PUBLIC_KEY]; // Buffer
    // generate new encryption keys for this session
    var keyPair = encryption.generateCurve25519KeyPair();
    var secretKey = bufferShim.from(keyPair.secretKey);
    var publicKey = bufferShim.from(keyPair.publicKey);
    var sharedSec = bufferShim.from(encryption.generateCurve25519SharedSecKey(secretKey, clientPublicKey));
    var usernameData = bufferShim.from(this.accessoryInfo.username);
    var material = Buffer.concat([publicKey, usernameData, clientPublicKey]);
    var privateKey = bufferShim.from(this.accessoryInfo.signSk);
    var serverProof = tweetnacl.sign.detached(material, privateKey);
    var encSalt = bufferShim.from("Pair-Verify-Encrypt-Salt");
    var encInfo = bufferShim.from("Pair-Verify-Encrypt-Info");
    var outputKey = hkdf.HKDF("sha512", encSalt, sharedSec, encInfo, 32).slice(0, 32);
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
    var message = tlv.encode(TLVValues.USERNAME, usernameData, TLVValues.PROOF, serverProof);
    // encrypt the response
    var ciphertextBuffer = bufferShim.alloc(message.length);
    var macBuffer = bufferShim.alloc(16);
    encryption.encryptAndSeal(outputKey, bufferShim.from("PV-Msg02"), message, null, ciphertextBuffer, macBuffer);
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x02, TLVValues.ENCRYPTED_DATA, Buffer.concat([ciphertextBuffer, macBuffer]), TLVValues.PUBLIC_KEY, publicKey));
  }

  _handlePairVerifyStepTwo = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, objects: Record<number, Buffer>) => {
    debug("[%s] Pair verify step 2/2", this.accessoryInfo.username);
    var encryptedData = objects[TLVValues.ENCRYPTED_DATA];
    var messageData = bufferShim.alloc(encryptedData.length - 16);
    var authTagData = bufferShim.alloc(16);
    encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
    encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);
    var plaintextBuffer = bufferShim.alloc(messageData.length);
    // instance of HAPEncryption (created in handlePairVerifyStepOne)
    var enc = session.encryption!;
    if (!encryption.verifyAndDecrypt(enc.hkdfPairEncKey, bufferShim.from("PV-Msg03"), messageData, authTagData, null, plaintextBuffer)) {
      debug("[%s] M3: Invalid signature", this.accessoryInfo.username);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      return;
    }
    var decoded = tlv.decode(plaintextBuffer);
    var clientUsername = decoded[TLVValues.USERNAME];
    var proof = decoded[TLVValues.PROOF];
    var material = Buffer.concat([enc.clientPublicKey, clientUsername, enc.publicKey]);
    // since we're paired, we should have the public key stored for this client
    var clientPublicKey = this.accessoryInfo.getClientPublicKey(clientUsername.toString());
    // if we're not actually paired, then there's nothing to verify - this client thinks it's paired with us but we
    // disagree. Respond with invalid request (seems to match HomeKit Accessory Simulator behavior)
    if (!clientPublicKey) {
      debug("[%s] Client %s attempting to verify, but we are not paired; rejecting client", this.accessoryInfo.username, clientUsername);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      return;
    }
    if (!tweetnacl.sign.detached.verify(material, proof, clientPublicKey)) {
      debug("[%s] Client %s provided an invalid signature", this.accessoryInfo.username, clientUsername);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      return;
    }
    debug("[%s] Client %s verification complete", this.accessoryInfo.username, clientUsername);
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x04));
    // now that the client has been verified, we must "upgrade" our pesudo-HTTP connection to include
    // TCP-level encryption. We'll do this by adding some more encryption vars to the session, and using them
    // in future calls to onEncrypt, onDecrypt.
    var encSalt = bufferShim.from("Control-Salt");
    var infoRead = bufferShim.from("Control-Read-Encryption-Key");
    var infoWrite = bufferShim.from("Control-Write-Encryption-Key");
    enc.accessoryToControllerKey = hkdf.HKDF("sha512", encSalt, enc.sharedSec, infoRead, 32);
    enc.controllerToAccessoryKey = hkdf.HKDF("sha512", encSalt, enc.sharedSec, infoWrite, 32);
    // Our connection is now completely setup. We now want to subscribe this connection to special
    // "keepalive" events for detecting when connections are closed by the client.
    events['keepalive'] = true;
    session.establishSession(clientUsername.toString());
  }

  _handleRemotePairVerify = (request: HapRequest, remoteSession: RemoteSession, session: Session) => {
    var objects = tlv.decode(request.requestBody);
    var sequence = objects[TLVValues.SEQUENCE_NUM][0]; // value is single byte with sequence number
    if (sequence == 0x01)
      this._handleRemotePairVerifyStepOne(request, remoteSession, session, objects);
    else if (sequence == 0x03)
      this._handleRemotePairVerifyStepTwo(request, remoteSession, session, objects);
  }

  _handleRemotePairVerifyStepOne = (request: HapRequest, remoteSession: RemoteSession, session: Session, objects: Record<number, Buffer>) => {
    debug("[%s] Remote Pair verify step 1/2", this.accessoryInfo.username);
    var clientPublicKey = objects[TLVValues.PUBLIC_KEY]; // Buffer
    // generate new encryption keys for this session
    var keyPair = encryption.generateCurve25519KeyPair();
    var secretKey = bufferShim.from(keyPair.secretKey);
    var publicKey = bufferShim.from(keyPair.publicKey);
    var sharedSec = bufferShim.from(encryption.generateCurve25519SharedSecKey(secretKey, clientPublicKey));
    var usernameData = bufferShim.from(this.accessoryInfo.username);
    var material = Buffer.concat([publicKey, usernameData, clientPublicKey]);
    var privateKey = bufferShim.from(this.accessoryInfo.signSk);
    var serverProof = tweetnacl.sign.detached(material, privateKey);
    var encSalt = bufferShim.from("Pair-Verify-Encrypt-Salt");
    var encInfo = bufferShim.from("Pair-Verify-Encrypt-Info");
    var outputKey = hkdf.HKDF("sha512", encSalt, sharedSec, encInfo, 32).slice(0, 32);
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
    var message = tlv.encode(TLVValues.USERNAME, usernameData, TLVValues.PROOF, serverProof);
    // encrypt the response
    var ciphertextBuffer = bufferShim.alloc(message.length);
    var macBuffer = bufferShim.alloc(16);
    encryption.encryptAndSeal(outputKey, bufferShim.from("PV-Msg02"), message, null, ciphertextBuffer, macBuffer);
    var response = tlv.encode(TLVValues.SEQUENCE_NUM, 0x02, TLVValues.ENCRYPTED_DATA, Buffer.concat([ciphertextBuffer, macBuffer]), TLVValues.PUBLIC_KEY, publicKey);
    remoteSession.responseMessage(request, response);
  }

  _handleRemotePairVerifyStepTwo = (request: HapRequest, remoteSession: RemoteSession, session: Session, objects: Record<number, Buffer>) => {
    debug("[%s] Remote Pair verify step 2/2", this.accessoryInfo.username);
    var encryptedData = objects[TLVValues.ENCRYPTED_DATA];
    var messageData = bufferShim.alloc(encryptedData.length - 16);
    var authTagData = bufferShim.alloc(16);
    encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
    encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);
    var plaintextBuffer = bufferShim.alloc(messageData.length);
    // instance of HAPEncryption (created in handlePairVerifyStepOne)
    var enc = session.encryption!;
    if (!encryption.verifyAndDecrypt(enc.hkdfPairEncKey, bufferShim.from("PV-Msg03"), messageData, authTagData, null, plaintextBuffer)) {
      debug("[%s] M3: Invalid signature", this.accessoryInfo.username);
      var response = tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION);
      remoteSession.responseMessage(request, response);
      return;
    }
    var decoded = tlv.decode(plaintextBuffer);
    var clientUsername = decoded[TLVValues.USERNAME];
    var proof = decoded[TLVValues.PROOF];
    var material = Buffer.concat([enc.clientPublicKey, clientUsername, enc.publicKey]);
    // since we're paired, we should have the public key stored for this client
    var clientPublicKey = this.accessoryInfo.getClientPublicKey(clientUsername.toString());
    // if we're not actually paired, then there's nothing to verify - this client thinks it's paired with us but we
    // disagree. Respond with invalid request (seems to match HomeKit Accessory Simulator behavior)
    if (!clientPublicKey) {
      debug("[%s] Client %s attempting to verify, but we are not paired; rejecting client", this.accessoryInfo.username, clientUsername);
      var response = tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION);
      remoteSession.responseMessage(request, response);
      return;
    }
    if (!tweetnacl.sign.detached.verify(material, proof, clientPublicKey)) {
      debug("[%s] Client %s provided an invalid signature", this.accessoryInfo.username, clientUsername);
      var response = tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION);
      remoteSession.responseMessage(request, response);
      return;
    }
    debug("[%s] Client %s verification complete", this.accessoryInfo.username, clientUsername);
    var encSalt = bufferShim.from("Control-Salt");
    var infoRead = bufferShim.from("Control-Read-Encryption-Key");
    var infoWrite = bufferShim.from("Control-Write-Encryption-Key");
    enc.accessoryToControllerKey = hkdf.HKDF("sha512", encSalt, enc.sharedSec, infoRead, 32);
    enc.controllerToAccessoryKey = hkdf.HKDF("sha512", encSalt, enc.sharedSec, infoWrite, 32);
    var response = tlv.encode(TLVValues.SEQUENCE_NUM, 0x04);
    remoteSession.responseMessage(request, response);
  }

  /**
   * Pair add/remove/list
   */
  _handlePairings = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: Buffer) => {
    // Only accept /pairing request if there is a secure session
    if (!this.allowInsecureRequest && !session.encryption) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }

    const objects = tlv.decode(requestData);
    const method = objects[TLVValues.METHOD][0]; // value is single byte with request type

    const state = objects[TLVValues.STATE][0];
    if (state !== States.M1) {
      return;
    }

    if (method === Methods.ADD_PAIRING) {
      const identifier = objects[TLVValues.IDENTIFIER].toString();
      const publicKey = objects[TLVValues.PUBLIC_KEY];
      const permissions = objects[TLVValues.PERMISSIONS][0] as PermissionTypes;

      this.emit(HAPServerEventTypes.ADD_PAIRING, session, identifier, publicKey, permissions, once((errorCode: number, data?: void) => {
        if (errorCode > 0) {
          debug("[%s] Pairings: failed ADD_PAIRING with code %d", this.accessoryInfo.username, errorCode);
          response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
          response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, errorCode));
          return;
        }

        response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(tlv.encode(TLVValues.STATE, States.M2));
        debug("[%s] Pairings: successfully executed ADD_PAIRING", this.accessoryInfo.username);
      }));
    } else if (method === Methods.REMOVE_PAIRING) {
      const identifier = objects[TLVValues.IDENTIFIER].toString();

      this.emit(HAPServerEventTypes.REMOVE_PAIRING, session, identifier, once((errorCode: number, data?: void) => {
        if (errorCode > 0) {
          debug("[%s] Pairings: failed REMOVE_PAIRING with code %d", this.accessoryInfo.username, errorCode);
          response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
          response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, errorCode));
          return;
        }

        response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(tlv.encode(TLVValues.STATE, States.M2));
        debug("[%s] Pairings: successfully executed REMOVE_PAIRING", this.accessoryInfo.username);
      }));
    } else if (method === Methods.LIST_PAIRINGS) {
      this.emit(HAPServerEventTypes.LIST_PAIRINGS, session, once((errorCode: number, data?: PairingInformation[]) => {
        if (errorCode > 0) {
          debug("[%s] Pairings: failed LIST_PAIRINGS with code %d", this.accessoryInfo.username, errorCode);
          response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
          response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, errorCode));
          return;
        }

        const tlvList = [] as any[];
        data!.forEach((value: PairingInformation, index: number) => {
          if (index > 0) {
            tlvList.push(TLVValues.SEPARATOR, Buffer.alloc(0));
          }

          tlvList.push(
              TLVValues.IDENTIFIER, value.username,
              TLVValues.PUBLIC_KEY, value.publicKey,
              TLVValues.PERMISSIONS, value.permission
          );
        });

        const list = tlv.encode(TLVValues.STATE, States.M2, ...tlvList);
        response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(list);
        debug("[%s] Pairings: successfully executed LIST_PAIRINGS", this.accessoryInfo.username);
      }));
    }
  }

  /*
   * Handlers for all after-pairing communication, or the bulk of HAP.
   */

  // Called when the client wishes to fetch all data regarding our published Accessories.
  _handleAccessories = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: any) => {
    if (!this.allowInsecureRequest && !session.encryption) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }
    // call out to listeners to retrieve the latest accessories JSON
    this.emit(HAPServerEventTypes.ACCESSORIES, once((err: Error, accessories: Accessory[]) => {
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

  _handleRemoteAccessories = (request: HapRequest, remoteSession: RemoteSession, session: Session) => {
    var deserializedRequest = JSON.parse(request.requestBody);
    if (!deserializedRequest['attribute-database']) {
      var response = {
        'configuration-number': this.accessoryInfo.configVersion
      };
      remoteSession.responseMessage(request, bufferShim.from(JSON.stringify(response)));
    } else {
      var self = this;
      // call out to listeners to retrieve the latest accessories JSON
      this.emit(HAPServerEventTypes.ACCESSORIES, once((err: Error, accessories: Accessory[]) => {
        if (err) {
          debug("[%s] Error getting accessories: %s", this.accessoryInfo.username, err.message);
          return;
        }
        var response = {
          'configuration-number': self.accessoryInfo.configVersion,
          'attribute-database': accessories
        };
        remoteSession.responseMessage(request, bufferShim.from(JSON.stringify(response)));
      }));
    }
  }

  // Called when the client wishes to get or set particular characteristics
  _handleCharacteristics = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: { length: number; toString: () => string; }) => {
    if (!this.allowInsecureRequest && !session.encryption) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }

    type Characteristics = Pick<CharacteristicData, 'aid' | 'iid'> & {
      status?: any;
    };

    if (request.method == "GET") {
      // Extract the query params from the URL which looks like: /characteristics?id=1.9,2.14,...
      var parseQueryString = true;
      var query = url.parse(request.url!, parseQueryString).query; // { id: '1.9,2.14' }
      if (query == undefined || query.id == undefined) {
        response.writeHead(500);
        response.end();
        return;
      }
      var sets = (query.id as string).split(','); // ["1.9","2.14"]
      var data: CharacteristicData[] = []; // [{aid:1,iid:9},{aid:2,iid:14}]
      for (var i in sets) {
        var ids = sets[i].split('.'); // ["1","9"]
        var aid = parseInt(ids[0]); // accessory ID
        var iid = parseInt(ids[1]); // instance ID (for characteristic)
        data.push({aid: aid, iid: iid});
      }
      this.emit(HAPServerEventTypes.GET_CHARACTERISTICS, data, events, once((err: Error, characteristics: CharacteristicData[]) => {
        if (!characteristics && !err)
          err = new Error("characteristics not supplied by the get-characteristics event callback");
        if (err) {
          debug("[%s] Error getting characteristics: %s", this.accessoryInfo.username, err.stack);
          // rewrite characteristics array to include error status for each characteristic requested
          characteristics = [];
          for (var i in data) {
            characteristics.push({
              aid: data[i].aid,
              iid: data[i].iid,
              status: Status.SERVICE_COMMUNICATION_FAILURE
            });
          }
        }

        let errorOccurred = false;
        for (let i = 0; i < characteristics.length; i++) {
          const value = characteristics[i];
          if ((value.status !== undefined && value.status !== 0)
              || (value.s !== undefined && value.s !== 0)) {
            errorOccurred = true;
            break;
          }
        }

        // 207 "multi-status" is returned when an error occurs reading a characteristic. otherwise 200 is returned
        response.writeHead(errorOccurred? 207: 200, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({characteristics: characteristics}));
      }), false, session.sessionID);
    } else if (request.method == "PUT") {
      if (!session.encryption) {
        if (!request.headers || (request.headers && request.headers["authorization"] !== this.accessoryInfo.pincode)) {
          response.writeHead(470, {"Content-Type": "application/hap+json"});
          response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
          return;
        }
      }
      if (requestData.length == 0) {
        response.writeHead(400, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({status: Status.INVALID_VALUE_IN_REQUEST}));
        return;
      }
      // requestData is a JSON payload like { characteristics: [ { aid: 1, iid: 8, value: true, ev: true } ] }
      var data = JSON.parse(requestData.toString()).characteristics as CharacteristicData[]; // pull out characteristics array
      // call out to listeners to retrieve the latest accessories JSON
      this.emit(HAPServerEventTypes.SET_CHARACTERISTICS, data, events, once((err: Error, characteristics: CharacteristicData[]) => {
        if (err) {
          debug("[%s] Error setting characteristics: %s", this.accessoryInfo.username, err.message);
          // rewrite characteristics array to include error status for each characteristic requested
          characteristics = [];
          for (var i in data) {
            characteristics.push({
              aid: data[i].aid,
              iid: data[i].iid,
              // @ts-ignore
              status: Status.SERVICE_COMMUNICATION_FAILURE
            });
          }
        }

        let multiStatus = false;
        for (let i = 0; i < characteristics.length; i++) {
          const characteristic = characteristics[i];
          if ((characteristic.status !== undefined && characteristic.status !== 0)
              || (characteristic.s !== undefined && characteristic.s !== 0)
              || characteristic.value !== undefined) { // also send multiStatus on write response requests
            multiStatus = true;
            break;
          }
        }

        if (multiStatus) {
          // 207 is "multi-status" since HomeKit may be setting multiple things and any one can fail independently
          response.writeHead(207, {"Content-Type": "application/hap+json"});
          response.end(JSON.stringify({characteristics: characteristics}));
        } else {
          // if everything went fine send 204 no content response
          response.writeHead(204); // 204 "No content"
          response.end();
        }
      }), false, session.sessionID);
    }
  }

  // Called when controller request snapshot
  _handleResource = (request: IncomingMessage, response: ServerResponse, session: Session, events: any, requestData: { length: number; toString: () => string; }) => {
    if (!this.allowInsecureRequest && !session.encryption) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }
    if (request.method == "POST") {
      if (!session.encryption) {
        if (!request.headers || (request.headers && request.headers["authorization"] !== this.accessoryInfo.pincode)) {
          response.writeHead(470, {"Content-Type": "application/hap+json"});
          response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
          return;
        }
      }
      if (requestData.length == 0) {
        response.writeHead(400, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({status: Status.INVALID_VALUE_IN_REQUEST}));
        return;
      }
      // requestData is a JSON payload
      var data = JSON.parse(requestData.toString());
      // call out to listeners to retrieve the resource, snapshot only right now
      this.emit(HAPServerEventTypes.REQUEST_RESOURCE, data, once((err: Error, resource: any) => {
        if (err) {
          debug("[%s] Error getting snapshot: %s", this.accessoryInfo.username, err.message);
          response.writeHead(405);
          response.end();
        } else {
          response.writeHead(200, {"Content-Type": "image/jpeg"});
          response.end(resource);
        }
      }));
    } else {
      response.writeHead(405);
      response.end();
    }
  }

  _handleRemoteCharacteristicsWrite = (request: HapRequest, remoteSession: RemoteSession, session: Session, events: any) => {
    var data = JSON.parse(request.requestBody.toString());
    // call out to listeners to retrieve the latest accessories JSON
    this.emit(HAPServerEventTypes.SET_CHARACTERISTICS, data, events, once((err: Error, characteristics: CharacteristicData[]) => {
      if (err) {
        debug("[%s] Error setting characteristics: %s", this.accessoryInfo.username, err.message);
        // rewrite characteristics array to include error status for each characteristic requested
        characteristics = [];
        for (var i in data) {
          characteristics.push({
            aid: data[i].aid,
            iid: data[i].iid,
            s: Status.SERVICE_COMMUNICATION_FAILURE
          } as any);
        }
      }
      remoteSession.responseMessage(request, bufferShim.from(JSON.stringify(characteristics)));
    }), true);
  }

  _handleRemoteCharacteristicsRead = (request: HapRequest, remoteSession: RemoteSession, session: Session, events: any) => {
    var data = JSON.parse(request.requestBody.toString());
    this.emit(HAPServerEventTypes.GET_CHARACTERISTICS, data, events, (err: Error, characteristics: CharacteristicData[]) => {
      if (!characteristics && !err)
        err = new Error("characteristics not supplied by the get-characteristics event callback");
      if (err) {
        debug("[%s] Error getting characteristics: %s", this.accessoryInfo.username, err.stack);
        // rewrite characteristics array to include error status for each characteristic requested
        characteristics = [];
        for (var i in data) {
          characteristics.push({
            aid: data[i].aid,
            iid: data[i].iid,
            s: Status.SERVICE_COMMUNICATION_FAILURE
          } as any);
        }
      }
      remoteSession.responseMessage(request, bufferShim.from(JSON.stringify(characteristics)));
    }, true);
  }
}


/**
 * Simple struct to hold vars needed to support HAP encryption.
 */

export class HAPEncryption {

  clientPublicKey: Buffer;
  secretKey: Buffer;
  publicKey: Buffer;
  sharedSec: Buffer;
  hkdfPairEncKey: Buffer;
  accessoryToControllerCount: { value: number; };
  controllerToAccessoryCount: { value: number; };
  accessoryToControllerKey: Buffer;
  controllerToAccessoryKey: Buffer;
  extraInfo: Record<string, any>;

  constructor() {
    // initialize member vars with null-object values
    this.clientPublicKey = bufferShim.alloc(0);
    this.secretKey = bufferShim.alloc(0);
    this.publicKey = bufferShim.alloc(0);
    this.sharedSec = bufferShim.alloc(0);
    this.hkdfPairEncKey = bufferShim.alloc(0);
    this.accessoryToControllerCount = { value: 0 };
    this.controllerToAccessoryCount = { value: 0 };
    this.accessoryToControllerKey = bufferShim.alloc(0);
    this.controllerToAccessoryKey = bufferShim.alloc(0);
    this.extraInfo = {};
  }
}
