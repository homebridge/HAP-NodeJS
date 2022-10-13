import { Agent } from "http";
import { HeaderObject, HTTPParser } from "http-parser-js";
import { Socket } from "net";
import { HAPEncryption } from "../lib/util/eventedhttp";
import * as hapCrypto from "../lib/util/hapCrypto";

export interface HTTPResponse {
  shouldKeepAlive: boolean;
  upgrade: boolean;
  statusCode: number;
  statusMessage: string;
  versionMajor: number;
  versionMinor: number;
  headers: Record<string, string>;
  body: Buffer;
  trailers: string[];
}

/**
 * A http client that wraps around a http agent.
 */
export class HTTPClient {
  private readonly agent: Agent;
  private readonly address: string;
  private readonly port: number;

  private currentSocket?: Socket;

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

  popReceiveBuffer(encryption?: HAPEncryption): Buffer {
    expect(this.currentSocket).not.toBeUndefined();
    expect(this.dataQueue.length > 0).toBeTruthy();
    const buffer = this.dataQueue.splice(0, 1)[0];
    if (encryption) {
      return hapCrypto.layerDecrypt(buffer, encryption);
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

  writeHTTPRequest(method: "GET" | "POST" | "PUT" | "DELETE", route: string, data?: Buffer): void {
    this.write(this.formatHTTPRequest(method, route, data));
  }

  write(data: Buffer, encryption?: HAPEncryption): void {
    if (encryption) {
      data = hapCrypto.layerEncrypt(data, encryption);
    }
    expect(this.currentSocket).not.toBeUndefined();
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
