import crypto from 'crypto';
import createDebug from 'debug';
import { SRP, SrpServer } from "fast-srp-hap";
import { IncomingMessage, ServerResponse } from "http";
import tweetnacl from 'tweetnacl';
import { URL } from 'url';
import {
  CharacteristicId,
  CharacteristicsReadRequest,
  CharacteristicsReadResponse,
  CharacteristicsWriteRequest,
  CharacteristicsWriteResponse,
  consideredTrue,
  PrepareWriteRequest
} from "../internal-types";
import { NodeCallback, PairingsCallback, SessionIdentifier, VoidCallback } from '../types';
import { Accessory, CharacteristicEvents, Resource } from './Accessory';
import { EventEmitter } from './EventEmitter';
import { PairingInformation, PermissionTypes } from "./model/AccessoryInfo";
import { EventedHTTPServer, EventedHTTPServerEvents, HAPSession } from './util/eventedhttp';
import * as hapCrypto from './util/hapCrypto';
import { once } from './util/once';
import * as tlv from './util/tlv';

const debug = createDebug('HAP-NodeJS:HAPServer');

const enum TLVValues {
  // noinspection JSUnusedGlobalSymbols
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

const enum Methods {
  // noinspection JSUnusedGlobalSymbols
  PAIR_SETUP = 0x00,
  PAIR_SETUP_WITH_AUTH = 0x01,
  PAIR_VERIFY = 0x02,
  ADD_PAIRING = 0x03,
  REMOVE_PAIRING = 0x04,
  LIST_PAIRINGS = 0x05
}

const enum States {
  M1 = 0x01,
  M2 = 0x02,
  M3 = 0x03,
  M4 = 0x04,
  M5 = 0x05,
  M6 = 0x06
}

export const enum Codes {
  // noinspection JSUnusedGlobalSymbols
  UNKNOWN = 0x01,
  INVALID_REQUEST = 0x02,
  AUTHENTICATION = 0x02, // setup code or signature verification failed
  BACKOFF = 0x03, // // client must look at retry delay tlv item
  MAX_PEERS = 0x04, // server cannot accept any more pairings
  MAX_TRIES = 0x05, // server reached maximum number of authentication attempts
  UNAVAILABLE = 0x06, // server pairing method is unavailable
  BUSY = 0x07 // cannot accept pairing request at this time
}

export const enum Status {
  // noinspection JSUnusedGlobalSymbols
  SUCCESS = 0,
  INSUFFICIENT_PRIVILEGES = -70401,
  SERVICE_COMMUNICATION_FAILURE = -70402,
  RESOURCE_BUSY = -70403,
  READ_ONLY_CHARACTERISTIC = -70404, // cannot write to read only
  WRITE_ONLY_CHARACTERISTIC = -70405, // cannot read from write only
  NOTIFICATION_NOT_SUPPORTED = -70406,
  OUT_OF_RESOURCE = -70407,
  OPERATION_TIMED_OUT = -70408,
  RESOURCE_DOES_NOT_EXIST = -70409,
  INVALID_VALUE_IN_REQUEST = -70410,
  INSUFFICIENT_AUTHORIZATION = -70411,
  NOT_ALLOWED_IN_CURRENT_STATE = -70412,

  // when adding new status codes, remember to change upper bound in extractHAPStatusFromError
}

export const enum HAPServerEventTypes {
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
  [HAPServerEventTypes.LISTENING]: (port: number, hostname: string) => void;
  [HAPServerEventTypes.PAIR]: (clientUsername: string, clientLTPK: Buffer, cb: VoidCallback) => void;
  [HAPServerEventTypes.ADD_PAIRING]: (controller: HAPSession, username: string, publicKey: Buffer, permission: number, callback: PairingsCallback<void>) => void;
  [HAPServerEventTypes.REMOVE_PAIRING]: (controller: HAPSession, username: string, callback: PairingsCallback<void>) => void;
  [HAPServerEventTypes.LIST_PAIRINGS]: (controller: HAPSession, callback: PairingsCallback<PairingInformation[]>) => void;
  [HAPServerEventTypes.ACCESSORIES]: (cb: NodeCallback<Accessory[]>) => void;
  [HAPServerEventTypes.GET_CHARACTERISTICS]: (
    request: CharacteristicsReadRequest,
    session: HAPSession,
    events: CharacteristicEvents,
    callback: (response: CharacteristicsReadResponse) => void,
  ) => void;
  [HAPServerEventTypes.SET_CHARACTERISTICS]: (
    writeRequest: CharacteristicsWriteRequest,
    session: HAPSession,
    events: CharacteristicEvents,
    callback: (response: CharacteristicsWriteResponse) => void,
  ) => void;
  [HAPServerEventTypes.SESSION_CLOSE]: (sessionID: SessionIdentifier, events: CharacteristicEvents) => void;
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

  static handlers: Record<string, keyof HAPServer> = {
    '/identify': '_handleIdentify',
    '/pair-setup': '_handlePair',
    '/pair-verify': '_handlePairVerify',
    '/pairings': '_handlePairings',
    '/accessories': '_handleAccessories',
    '/characteristics': '_handleCharacteristics',
    '/prepare': '_prepareWrite',
    '/resource': '_handleResource'
  };

  _httpServer: EventedHTTPServer;
  private unsuccessfulPairAttempts: number = 0; // after 100 unsuccessful attempts the server won't accept any further attempts. Will currently be reset on a reboot

  allowInsecureRequest: boolean;
  _keepAliveTimerID: NodeJS.Timeout;

  constructor(public accessoryInfo: any) {
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

    // so iOS is very reluctant to actually disconnect HAP connections (as in, sending a FIN packet).
    // For instance, if you turn off wifi on your phone, it will not close the connection, instead
    // it will leave it open and hope that it's still valid when it returns to the network. And Node,
    // by itself, does not ever "discover" that the connection has been closed behind it, until a
    // potentially very long system-level socket timeout (like, days). To work around this, we have
    // invented a manual "keepalive" mechanism where we send "empty" events periodically, such that
    // when Node attempts to write to the socket, it discovers that it's been disconnected after
    // an additional one-minute timeout (this timeout appears to be hardcoded).
    this._keepAliveTimerID = setInterval(this._onKeepAliveTimerTick, 1000 * 60 * 10); // send keepalive every 10 minutes
  }

  listen = (port: number = 0, host?: string) => {
    this._httpServer.listen(port, host);
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
  }

  _onListening = (port: number, hostname: string) => {
    this.emit(HAPServerEventTypes.LISTENING, port, hostname);
  }

  // Called when an HTTP request was detected.
  _onRequest = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: CharacteristicEvents) => {
    debug("[%s] HAP Request: %s %s", this.accessoryInfo.username, request.method, request.url);
    // collect request data, if any
    let requestData = Buffer.alloc(0);
    request.on('data', (data) => {
      requestData = Buffer.concat([requestData, data]);
    });
    request.on('end', () => {
      // parse request.url (which can contain querystring, etc.) into components, then extract just the path
      const url = new URL(request.url!, "http://hap-nodejs.local");
      // all request data received; now process this request
      for (let path in HAPServer.handlers)
        if (new RegExp('^' + path + '/?$').test(url.pathname)) { // match exact string and allow trailing slash
          const handler = HAPServer.handlers[path];
          this[handler](request, response, session, events, requestData);
          return;
        }
      // nobody handled this? reply 404
      debug("[%s] WARNING: Handler for %s not implemented", this.accessoryInfo.username, request.url);
      response.writeHead(404, "Not found", {'Content-Type': 'text/html'});
      response.end();
    });
  }

  _onEncrypt = (data: Buffer, encrypted: { data: Buffer; }, session: HAPSession) => {
    // instance of HAPEncryption (created in handlePairVerifyStepOne)
    const enc = session.encryption;
    // if accessoryToControllerKey is not empty, then encryption is enabled for this connection. However, we'll
    // need to be careful to ensure that we don't encrypt the last few bytes of the response from handlePairVerifyStepTwo.
    // Since all communication calls are asynchronous, we could easily receive this 'encrypt' event for those bytes.
    // So we want to make sure that we aren't encrypting data until we have *received* some encrypted data from the
    // client first.
    if (enc && enc.accessoryToControllerKey.length > 0 && enc.controllerToAccessoryCount.value > 0) {
      encrypted.data = hapCrypto.layerEncrypt(data, enc.accessoryToControllerCount, enc.accessoryToControllerKey);
    }
  }

  _onDecrypt = (data: Buffer, decrypted: { data: number | Buffer; error: Error | null }, session: HAPSession) => {
    // possibly an instance of HAPEncryption (created in handlePairVerifyStepOne)
    const enc = session.encryption;
    // if controllerToAccessoryKey is not empty, then encryption is enabled for this connection.
    if (enc && enc.controllerToAccessoryKey.length > 0) {
      try {
        decrypted.data = hapCrypto.layerDecrypt(data, enc.controllerToAccessoryCount, enc.controllerToAccessoryKey, enc.extraInfo);
      } catch (error) {
        decrypted.error = error;
      }
    }
  }

  _onSessionClose = (sessionID: SessionIdentifier, events: any) => {
    this.emit(HAPServerEventTypes.SESSION_CLOSE, sessionID, events);
  }

  /**
   * Unpaired Accessory identification.
   */
  _handleIdentify = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: any) => {
    // /identify only works if the accessory is not paired
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
  _handlePair = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: Buffer) => {
    // Can only be directly paired with one iOS device
    if (!this.allowInsecureRequest && this.accessoryInfo.paired()) {
        response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
        response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, Codes.UNAVAILABLE));
        return;
    }
    if (this.unsuccessfulPairAttempts > 100) {
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, Codes.MAX_TRIES));
      return;
    }

    const objects = tlv.decode(requestData);
    const sequence = objects[TLVValues.SEQUENCE_NUM][0]; // value is single byte with sequence number
    if (sequence == States.M1)
      this._handlePairStepOne(request, response, session);
    else if (sequence == States.M3 && session._pairSetupState === States.M2)
      this._handlePairStepTwo(request, response, session, objects);
    else if (sequence == States.M5 && session._pairSetupState === States.M4)
      this._handlePairStepThree(request, response, session, objects);
    else {
      // Invalid state/sequence number
      response.writeHead(400, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, sequence + 1, TLVValues.ERROR_CODE, Codes.UNKNOWN));
      return;
    }
  }

  // M1 + M2
  _handlePairStepOne = (request: IncomingMessage, response: ServerResponse, session: HAPSession) => {
    debug("[%s] Pair step 1/5", this.accessoryInfo.username);
    const salt = crypto.randomBytes(16, );

    const srpParams = SRP.params.hap;
    SRP.genKey(32).then(key => {
      // create a new SRP server
      const srpServer = new SrpServer(srpParams, salt, Buffer.from("Pair-Setup"), Buffer.from(this.accessoryInfo.pincode), key)
      const srpB = srpServer.computeB();
      // attach it to the current TCP session
      session.srpServer = srpServer;
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, States.M2, TLVValues.SALT, salt, TLVValues.PUBLIC_KEY, srpB));
      session._pairSetupState = States.M2;
    }).catch(error => {
      debug("[%s] Error occurred when generating srp key: %s", this.accessoryInfo.username, error.message);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, States.M2, TLVValues.ERROR_CODE, Codes.UNKNOWN));
      return;
    });
  }

  // M3 + M4
  _handlePairStepTwo = (request: IncomingMessage, response: ServerResponse, session: HAPSession, objects: Record<number, Buffer>) => {
    debug("[%s] Pair step 2/5", this.accessoryInfo.username);
    const A = objects[TLVValues.PUBLIC_KEY]; // "A is a public key that exists only for a single login session."
    const M1 = objects[TLVValues.PASSWORD_PROOF]; // "M1 is the proof that you actually know your own password."
    // pull the SRP server we created in stepOne out of the current session
    const srpServer = session.srpServer!;
    srpServer.setA(A);
    try {
      srpServer.checkM1(M1);
    } catch (err) {
      // most likely the client supplied an incorrect pincode.
      this.unsuccessfulPairAttempts++;
      debug("[%s] Error while checking pincode: %s", this.accessoryInfo.username, err.message);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      session._pairSetupState = undefined;
      return;
    }
    // "M2 is the proof that the server actually knows your password."
    const M2 = srpServer.computeM2();
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(TLVValues.SEQUENCE_NUM, States.M4, TLVValues.PASSWORD_PROOF, M2));
    session._pairSetupState = States.M4;
  }

  // M5-1
  _handlePairStepThree = (request: IncomingMessage, response: ServerResponse, session: HAPSession, objects: Record<number, Buffer>) => {
    debug("[%s] Pair step 3/5", this.accessoryInfo.username);
    // pull the SRP server we created in stepOne out of the current session
    const srpServer = session.srpServer!;
    const encryptedData = objects[TLVValues.ENCRYPTED_DATA];
    const messageData = Buffer.alloc(encryptedData.length - 16);
    const authTagData = Buffer.alloc(16);
    encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
    encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);
    const S_private = srpServer.computeK();
    const encSalt = Buffer.from("Pair-Setup-Encrypt-Salt");
    const encInfo = Buffer.from("Pair-Setup-Encrypt-Info");
    const outputKey = hapCrypto.HKDF("sha512", encSalt, S_private, encInfo, 32);

    let plaintext;
    try {
      plaintext = hapCrypto.chacha20_poly1305_decryptAndVerify(outputKey, Buffer.from("PS-Msg05"), null, messageData, authTagData);
    } catch (error) {
      debug("[%s] Error while decrypting and verifying M5 subTlv: %s", this.accessoryInfo.username);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      session._pairSetupState = undefined;
      return;
    }
    // decode the client payload and pass it on to the next step
    const M5Packet = tlv.decode(plaintext);
    const clientUsername = M5Packet[TLVValues.USERNAME];
    const clientLTPK = M5Packet[TLVValues.PUBLIC_KEY];
    const clientProof = M5Packet[TLVValues.PROOF];
    this._handlePairStepFour(request, response, session, clientUsername, clientLTPK, clientProof, outputKey);
  }

  // M5-2
  _handlePairStepFour = (request: IncomingMessage, response: ServerResponse, session: HAPSession, clientUsername: Buffer, clientLTPK: Buffer, clientProof: Buffer, hkdfEncKey: Buffer) => {
    debug("[%s] Pair step 4/5", this.accessoryInfo.username);
    const S_private = session.srpServer!.computeK();
    const controllerSalt = Buffer.from("Pair-Setup-Controller-Sign-Salt");
    const controllerInfo = Buffer.from("Pair-Setup-Controller-Sign-Info");
    const outputKey = hapCrypto.HKDF("sha512", controllerSalt, S_private, controllerInfo, 32);
    const completeData = Buffer.concat([outputKey, clientUsername, clientLTPK]);
    if (!tweetnacl.sign.detached.verify(completeData, clientProof, clientLTPK)) {
      debug("[%s] Invalid signature", this.accessoryInfo.username);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, States.M6, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      session._pairSetupState = undefined;
      return;
    }
    this._handlePairStepFive(request, response, session, clientUsername, clientLTPK, hkdfEncKey);
  }

  // M5 - F + M6
  _handlePairStepFive = (request: IncomingMessage, response: ServerResponse, session: HAPSession, clientUsername: Buffer, clientLTPK: Buffer, hkdfEncKey: Buffer) => {
    debug("[%s] Pair step 5/5", this.accessoryInfo.username);
    const S_private = session.srpServer!.computeK();
    const accessorySalt = Buffer.from("Pair-Setup-Accessory-Sign-Salt");
    const accessoryInfo = Buffer.from("Pair-Setup-Accessory-Sign-Info");
    const outputKey = hapCrypto.HKDF("sha512", accessorySalt, S_private, accessoryInfo, 32);
    const serverLTPK = this.accessoryInfo.signPk;
    const usernameData = Buffer.from(this.accessoryInfo.username);
    const material = Buffer.concat([outputKey, usernameData, serverLTPK]);
    const privateKey = Buffer.from(this.accessoryInfo.signSk);
    const serverProof = tweetnacl.sign.detached(material, privateKey);
    const message = tlv.encode(TLVValues.USERNAME, usernameData, TLVValues.PUBLIC_KEY, serverLTPK, TLVValues.PROOF, serverProof);

    const encrypted = hapCrypto.chacha20_poly1305_encryptAndSeal(hkdfEncKey, Buffer.from("PS-Msg06"), null, message);

    // finally, notify listeners that we have been paired with a client
    this.emit(HAPServerEventTypes.PAIR, clientUsername.toString(), clientLTPK, once((err?: Error) => {
      if (err) {
        debug("[%s] Error adding pairing info: %s", this.accessoryInfo.username, err.message);
        response.writeHead(500, "Server Error");
        response.end();
        session._pairSetupState = undefined;
        return;
      }
      // send final pairing response to client
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x06, TLVValues.ENCRYPTED_DATA, Buffer.concat([encrypted.ciphertext, encrypted.authTag])));
      session._pairSetupState = undefined;
    }));
  }

  /**
   * iOS <-> Accessory pairing verification.
   */
  _handlePairVerify = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: Buffer) => {
    const objects = tlv.decode(requestData);
    const sequence = objects[TLVValues.SEQUENCE_NUM][0]; // value is single byte with sequence number
    if (sequence == States.M1)
      this._handlePairVerifyStepOne(request, response, session, objects);
    else if (sequence == States.M3 && session._pairVerifyState === States.M2)
      this._handlePairVerifyStepTwo(request, response, session, events, objects);
    else {
      // Invalid state/sequence number
      response.writeHead(400, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, sequence + 1, TLVValues.ERROR_CODE, Codes.UNKNOWN));
      return;
    }
  }

  _handlePairVerifyStepOne = (request: IncomingMessage, response: ServerResponse, session: HAPSession, objects: Record<number, Buffer>) => {
    debug("[%s] Pair verify step 1/2", this.accessoryInfo.username);
    const clientPublicKey = objects[TLVValues.PUBLIC_KEY]; // Buffer
    // generate new encryption keys for this session
    const keyPair = hapCrypto.generateCurve25519KeyPair();
    const secretKey = Buffer.from(keyPair.secretKey);
    const publicKey = Buffer.from(keyPair.publicKey);
    const sharedSec = Buffer.from(hapCrypto.generateCurve25519SharedSecKey(secretKey, clientPublicKey));
    const usernameData = Buffer.from(this.accessoryInfo.username);
    const material = Buffer.concat([publicKey, usernameData, clientPublicKey]);
    const privateKey = Buffer.from(this.accessoryInfo.signSk);
    const serverProof = tweetnacl.sign.detached(material, privateKey);
    const encSalt = Buffer.from("Pair-Verify-Encrypt-Salt");
    const encInfo = Buffer.from("Pair-Verify-Encrypt-Info");
    const outputKey = hapCrypto.HKDF("sha512", encSalt, sharedSec, encInfo, 32).slice(0, 32);
    // store keys in a new instance of HAPEncryption
    const enc = new HAPEncryption();
    enc.clientPublicKey = clientPublicKey;
    enc.secretKey = secretKey;
    enc.publicKey = publicKey;
    enc.sharedSec = sharedSec;
    enc.hkdfPairEncKey = outputKey;
    // store this in the current TCP session
    session.encryption = enc;
    // compose the response data in TLV format
    const message = tlv.encode(TLVValues.USERNAME, usernameData, TLVValues.PROOF, serverProof);

    const encrypted = hapCrypto.chacha20_poly1305_encryptAndSeal(outputKey, Buffer.from("PV-Msg02"), null, message);

    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(TLVValues.SEQUENCE_NUM, States.M2, TLVValues.ENCRYPTED_DATA, Buffer.concat([encrypted.ciphertext, encrypted.authTag]), TLVValues.PUBLIC_KEY, publicKey));
    session._pairVerifyState = States.M2;
  }

  _handlePairVerifyStepTwo = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, objects: Record<number, Buffer>) => {
    debug("[%s] Pair verify step 2/2", this.accessoryInfo.username);
    const encryptedData = objects[TLVValues.ENCRYPTED_DATA];
    const messageData = Buffer.alloc(encryptedData.length - 16);
    const authTagData = Buffer.alloc(16);
    encryptedData.copy(messageData, 0, 0, encryptedData.length - 16);
    encryptedData.copy(authTagData, 0, encryptedData.length - 16, encryptedData.length);

    // instance of HAPEncryption (created in handlePairVerifyStepOne)
    const enc = session.encryption!;

    let plaintext;
    try {
      plaintext = hapCrypto.chacha20_poly1305_decryptAndVerify(enc.hkdfPairEncKey, Buffer.from("PV-Msg03"), null, messageData, authTagData);
    } catch (error) {
      debug("[%s] M3: Failed to decrypt and/or verify", this.accessoryInfo.username);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      session._pairVerifyState = undefined;
      return;
    }

    const decoded = tlv.decode(plaintext);
    const clientUsername = decoded[TLVValues.USERNAME];
    const proof = decoded[TLVValues.PROOF];
    const material = Buffer.concat([enc.clientPublicKey, clientUsername, enc.publicKey]);
    // since we're paired, we should have the public key stored for this client
    const clientPublicKey = this.accessoryInfo.getClientPublicKey(clientUsername.toString());
    // if we're not actually paired, then there's nothing to verify - this client thinks it's paired with us but we
    // disagree. Respond with invalid request (seems to match HomeKit Accessory Simulator behavior)
    if (!clientPublicKey) {
      debug("[%s] Client %s attempting to verify, but we are not paired; rejecting client", this.accessoryInfo.username, clientUsername);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      session._pairVerifyState = undefined;
      return;
    }
    if (!tweetnacl.sign.detached.verify(material, proof, clientPublicKey)) {
      debug("[%s] Client %s provided an invalid signature", this.accessoryInfo.username, clientUsername);
      response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
      response.end(tlv.encode(TLVValues.STATE, States.M4, TLVValues.ERROR_CODE, Codes.AUTHENTICATION));
      session._pairVerifyState = undefined;
      return;
    }
    debug("[%s] Client %s verification complete", this.accessoryInfo.username, clientUsername);
    response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
    response.end(tlv.encode(TLVValues.SEQUENCE_NUM, 0x04));
    // now that the client has been verified, we must "upgrade" our pseudo-HTTP connection to include
    // TCP-level encryption. We'll do this by adding some more encryption vars to the session, and using them
    // in future calls to onEncrypt, onDecrypt.
    const encSalt = Buffer.from("Control-Salt");
    const infoRead = Buffer.from("Control-Read-Encryption-Key");
    const infoWrite = Buffer.from("Control-Write-Encryption-Key");
    enc.accessoryToControllerKey = hapCrypto.HKDF("sha512", encSalt, enc.sharedSec, infoRead, 32);
    enc.controllerToAccessoryKey = hapCrypto.HKDF("sha512", encSalt, enc.sharedSec, infoWrite, 32);
    // Our connection is now completely setup. We now want to subscribe this connection to special
    // "keepalive" events for detecting when connections are closed by the client.
    events['keepalive'] = true;
    session.establishSession(clientUsername.toString());
    session._pairVerifyState = undefined;
  }

  /**
   * Pair add/remove/list
   */
  _handlePairings = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: Buffer) => {
    // Only accept /pairing request if there is a secure session
    if (!this.allowInsecureRequest && !session.authenticated) {
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
  _handleAccessories = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: any) => {
    if (!this.allowInsecureRequest && !session.authenticated) {
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

  // Called when the client wishes to get or set particular characteristics
  _handleCharacteristics(request: IncomingMessage, response: ServerResponse, session: HAPSession, events: CharacteristicEvents, requestData: { length: number; toString: () => string; }): void {
    if (!this.allowInsecureRequest && !session.authenticated) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }

    if (request.method === "GET") {
      const url = new URL(request.url!, "http://hap-nodejs.local");
      const searchParams = url.searchParams;

      const idParam = searchParams.get("id");
      if (!idParam) {
        // TODO proper error code
        response.writeHead(500, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({ status: Status.INVALID_VALUE_IN_REQUEST }));
        return;
      }

      const ids: CharacteristicId[] = [];
      for (const entry of idParam.split(",")) { // ["1.9","2.14"]
        const split = entry.split(".") // ["1","9"]
        ids.push({
          aid: parseInt(split[0]), // accessory Id
          iid: parseInt(split[1]), // (characteristic) instance Id
        });
      }

      const readRequest: CharacteristicsReadRequest = {
        ids: ids,
        includeMeta: consideredTrue(searchParams.get("meta")),
        includePerms: consideredTrue(searchParams.get("perms")),
        includeType: consideredTrue(searchParams.get("type")),
        includeEvent: consideredTrue(searchParams.get("ev")),
      };

      this.emit(HAPServerEventTypes.GET_CHARACTERISTICS, readRequest, session, events, once((readResponse: CharacteristicsReadResponse) => {
        const characteristics = readResponse.characteristics;

        let errorOccurred = false; // determine if we send a 207 Multi-Status
        for (const data of characteristics) {
          if (data.status) {
            errorOccurred = true;
            break;
          }
        }

        if (errorOccurred) { // on a 207 Multi-Status EVERY characteristic MUST include a status property
          for (const data of characteristics) {
            if (!data.status) { // a status is undefined if the request was successful
              data.status = Status.SUCCESS; // a value of zero indicates success
            }
          }
        }

        // 207 "multi-status" is returned when an error occurs reading a characteristic. otherwise 200 is returned
        response.writeHead(errorOccurred? 207: 200, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({ characteristics: characteristics }));
      }));
    } else if (request.method == "PUT") {
      if (!session.authenticated) {
        if (!request.headers || (request.headers && request.headers["authorization"] !== this.accessoryInfo.pincode)) {
          response.writeHead(470, {"Content-Type": "application/hap+json"});
          response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
          return;
        }
      }
      if (requestData.length === 0) {
        response.writeHead(400, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({status: Status.INVALID_VALUE_IN_REQUEST}));
        return;
      }

      const writeRequest = JSON.parse(requestData.toString()) as CharacteristicsWriteRequest;
      const data = writeRequest.characteristics;

      this.emit(HAPServerEventTypes.SET_CHARACTERISTICS, writeRequest, session, events, once((writeResponse: CharacteristicsWriteResponse) => {
        const characteristics = writeResponse.characteristics;

        let multiStatus = false;
        for (const data of characteristics) {
          if (data.status || data.value !== undefined) {
            // also send multiStatus on write response requests
            multiStatus = true;
            break;
          }
        }

        if (multiStatus) {
          for (const data of characteristics) { // on a 207 Multi-Status EVERY characteristic MUST include a status property
            if (data.status === undefined) {
              data.status = Status.SUCCESS;
            }
          }

          // 207 is "multi-status" since HomeKit may be setting multiple things and any one can fail independently
          response.writeHead(207, {"Content-Type": "application/hap+json"});
          response.end(JSON.stringify({ characteristics: characteristics }));
        } else {
          // if everything went fine send 204 no content response
          response.writeHead(204); // 204 "No content"
          response.end();
        }
      }));
    } else {
      // TODO handle that at least for debugging purposes
    }
  }

  // Called when controller requests a timed write
  _prepareWrite = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: { length: number; toString: () => string; }) => {
    if (!this.allowInsecureRequest && !session.authenticated) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }

    if (request.method == "PUT") {
      if (requestData.length == 0) {
        response.writeHead(400, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({status: Status.INVALID_VALUE_IN_REQUEST}));
        return;
      }

      const data = JSON.parse(requestData.toString()) as PrepareWriteRequest;

      if (data.pid && data.ttl) {
        debug("[%s] Received prepare write request with pid %d and ttl %d", this.accessoryInfo.username, data.pid, data.ttl);

        if (session.timedWriteTimeout) // clear any currently existing timeouts
          clearTimeout(session.timedWriteTimeout);

        session.timedWritePid = data.pid;
        session.timedWriteTimeout = setTimeout(() => {
          debug("[%s] Timed write request timed out for pid %d", this.accessoryInfo.username, data.pid);
          session.timedWritePid = undefined;
          session.timedWriteTimeout = undefined;
        }, data.ttl);

        response.writeHead(200, {"Content-Type": "application/hap+json"});
        response.end(JSON.stringify({status: Status.SUCCESS}));
        return;
      }
    }
  };

  // Called when controller request snapshot
  _handleResource = (request: IncomingMessage, response: ServerResponse, session: HAPSession, events: any, requestData: { length: number; toString: () => string; }) => {
    if (!this.allowInsecureRequest && !session.authenticated) {
      response.writeHead(470, {"Content-Type": "application/hap+json"});
      response.end(JSON.stringify({status: Status.INSUFFICIENT_PRIVILEGES}));
      return;
    }
    if (request.method == "POST") {
      if (!session.authenticated) {
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
      const data = JSON.parse(requestData.toString());
      // call out to listeners to retrieve the resource, snapshot only right now
      this.emit(HAPServerEventTypes.REQUEST_RESOURCE, data, once((err: Error, resource: any) => {
        if (err) {
          debug("[%s] Error getting snapshot: %s", this.accessoryInfo.username, err.message);
          response.writeHead(404);
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
    this.clientPublicKey = Buffer.alloc(0);
    this.secretKey = Buffer.alloc(0);
    this.publicKey = Buffer.alloc(0);
    this.sharedSec = Buffer.alloc(0);
    this.hkdfPairEncKey = Buffer.alloc(0);
    this.accessoryToControllerCount = { value: 0 };
    this.controllerToAccessoryCount = { value: 0 };
    this.accessoryToControllerKey = Buffer.alloc(0);
    this.controllerToAccessoryKey = Buffer.alloc(0);
    this.extraInfo = {};
  }
}
