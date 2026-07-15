import assert from "assert";
import { once } from "events";
import { HeaderObject, HTTPParser } from "http-parser-js";
import { createConnection, Socket } from "net";
import { HAPMimeTypes, PairingStates, PairMethods, TLVValues } from "../internal-types";
import { HAPHTTPCode, HAPPairingHTTPCode } from "../lib/HAPServer";
import { PairingInformation, PermissionTypes } from "../lib/model/AccessoryInfo";
import { HAPEncryption, HAPUsername } from "../lib/util/eventedhttp";
import * as hapCrypto from "../lib/util/hapCrypto";
import * as tlv from "../lib/util/tlv";
import {
  AccessoriesResponse,
  CharacteristicId,
  CharacteristicsReadResponse,
  CharacteristicsWriteRequest,
  CharacteristicsWriteResponse,
  PrepareWriteRequest,
  ResourceRequest,
} from "../types";
import { HAPHTTPError } from "./HAPHTTPError";
import { TLVError } from "./tlvError";

export interface HTTPResponse<T = Buffer> {
  shouldKeepAlive: boolean;
  upgrade: boolean;
  statusCode: number;
  statusMessage: string;
  versionMajor: number;
  versionMinor: number;
  headers: Record<string, string>;
  body: T;
  trailers: string[];
}

export interface HTTPRequestOptions {
  /**
   * Content-Type header applied when a request body is present. Defaults to "application/json".
   */
  contentType?: string;
  /**
   * Additional request headers appended verbatim to the fixed header block (e.g. an authorization header).
   */
  headers?: Record<string, string>;
}

/**
 * A HAP HTTP client backed by a raw TCP connection it owns for the connection's entire lifetime - the client-side mirror
 * of the server's HAPConnection. Owning the socket end-to-end is what allows a single connection to carry the pairing
 * handshakes, the encrypted session traffic whose keys are bound to that exact connection, and unsolicited EVENT messages
 * the server pushes. A pooled http.Agent socket cannot serve this role: the agent's free-socket read guard destroys a
 * pooled connection the moment the server sends unsolicited data.
 */
export class HAPHTTPClient {
  /**
   * Upper bound in milliseconds for awaiting received bytes before failing. Generous relative to the real loopback
   * round-trip so it never trips on a healthy connection, while still turning a genuinely absent response into a loud
   * timeout instead of a silent empty buffer.
   */
  private static readonly RECEIVE_TIMEOUT = 2000;

  private readonly address: string;
  private readonly port: number;

  private currentSocket?: Socket;
  private encryption?: HAPEncryption;
  private socketClosed = false;
  // Settles when the underlying socket has fully closed. Captured at connect() so close observation stays valid for the
  // client's entire lifetime, even after destroy() has dropped the socket reference.
  private socketClosePromise?: Promise<void>;
  private everConnected = false;

  private currentDataListener?: (data: Buffer) => void;
  private dataQueue: Buffer[] = [];
  // Already-decrypted bytes trailing a parsed HTTP response that shared a TCP segment with subsequent data (e.g. a
  // coalesced EVENT message). Consumed by popReceiveBuffer before any further (still encrypted) segments.
  private leftoverPlaintext?: Buffer;

  constructor(address: string, port: number) {
    this.address = address;
    this.port = port;
  }

  /**
   * Opens the TCP connection this client owns for its entire lifetime and installs the receive machinery. Mirrors the
   * server-side HAPConnection setup: Nagle is disabled so small request/response writes are not artificially delayed.
   */
  async connect(): Promise<void> {
    // One client instance models one connection for its entire lifetime - the client-side mirror of the server's
    // per-connection HAPConnection - so a client is never reconnected after use. A test needing a fresh connection
    // constructs a fresh client, which also keeps all receive state trivially clean.
    expect(this.everConnected).toBe(false);
    this.everConnected = true;

    const socket = createConnection(this.port, this.address);
    socket.setNoDelay(true);

    // A permanent error listener must exist for the socket's lifetime: without one, a late ECONNRESET (e.g. the server
    // tearing down first in afterEach) would crash the process. Failures surface loudly through receive timeouts instead.
    socket.on("error", () => {});
    this.socketClosePromise = new Promise(resolve => {
      socket.once("close", () => {
        this.socketClosed = true;
        resolve();
      });
    });

    this.currentDataListener = data => {
      this.dataQueue.push(data);
    };
    socket.on("data", this.currentDataListener);
    this.currentSocket = socket;

    // once() rejects on a socket "error" while waiting, covering the failed-connect path.
    await once(socket, "connect");
  }

  /**
   * Destroys the owned connection. Safe to call multiple times and on a never-connected client, so tests can place it in
   * finally blocks and afterEach hooks unconditionally.
   */
  destroy(): void {
    if (this.currentSocket) {
      if (this.currentDataListener) {
        this.currentSocket.removeListener("data", this.currentDataListener);
        this.currentDataListener = undefined;
      }
      this.currentSocket.destroy();
      this.currentSocket = undefined;
    }
  }

  /**
   * True once the underlying socket has fully closed - regardless of which side initiated it. Lets tests assert
   * server-initiated teardown directly on the connection instead of inferring it from client-library internals.
   */
  get isClosed(): boolean {
    return this.socketClosed;
  }

  /**
   * Resolves once the underlying socket has fully closed, rejecting after {@link timeoutMs} if it never does. Close
   * observation is anchored to the promise captured at {@link connect}, so it is valid at any point in the client's
   * lifetime - including immediately after {@link destroy} - regardless of which side initiates the teardown.
   */
  async waitForClose(timeoutMs = HAPHTTPClient.RECEIVE_TIMEOUT): Promise<void> {
    expect(this.socketClosePromise).toBeDefined();

    let timeoutId: NodeJS.Timeout | undefined = undefined;

    const timeout = new Promise<void>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timed out awaiting the connection to close.")), timeoutMs);
    });

    try {
      await Promise.race([this.socketClosePromise, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  get receiveBufferCount(): number {
    return this.dataQueue.length + (this.leftoverPlaintext ? 1 : 0);
  }

  enableEncryption(encryption: HAPEncryption): void {
    this.encryption = encryption;
  }

  disableEncryption(): void {
    this.encryption = undefined;
  }

  popReceiveBuffer(): Buffer {
    expect(this.currentSocket).toBeDefined();
    if (this.leftoverPlaintext) {
      const buffer = this.leftoverPlaintext;
      this.leftoverPlaintext = undefined;
      return buffer;
    }
    expect(this.dataQueue.length > 0).toBeTruthy();
    const buffer = this.dataQueue.splice(0, 1)[0];
    if (this.encryption) {
      return hapCrypto.layerDecrypt(buffer, this.encryption);
    }
    return buffer;
  }

  /**
   * Waits for the next TCP segment to arrive, rejecting once {@link deadline} (an absolute epoch-milliseconds timestamp)
   * passes or the connection closes. A closed socket can never deliver the awaited bytes, so failing fast on close beats
   * stalling out the timeout and obscuring the real cause.
   */
  private awaitIncomingData(deadline: number): Promise<void> {
    expect(this.currentSocket).toBeDefined();

    // A connection that has already closed can never deliver the awaited bytes - reject immediately rather than riding
    // out the deadline only to fail with the less specific timeout error.
    if (this.socketClosed) {
      return Promise.reject(new Error("Connection closed while awaiting incoming data."));
    }

    const socket = this.currentSocket!;

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanups: (() => void)[] = [];

      // Whichever of the three outcomes settles first tears down the other two registrations, so no timer or listener
      // outlives the wait.
      const settle = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        for (const cleanup of cleanups) {
          cleanup();
        }
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const timeoutId = setTimeout(() => settle(new Error("Timed out awaiting incoming data on the connection.")), Math.max(0, deadline - Date.now()));
      const onData = () => settle();
      const onClose = () => settle(new Error("Connection closed while awaiting incoming data."));

      cleanups.push(() => clearTimeout(timeoutId));
      cleanups.push(() => socket.removeListener("data", onData));
      cleanups.push(() => socket.removeListener("close", onClose));

      socket.on("data", onData);
      socket.on("close", onClose);
    });
  }

  /**
   * Resolves once at least {@link count} buffers have arrived - immediately if they already have - and rejects once
   * {@link timeoutMs} has elapsed overall or the connection closes while waiting. Callers await the genuine arrival of
   * bytes instead of sleeping for a fixed interval and hoping the loopback encrypt/decrypt round-trip has completed by
   * then; that is what keeps the suite robust across Node major versions whose event-loop scheduling differs, and it lets
   * a genuinely missing response fail loudly instead of silently reading an empty buffer.
   */
  async waitForData(count = 1, timeoutMs = HAPHTTPClient.RECEIVE_TIMEOUT): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (this.receiveBufferCount < count) {
      await this.awaitIncomingData(deadline);
    }
  }

  /**
   * Drains and returns every buffered message as one string once the received data contains {@link marker}, awaiting
   * further TCP segments until it does (rejecting once {@link timeoutMs} has elapsed overall or the connection closes).
   * HomeKit may coalesce an HTTP response and a trailing EVENT message into a single TCP segment or split them across
   * two, so matching on content rather than on a fixed segment count keeps event assertions independent of that
   * nondeterminism.
   */
  async readUntil(marker: string, timeoutMs = HAPHTTPClient.RECEIVE_TIMEOUT): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    let received = "";
    while (this.receiveBufferCount > 0) {
      received += this.popReceiveBuffer().toString();
    }
    while (!received.includes(marker)) {
      await this.awaitIncomingData(deadline);
      while (this.receiveBufferCount > 0) {
        received += this.popReceiveBuffer().toString();
      }
    }
    return received;
  }

  formatHTTPRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    route: string,
    data?: Buffer,
    options: HTTPRequestOptions = {},
  ): Buffer {
    const contentType = options.contentType ?? "application/json";

    let extraHeaders = "";
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      extraHeaders += name + ": " + value + "\r\n";
    }

    // A body-less non-GET request is legitimate (e.g. POST /identify) and carries an explicit zero Content-Length so the
    // server's parser can frame the message without ambiguity.
    const bodyHeaders = data
      ? "Content-Type: " + contentType + "\r\n" + "Content-Length: " + data.length + "\r\n"
      : (method === "GET" ? "" : "Content-Length: 0\r\n");

    const buffer = Buffer.from(`${method} ${route} HTTP/1.1\r\n` +
      "Accept: application/json, text/plain, */*\r\n" +
      "User-Agent: test-util\r\n" +
      "Host: " + this.address + ":" + this.port + "\r\n" +
      "Connection: keep-alive\r\n" +
      extraHeaders +
      bodyHeaders +
      "\r\n");

    if (data) {
      return Buffer.concat([buffer, data]);
    }

    return buffer;
  }

  async writeHTTPRequest(method: "GET" | "POST" | "PUT" | "DELETE", route: string, data?: Buffer, options?: HTTPRequestOptions): Promise<HTTPResponse> {
    const httpRequest = this.formatHTTPRequest(method, route, data, options);
    this.write(httpRequest);
    return this.readHTTPResponse();
  }

  write(data: Buffer): void {
    if (this.encryption) {
      data = hapCrypto.layerEncrypt(data, this.encryption);
    }
    expect(this.currentSocket).toBeDefined();
    this.currentSocket!.write(data);
  }

  /**
   * Reads exactly one complete HTTP response off the connection, feeding the parser segment by segment until the message
   * completes (rejecting once {@link timeoutMs} has elapsed overall or the connection closes). Parsing incrementally
   * removes any assumption about how the runtime segments the response across TCP packets - segmentation is exactly the
   * kind of behavior that shifts between Node major versions. Bytes trailing the parsed message (e.g. a coalesced EVENT
   * notification) are retained for the next read rather than lost.
   */
  async readHTTPResponse(timeoutMs = HAPHTTPClient.RECEIVE_TIMEOUT): Promise<HTTPResponse> {
    const deadline = Date.now() + timeoutMs;
    const parser = new HTTPParser(HTTPParser.RESPONSE);

    let complete = false;
    // The chunk-relative position at which the message completed. The parser does not stop at message end - it
    // reinitializes and keeps consuming trailing bytes as the start of a next message within the same execute() call -
    // so the boundary must be captured the moment kOnMessageComplete fires, and the callbacks below must go quiet once
    // the message of interest is complete so trailing bytes cannot corrupt the parsed result.
    let completedAt = 0;
    let shouldKeepAlive = false;
    let upgrade = false;
    let statusCode = 0;
    let statusMessage = "";
    let versionMajor = 0;
    let versionMinor = 0;
    let headers: HeaderObject = [];
    let trailers: string[] = [];
    const bodyChunks: Buffer[] = [];

    parser[HTTPParser.kOnHeadersComplete] = info => {
      if (complete) {
        return;
      }
      shouldKeepAlive = info.shouldKeepAlive;
      upgrade = info.upgrade;
      statusCode = info.statusCode;
      statusMessage = info.statusMessage;
      versionMajor = info.versionMajor;
      versionMinor = info.versionMinor;
      headers = info.headers;
    };

    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
      if (complete) {
        return;
      }
      bodyChunks.push(chunk.subarray(offset, offset + length));
    };

    // that's the event for trailers!
    parser[HTTPParser.kOnHeaders] = t => {
      if (complete) {
        return;
      }
      trailers = t;
    };

    parser[HTTPParser.kOnMessageComplete] = () => {
      complete = true;
      // The parser's chunk-relative read position at completion time is the exact message boundary. The property is
      // runtime state the type declarations do not surface, hence the narrow structural cast.
      completedAt = (parser as unknown as { offset: number }).offset;
    };

    while (!complete) {
      if (this.receiveBufferCount === 0) {
        await this.awaitIncomingData(deadline);
      }

      const chunk = this.popReceiveBuffer();
      const result = parser.execute(chunk);

      if (complete) {
        // Bytes beyond the completed message belong to the next message (e.g. a coalesced EVENT notification): retain
        // them for the next read. A parse error the parser hit on those trailing bytes is not this response's concern.
        if (completedAt < chunk.length) {
          this.leftoverPlaintext = chunk.subarray(completedAt);
        }
      } else if (typeof result !== "number") {
        throw new Error("Failed to parse HTTP response chunk: " + result.message);
      }
    }

    const body = Buffer.concat(bodyChunks);

    return {
      shouldKeepAlive,
      upgrade,
      statusCode,
      statusMessage,
      versionMajor,
      versionMinor,
      headers: this.headersArrayToObject(headers),
      body,
      trailers,
    };
  }

  async sendAddPairingRequest(identifier: HAPUsername, publicKey: Buffer, permission: PermissionTypes): Promise<void> {
    const requestTLV = tlv.encode(
      TLVValues.METHOD, PairMethods.ADD_PAIRING,
      TLVValues.STATE, PairingStates.M1,
      TLVValues.IDENTIFIER, identifier,
      TLVValues.PUBLIC_KEY, publicKey,
      TLVValues.PERMISSIONS, permission,
    );

    await this.sendPairingsRequest(requestTLV);
  }

  async sendRemovePairingRequest(identifier: HAPUsername): Promise<void> {
    const requestTLV = tlv.encode(
      TLVValues.METHOD, PairMethods.REMOVE_PAIRING,
      TLVValues.STATE, PairingStates.M1,
      TLVValues.IDENTIFIER, identifier,
    );

    await this.sendPairingsRequest(requestTLV);
  }

  async sendListPairingsRequest(): Promise<PairingInformation[]> {
    const requestTLV = tlv.encode(
      TLVValues.METHOD, PairMethods.LIST_PAIRINGS,
      TLVValues.STATE, PairingStates.M1,
    );

    const responseBody = await this.sendPairingsRequest(requestTLV);
    const tlvDataList = tlv.decodeList(responseBody.subarray(3), TLVValues.IDENTIFIER);

    const result: PairingInformation[] = [];

    for (const element of tlvDataList) {
      result.push({
        username: element[TLVValues.IDENTIFIER].toString(),
        publicKey: element[TLVValues.PUBLIC_KEY],
        permission: element[TLVValues.PERMISSIONS].readUInt8(0),
      });
    }

    return result;
  }

  private async sendPairingsRequest(requestTLV: Buffer): Promise<Buffer> {
    const httpResponse = await this.writeHTTPRequest("POST", "/pairings", requestTLV, { contentType: HAPMimeTypes.PAIRING_TLV8 });

    // `/pairings` errors are transported via the tlv8 record
    expect(httpResponse.statusCode).toEqual(HAPPairingHTTPCode.OK);
    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.PAIRING_TLV8);

    const tlvData = tlv.decode(httpResponse.body);
    expect(tlvData[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M2);

    if (tlvData[TLVValues.ERROR_CODE]) {
      throw new TLVError(tlvData[TLVValues.ERROR_CODE].readUInt8(0));
    }

    // we return the raw buffer because LIST_PAIRINGS has some custom decoding strategies!
    return httpResponse.body;
  }

  public async sendAccessoriesRequest(): Promise<AccessoriesResponse> {
    const httpResponse = await this.writeHTTPRequest("GET", "/accessories");
    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);
    const jsonBody = JSON.parse(httpResponse.body.toString());

    if (httpResponse.statusCode !== HAPPairingHTTPCode.OK) {
      throw new HAPHTTPError(httpResponse.statusCode, jsonBody.status);
    }

    return jsonBody;
  }

  public async sendCharacteristicRead(
    ids: CharacteristicId[],
    includeMeta?: boolean,
    includePerms?: boolean,
    includeType?: boolean,
    includeEvent?: boolean,
  ): Promise<HTTPResponse<CharacteristicsReadResponse>> {
    assert(ids.length > 0);
    let query = "?id=" + ids.map(id => id.aid + "." + id.iid).join(",");

    if (includeMeta) {
      query += "&meta=" + (includeMeta ? "true" : "false");
    }
    if (includePerms) {
      query += "&perms=" + (includePerms ? "1" : "0");
    }
    if (includeType) {
      query += "&type=" + (includeType ? "true" : "false");
    }
    if (includeEvent) {
      query += "&ev=" + (includeEvent ? "1" : "0");
    }

    const httpResponse = await this.writeHTTPRequest("GET", "/characteristics" + query);
    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);

    const body = JSON.parse(httpResponse.body.toString());
    if (!httpResponse.statusCode.toString().startsWith("2")) {
      throw new HAPHTTPError(httpResponse.statusCode, body.status);
    }

    return {
      ...httpResponse,
      body: body,
    };
  }

  public async sendCharacteristicWrite(writeRequest: CharacteristicsWriteRequest): Promise<HTTPResponse<CharacteristicsWriteResponse | undefined>> {
    const httpResponse = await this.writeHTTPRequest(
      "PUT", "/characteristics", Buffer.from(JSON.stringify(writeRequest)), { contentType: HAPMimeTypes.HAP_JSON },
    );
    if (httpResponse.statusCode !== HAPHTTPCode.NO_CONTENT) {
      expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);
    }

    if (!httpResponse.statusCode.toString().startsWith("2")) {
      const jsonBody = JSON.parse(httpResponse.body.toString());
      throw new HAPHTTPError(httpResponse.statusCode, jsonBody.status);
    }

    return {
      ...httpResponse,
      body: httpResponse.body.length > 0 ? JSON.parse(httpResponse.body.toString()) : undefined,
    };
  }

  public async sendPrepareWrite(prepareWrite: PrepareWriteRequest): Promise<void> {
    const httpResponse = await this.writeHTTPRequest(
      "PUT", "/prepare", Buffer.from(JSON.stringify(prepareWrite)), { contentType: HAPMimeTypes.HAP_JSON },
    );
    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);

    if (httpResponse.statusCode !== HAPHTTPCode.OK) {
      const jsonBody = JSON.parse(httpResponse.body.toString());
      throw new HAPHTTPError(httpResponse.statusCode, jsonBody.status);
    }
  }

  public async sendResourceRequest(resourceRequest: ResourceRequest): Promise<Buffer> {
    const httpResponse = await this.writeHTTPRequest(
      "POST", "/resource", Buffer.from(JSON.stringify(resourceRequest)), { contentType: HAPMimeTypes.HAP_JSON },
    );

    if (httpResponse.statusCode !== HAPHTTPCode.OK) {
      expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);
      const jsonBody = JSON.parse(httpResponse.body.toString());
      throw new HAPHTTPError(httpResponse.statusCode, jsonBody.status);
    }

    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.IMAGE_JPEG);
    return httpResponse.body;
  }

  private headersArrayToObject(headers: HeaderObject): Record<string, string> {
    expect(headers.length % 2).toBe(0);

    const result: Record<string, string> = {};

    for (let i = 0; i < headers.length; i += 2) {
      result[headers[i]] = headers[i+1];
    }

    return result;
  }
}
