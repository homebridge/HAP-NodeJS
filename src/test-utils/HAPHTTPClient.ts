import assert from "assert";
import { Agent } from "http";
import { HeaderObject, HTTPParser } from "http-parser-js";
import { Socket } from "net";
import { HAPMimeTypes, PairingStates, PairMethods, TLVValues } from "../internal-types";
import { HAPHTTPCode, HAPPairingHTTPCode } from "../lib/HAPServer";
import { PairingInformation, PermissionTypes } from "../lib/model/AccessoryInfo";
import { HAPEncryption, HAPUsername } from "../lib/util/eventedhttp";
import * as hapCrypto from "../lib/util/hapCrypto";
import { PromiseTimeout } from "../lib/util/promise-utils";
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

/**
 * A http client that wraps around a http agent.
 */
export class HAPHTTPClient {
  private readonly agent: Agent;
  private readonly address: string;
  private readonly port: number;

  private currentSocket?: Socket;
  private encryption?: HAPEncryption;

  private currentDataListener?: (data: Buffer) => void;
  private dataQueue: Buffer[] = [];

  constructor(agent: Agent, address: string, port: number) {
    this.agent = agent;
    this.address = address;
    this.port = port;
  }

  attachSocket(): void {
    expect(this.currentSocket).toBeUndefined();
    expect(this.currentDataListener).toBeUndefined();

    // we extract the underlying TCP socket!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const freeSockets = ((this.agent as any).freeSockets as Record<string, [Socket]>);
    expect(Object.values(freeSockets).length).toBe(1);
    this.currentSocket = Object.values(freeSockets)[0][0];

    this.currentDataListener = data => {
      // packets shall fit into a single TCP segment, no need to write a parser!
      this.dataQueue.push(data);
    };
    this.currentSocket.on("data", this.currentDataListener);
  }

  get receiveBufferCount(): number {
    return this.dataQueue.length;
  }

  enableEncryption(encryption: HAPEncryption): void {
    this.encryption = encryption;
  }

  disableEncryption(): void {
    this.encryption = undefined;
  }

  popReceiveBuffer(): Buffer {
    expect(this.currentSocket).toBeDefined();
    expect(this.dataQueue.length > 0).toBeTruthy();
    const buffer = this.dataQueue.splice(0, 1)[0];
    if (this.encryption) {
      return hapCrypto.layerDecrypt(buffer, this.encryption);
    }
    return buffer;
  }

  formatHTTPRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    route: string,
    data?: Buffer,
    contentType = "application/json",
  ): Buffer {
    expect(!!data || method === "GET").toBeTruthy();
    const buffer = Buffer.from(`${method} ${route} HTTP/1.1\r\n` +
      "Accept: application/json, text/plain, */*\r\n" +
      "User-Agent: test-util\r\n" +
      "Host: " + this.address + ":" + this.port + "\r\n" +
      "Connection: keep-alive\r\n" +
      (data
        ? "Content-Type: " + contentType + "\r\n" +
          "Content-Length: " + data.length + "\r\n"
        : ""
      ) +
      "\r\n");

    if (data) {
      return Buffer.concat([buffer, data]);
    }

    return buffer;
  }

  async writeHTTPRequest(method: "GET" | "POST" | "PUT" | "DELETE", route: string, data?: Buffer, contentType?: string): Promise<HTTPResponse> {
    const httpRequest = this.formatHTTPRequest(method, route, data, contentType);
    this.write(httpRequest);

    await PromiseTimeout(20);

    const responseBuffer = this.popReceiveBuffer();
    return this.parseHTTPResponse(responseBuffer);
  }

  write(data: Buffer): void {
    if (this.encryption) {
      data = hapCrypto.layerEncrypt(data, this.encryption);
    }
    expect(this.currentSocket).toBeDefined();
    this.currentSocket!.write(data);
  }

  releaseSocket(): void {
    if (this.currentSocket && this.currentDataListener) {
      this.currentSocket.removeListener("data", this.currentDataListener);
      this.currentDataListener = undefined;
    }

    expect(this.currentDataListener).toBeUndefined();

    this.currentSocket = undefined;
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
    const tlvDataList = tlv.decodeList(responseBody.slice(3), TLVValues.IDENTIFIER);

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
    const httpResponse = await this.writeHTTPRequest("POST", "/pairings", requestTLV, HAPMimeTypes.PAIRING_TLV8);

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
    const httpResponse = await this.writeHTTPRequest("PUT", "/characteristics", Buffer.from(JSON.stringify(writeRequest)), HAPMimeTypes.HAP_JSON);
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
    const httpResponse = await this.writeHTTPRequest("PUT", "/prepare", Buffer.from(JSON.stringify(prepareWrite)), HAPMimeTypes.HAP_JSON);
    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);

    if (httpResponse.statusCode !== HAPHTTPCode.OK) {
      const jsonBody = JSON.parse(httpResponse.body.toString());
      throw new HAPHTTPError(httpResponse.statusCode, jsonBody.status);
    }
  }

  public async sendResourceRequest(resourceRequest: ResourceRequest): Promise<Buffer> {
    const httpResponse = await this.writeHTTPRequest("POST", "/resource", Buffer.from(JSON.stringify(resourceRequest)), HAPMimeTypes.HAP_JSON);

    if (httpResponse.statusCode !== HAPHTTPCode.OK) {
      expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.HAP_JSON);
      const jsonBody = JSON.parse(httpResponse.body.toString());
      throw new HAPHTTPError(httpResponse.statusCode, jsonBody.status);
    }

    expect(httpResponse.headers["Content-Type"]).toEqual(HAPMimeTypes.IMAGE_JPEG);
    return httpResponse.body;
  }

  parseHTTPResponse(input: Buffer): HTTPResponse {
    // taken and adapted from https://github.com/creationix/http-parser-js/blob/88c665381470e27cd428a728447a13dce198f782/standalone-example.js#L73
    const parser = new HTTPParser(HTTPParser.RESPONSE);

    let complete = false;
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
      shouldKeepAlive = info.shouldKeepAlive;
      upgrade = info.upgrade;
      statusCode = info.statusCode;
      statusMessage = info.statusMessage;
      versionMajor = info.versionMajor;
      versionMinor = info.versionMinor;
      headers = info.headers;
    };

    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
      bodyChunks.push(chunk.slice(offset, offset + length));
    };

    // that's the event for trailers!
    parser[HTTPParser.kOnHeaders] = t => {
      trailers = t;
    };

    parser[HTTPParser.kOnMessageComplete] = () => {
      complete = true;
    };

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input);
    parser.finish();

    if (!complete) {
      throw new Error("Failed to parse input: " + input.toString());
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

  private headersArrayToObject(headers: HeaderObject): Record<string, string> {
    expect(headers.length % 2).toBe(0);

    const result: Record<string, string> = {};

    for (let i = 0; i < headers.length; i += 2) {
      result[headers[i]] = headers[i+1];
    }

    return result;
  }
}
