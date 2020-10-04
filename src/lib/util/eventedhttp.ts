import { getNetAddress } from "@homebridge/ciao/lib/util/domain-formatter";
import assert from "assert";
import createDebug from 'debug';
import { EventEmitter } from "events";
import { SrpServer } from "fast-srp-hap";
import http, { IncomingMessage, ServerResponse } from 'http';
import net, { AddressInfo, Socket } from 'net';
import os from "os";
import { CharacteristicValue, Nullable, SessionIdentifier } from '../../types';
import { HAPEncryption } from '../HAPServer';
import * as hapCrypto from "./hapCrypto";
import { getOSLoopbackAddress } from "./net-utils";
import * as uuid from './uuid';

const debug = createDebug('HAP-NodeJS:EventedHTTPServer');

export type HAPUsername = string;
export type EventName = string; // "<aid>.<iid>"

export const enum EventedHTTPServerEvent {
  LISTENING = 'listening',
  CONNECTION_OPENED = "connection-opened",
  REQUEST = "request",
  CONNECTION_CLOSED = "connection-closed",
}

export declare interface EventedHTTPServer {

  on(event: "listening", listener: (port: number, address: string) => void): this;
  on(event: "connection-opened", listener: (connection: HAPConnection) => void): this;
  on(event: "request", listener: (connection: HAPConnection, request: IncomingMessage, response: ServerResponse) => void): this;
  on(event: "connection-closed", listener: (connection: HAPConnection) => void): this;

  emit(event: "listening", port: number, address: string): boolean;
  emit(event: "connection-opened", connection: HAPConnection): boolean;
  emit(event: "request", connection: HAPConnection, request: IncomingMessage, response: ServerResponse): boolean;
  emit(event: "connection-closed", connection: HAPConnection): boolean;

}

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
 */
export class EventedHTTPServer extends EventEmitter {

  private readonly tcpServer: net.Server;

  /**
   * Set of all currently connected HAP connections.
   */
  private readonly connections: Set<HAPConnection> = new Set();
  /**
   * Session dictionary indexed by username/identifier. The username uniquely identifies every person added to the home.
   * So there can be multiple sessions open for a single username (multiple devices connected to the same Apple ID).
   */
  private readonly connectionsByUsername: Map<HAPUsername, HAPConnection[]> = new Map();

  constructor() {
    super();
    this.tcpServer = net.createServer();
  }

  public listen(targetPort: number, hostname?: string): void {
    this.tcpServer.listen(targetPort, hostname, () => {
      const address = this.tcpServer.address() as AddressInfo; // address() is only a string when listening to unix domain sockets

      debug("Server listening on %s:%s", address.family === "IPv6"? `[${address.address}]`: address.address, address.port);
      this.emit(EventedHTTPServerEvent.LISTENING, address.port, address.address);
    });

    this.tcpServer.on("connection", this.onConnection.bind(this));
  }

  public stop(): void {
    this.tcpServer.close();
    for (const connection of this.connections) {
      connection.close();
    }

    this.removeAllListeners();
  }

  /**
   * Send a even notification for given characteristic and changed value to all connected clients.
   * If {@param originator} is specified, the given {@link HAPConnection} will be excluded from the broadcast.
   *
   * @param aid - The accessory id of the updated characteristic.
   * @param iid - The instance id of the updated characteristic.
   * @param value - The newly set value of the characteristic.
   * @param originator - If specified, the connection will not get a event message.
   */
  public broadcastEvent(aid: number, iid: number, value: Nullable<CharacteristicValue>, originator?: HAPConnection): void {
    for (const connection of this.connections) {
      if (connection === originator) {
        debug("[%s] Muting event '%s' notification for this connection since it originated here.", connection.remoteAddress, aid + "." + iid);
        continue;
      }

      connection.sendEvent(aid, iid, value);
    }
  }

  private onConnection(socket: Socket): void {
    const connection = new HAPConnection(this, socket);

    connection.on(HAPConnectionEvent.REQUEST, (request, response) => {
      this.emit(EventedHTTPServerEvent.REQUEST, connection, request, response);
    });
    connection.on(HAPConnectionEvent.AUTHENTICATED, this.handleConnectionAuthenticated.bind(this, connection));
    connection.on(HAPConnectionEvent.CLOSED, this.handleConnectionClose.bind(this, connection));

    this.connections.add(connection);

    debug("[%s] New connection from client on interface %s", connection.remoteAddress, connection.networkInterface);

    this.emit(EventedHTTPServerEvent.CONNECTION_OPENED, connection);
  }

  private handleConnectionAuthenticated(connection: HAPConnection, username: HAPUsername): void {
    const connections: HAPConnection[] | undefined = this.connectionsByUsername.get(username);
    if (!connections) {
      this.connectionsByUsername.set(username, [connection]);
    } else if (!connections.includes(connection)) { // ensure this doesn't get added more than one time
      connections.push(connection);
    }
  }

  private handleConnectionClose(connection: HAPConnection): void {
    this.emit(EventedHTTPServerEvent.CONNECTION_CLOSED, connection);

    this.connections.delete(connection);

    if (connection.username) { // aka connection was authenticated
      const connections = this.connectionsByUsername.get(connection.username);
      if (connections) {
        const index = connections.indexOf(connection);
        if (index !== -1) {
          connections.splice(index, 1);
        }

        if (connections.length === 0) {
          this.connectionsByUsername.delete(connection.username);
        }
      }
    }
  }

  public static destroyExistingConnectionsAfterUnpair(initiator: HAPConnection, username: string): void {
    const connections: HAPConnection[] | undefined = initiator.server.connectionsByUsername.get(username);

    if (connections) {
      for (const connection of connections) {
        connection.closeConnectionAsOfUnpair(initiator);
      }
    }
  };

}

/**
 * @internal
 */
export const enum HAPConnectionState {
  CONNECTING, // initial state, setup is going on
  FULLY_SET_UP, // internal http server is running and connection is established
  AUTHENTICATED, // encryption is set up
  // above signals are represent a alive connection

  // below states are considered "closed or soon closed"
  TO_BE_TEARED_DOWN, // when in this state, connection should be closed down after response was sent out
  CLOSING, // close was called
  CLOSED, // dead
}

export const enum HAPConnectionEvent {
  REQUEST = "request",
  AUTHENTICATED = "authenticated",
  CLOSED = "closed",
}

export declare interface HAPConnection {
  on(event: "request", listener: (request: IncomingMessage, response: ServerResponse) => void): this;
  on(event: "authenticated", listener: (username: HAPUsername) => void): this;
  on(event: "closed", listener: () => void): this;

  emit(event: "request", request: IncomingMessage, response: ServerResponse): boolean;
  emit(event: "authenticated", username: HAPUsername): boolean;
  emit(event: "closed"): boolean;
}

/**
 * Manages a single iOS-initiated HTTP connection during its lifetime.
 * @internal
 */
export class HAPConnection extends EventEmitter {

  readonly server: EventedHTTPServer;

  readonly sessionID: SessionIdentifier; // uuid unique to every HAP connection
  private state: HAPConnectionState = HAPConnectionState.CONNECTING;
  readonly remoteAddress: string; // cache because it becomes undefined in 'onClientSocketClose'
  readonly networkInterface: string;

  private readonly tcpSocket: Socket;
  private readonly internalHttpServer: http.Server;
  private httpSocket?: Socket; // set when in state FULLY_SET_UP
  private internalHttpServerPort?: number;

  private pendingClientSocketData?: Buffer = Buffer.alloc(0); // data received from client before HTTP proxy is fully setup
  private handlingRequest: boolean = false; // true while we are composing an HTTP response (so events can wait)
  private readonly pendingEventData: Buffer[] = []; // queue of unencrypted event data waiting to be sent until after an in-progress HTTP response is being written

  username?: HAPUsername; // username is unique to every user in the home, basically identifies an Apple Id
  encryption?: HAPEncryption; // created in handlePairVerifyStepOne
  srpServer?: SrpServer;
  _pairSetupState?: number; // TODO ensure those two states are always correctly reset?
  _pairVerifyState?: number;

  private registeredEvents: Set<EventName> = new Set();

  timedWritePid?: number;
  timedWriteTimeout?: NodeJS.Timeout;

  constructor(server: EventedHTTPServer, clientSocket: Socket) {
    super();

    this.server = server;
    this.sessionID = uuid.generate(clientSocket.remoteAddress + ':' + clientSocket.remotePort);
    this.remoteAddress = clientSocket.remoteAddress!; // cache because it becomes undefined in 'onClientSocketClose'
    this.networkInterface = HAPConnection.getLocalNetworkInterface(clientSocket);

    // clientSocket is the socket connected to the actual iOS device
    this.tcpSocket = clientSocket;
    this.tcpSocket.on('data', this.onTCPSocketData.bind(this));
    this.tcpSocket.on('close', this.onTCPSocketClose.bind(this));
    this.tcpSocket.on('error', this.onTCPSocketError.bind(this)); // we MUST register for this event, otherwise the error will bubble up to the top and crash the node process entirely.
    this.tcpSocket.setNoDelay(true); // disable Nagle algorithm
    // this.tcpSocket.setKeepAlive(true, 5000); // TODO HAP accessory servers must not use keepalive messages, which periodically wake up iOS devices.

    // create our internal HTTP server for this connection that we will proxy data to and from
    this.internalHttpServer = http.createServer();
    this.internalHttpServer.timeout = 0; // clients expect to hold connections open as long as they want
    this.internalHttpServer.keepAliveTimeout = 0; // workaround for https://github.com/nodejs/node/issues/13391
    this.internalHttpServer.on("listening", this.onHttpServerListening.bind(this));
    this.internalHttpServer.on('request', this.handleHttpServerRequest.bind(this));
    this.internalHttpServer.on('error', this.onHttpServerError.bind(this));
    // close event is added later on the "connect" event as possible listen retries would throw unnecessary close events
    this.internalHttpServer.listen(0, getOSLoopbackAddress);
  }

  /**
   * This method is called once the connection has gone through pair-verify.
   * As any HomeKit controller will initiate a pair-verify after the pair-setup procedure, this method gets
   * not called on the initial pair-setup.
   *
   * Once this method has been called, the connection is authenticated and encryption is turned on.
   */
  public connectionAuthenticated(username: HAPUsername): void {
    this.state = HAPConnectionState.AUTHENTICATED;
    this.username = username;

    this.emit(HAPConnectionEvent.AUTHENTICATED, username);
  };

  public isAuthenticated(): boolean {
    return this.state === HAPConnectionState.AUTHENTICATED;
  }

  public sendEvent(aid: number, iid: number, value: Nullable<CharacteristicValue>): void {
    assert(aid != undefined, "HAPConnection.sendEvent: aid must be defined!");
    assert(iid != undefined, "HAPConnection.sendEvent: iid must be defined!");

    if (!this.hasEventNotifications(aid, iid)) {
      return;
    }
    debug("[%s] Sending HTTP event '%s' with data: %s", this.remoteAddress, aid + "." + iid, value);

    // TODO queue events!!!
    const data = Buffer.from(JSON.stringify({
      characteristics: [{
        aid: aid,
        iid: iid,
        value: value,
      }],
    }), "utf8");

    const header = Buffer.from(
      "EVENT/1.0 200 OK\r\n" +
      "Content-Type: application/hap+json\r\n" +
      "Content-Length: " + data.length + "\r\n" +
      "\r\n",
      "utf8" // buffer encoding
    );

    const buffer = Buffer.concat([header, data]);

    if (this.handlingRequest) {
      // it is important to not encrypt the queued data, otherwise nonce counter will get incorrectly incremented
      this.pendingEventData.push(buffer);
    } else {
      this.tcpSocket.write(this.encrypt(buffer));
    }
  }

  public enableEventNotifications(aid: number, iid: number): void {
    this.registeredEvents.add(aid + "." + iid);
  }

  public disableEventNotifications(aid: number, iid: number): void {
    this.registeredEvents.delete(aid + "." + iid);
  }

  public hasEventNotifications(aid: number, iid: number): boolean {
    return this.registeredEvents.has(aid + "." + iid);
  }

  public getRegisteredEvents(): Set<EventName> {
    return this.registeredEvents;
  }

  private encrypt(data: Buffer): Buffer {
    // if accessoryToControllerKey is not empty, then encryption is enabled for this connection. However, we'll
    // need to be careful to ensure that we don't encrypt the last few bytes of the response from handlePairVerifyStepTwo.
    // Since all communication calls are asynchronous, we could easily receive this 'encrypt' event for those bytes.
    // So we want to make sure that we aren't encrypting data until we have *received* some encrypted data from the client first.
    if (this.encryption && this.encryption.accessoryToControllerKey.length > 0 && this.encryption.controllerToAccessoryCount.value > 0) {
      return hapCrypto.layerEncrypt(data, this.encryption.accessoryToControllerCount, this.encryption.accessoryToControllerKey);
    }
    return data; // otherwise we don't encrypt and return plaintext
  }

  private decrypt(data: Buffer): Buffer {
    if (this.encryption && this.encryption.controllerToAccessoryKey.length > 0) {
      // below call may throw an error if decryption failed
      return hapCrypto.layerDecrypt(data, this.encryption.controllerToAccessoryCount, this.encryption.controllerToAccessoryKey, this.encryption.extraInfo);
    }
    return data; // otherwise we don't decrypt and return plaintext
  }

  private onHttpServerListening() {
    const addressInfo = this.internalHttpServer.address() as AddressInfo; // address() is only a string when listening to unix domain sockets
    const addressString = addressInfo.family === "IPv6"? `[${addressInfo.address}]`: addressInfo.address;
    this.internalHttpServerPort = addressInfo.port;

    debug("[%s] Internal HTTP server listening on %s:%s", this.remoteAddress, addressString, addressInfo.port);

    this.internalHttpServer.on('close', this.onHttpServerClose.bind(this));

    // now we can establish a connection to this running HTTP server for proxying data
    this.httpSocket = net.createConnection(this.internalHttpServerPort, addressInfo.address);
    this.httpSocket.setNoDelay(true); // disable Nagle algorithm

    this.httpSocket.on('data', this.handleHttpServerResponse.bind(this));
    this.httpSocket.on('error', this.onHttpSocketError.bind(this)); // we MUST register for this event, otherwise the error will bubble up to the top and crash the node process entirely.
    this.httpSocket.on('close', this.onHttpSocketClose.bind(this));
    this.httpSocket.on('connect', () => {
      // we are now fully set up:
      //  - clientSocket is connected to the iOS device
      //  - serverSocket is connected to the httpServer
      //  - ready to proxy data!
      this.state = HAPConnectionState.FULLY_SET_UP;

      // start by flushing any pending buffered data received from the client while we were setting up
      if (this.pendingClientSocketData && this.pendingClientSocketData.length > 0) {
        this.httpSocket!.write(this.pendingClientSocketData);
      }
      this.pendingClientSocketData = undefined;
    });
  }

  public close(): void {
    if (this.state >= HAPConnectionState.CLOSING) {
      return; // already closed/closing
    }

    this.state = HAPConnectionState.CLOSING;
    this.tcpSocket.destroy();
  }

  public closeConnectionAsOfUnpair(initiator: HAPConnection): void {
    if (this === initiator) {
      // the initiator of the unpair request is this connection, meaning it unpaired itself.
      // we still need to send the response packet to the unpair request.
      this.state = HAPConnectionState.TO_BE_TEARED_DOWN;
    } else {
      // as HomeKit requires it, destroy any active session which got unpaired
      this.close();
    }
  }

  private sendPendingEvents(): void {
    if (this.pendingEventData.length === 0) {
      return;
    }

    debug("[%s] Writing pending HTTP event data", this.remoteAddress);

    for (const event of this.pendingEventData) {
      this.tcpSocket.write(this.encrypt(event));
    }

    this.pendingEventData.splice(0, this.pendingEventData.length);
  }

  /**
   * This event handler is called when we receive data from a HomeKit controller on our tcp socket.
   * We store the data if the internal http server is not read yet, or forward it to the http server.
   */
  private onTCPSocketData(data: Buffer): void {
    if (this.state > HAPConnectionState.AUTHENTICATED) {
      // don't accept data of a connection which is about to be closed or already closed
      return;
    }

    this.handlingRequest = true; // reverted to false once response was sent out

    try {
      data = this.decrypt(data);
    } catch (error) { // decryption and/or verification failed, disconnect the client
      debug("[%s] Error occurred trying to decrypt incoming packet: %s", this.remoteAddress, error.message);
      this.close();
      return;
    }

    if (this.state < HAPConnectionState.FULLY_SET_UP) { // we're not setup yet, so add this data to our intermediate buffer
      this.pendingClientSocketData = Buffer.concat([this.pendingClientSocketData!, data]);
    } else {
      this.httpSocket!.write(data); // proxy it along to the HTTP server
    }
  }

  /**
   * This event handler is called when the internal http server receives a request.
   * Meaning we received data from the HomeKit controller in {@link onTCPSocketData}, which then send the
   * data unencrypted to the internal http server. And now it landed here, fully parsed as a http request.
   */
  private handleHttpServerRequest(request: IncomingMessage, response: ServerResponse): void {
    if (this.state > HAPConnectionState.AUTHENTICATED) {
      // don't accept data of a connection which is about to be closed or already closed
      return;
    }

    request.socket.setNoDelay(true);
    response.connection.setNoDelay(true); // deprecated since 13.0.0

    debug("[%s] HTTP request: %s", this.remoteAddress, request.url);
    this.emit(HAPConnectionEvent.REQUEST, request, response);
  }

  /**
   * This event handler is called by the socket which is connected to our internal http server.
   * It is called with the response returned from the http server.
   * In this method we have to encrypt and forward the message back to the HomeKit controller.
   */
  private handleHttpServerResponse(data: Buffer): void {
    data = this.encrypt(data);
    this.tcpSocket.write(data);

    debug("[%s] HTTP Response is finished", this.remoteAddress);
    this.handlingRequest = false;

    if (this.state === HAPConnectionState.TO_BE_TEARED_DOWN) {
      setTimeout(() => this.close(), 10);
    } else if (this.state < HAPConnectionState.TO_BE_TEARED_DOWN) {
      this.sendPendingEvents();
    }
  }

  private onTCPSocketError(err: Error): void {
    debug("[%s] Client connection error: %s", this.remoteAddress, err.message);
    // onTCPSocketClose will be called next
  }

  private onTCPSocketClose(): void {
    this.state = HAPConnectionState.CLOSED;

    debug("[%s] Client connection closed", this.remoteAddress);

    if (this.httpSocket) {
      this.httpSocket.destroy();
    }
    this.internalHttpServer.close();

    this.emit(HAPConnectionEvent.CLOSED);

    this.removeAllListeners(); // cleanup listeners, we are officially dead now
  }

  private onHttpServerError(err: Error & { code?: string }): void {
    debug("[%s] HTTP server error: %s", this.remoteAddress, err.message);
    if (err.code === 'EADDRINUSE') {
      this.internalHttpServerPort = undefined;

      this.internalHttpServer.close();
      this.internalHttpServer.listen(0, getOSLoopbackAddress);
    }
  }

  private onHttpServerClose(): void {
    debug("[%s] HTTP server was closed", this.remoteAddress);
    // make sure the iOS side is closed as well
    this.close();
  }

  private onHttpSocketError(err: Error): void {
    debug("[%s] HTTP connection error: ", this.remoteAddress, err.message);
    // onHttpSocketClose will be called next
  }

  private onHttpSocketClose(): void {
    debug("[%s] HTTP connection was closed", this.remoteAddress);
    // we only support a single long-lived connection to our internal HTTP server. Since it's closed,
    // we'll need to shut it down entirely.
    this.internalHttpServer.close();
  }

  public getLocalAddress(ipVersion: "ipv4" | "ipv6"): string {
    const infos = os.networkInterfaces()[this.networkInterface];

    if (ipVersion === "ipv4") {
      for (const info of infos) {
        if (info.family === "IPv4") {
          return info.address;
        }
      }

      throw new Error("Could not find " + ipVersion + " address for interface " + this.networkInterface);
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
        throw new Error("Could not find " + ipVersion + " address for interface " + this.networkInterface);
      }
      return localUniqueAddress;
    }
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
