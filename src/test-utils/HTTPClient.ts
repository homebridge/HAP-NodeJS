import { Agent } from "http";
import { Socket } from "net";

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

  popReceiveBuffer(): Buffer {
    expect(this.currentSocket).not.toBeUndefined();
    expect(this.dataQueue.length > 0).toBeTruthy();
    return this.dataQueue.splice(0, 1)[0];
  }

  formatHTTPRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    route: string,
    data?: string,
    contentType = "application/json",
  ): Buffer {
    expect(!!data || method === "GET").toBeTruthy();
    return Buffer.from(`${method} ${route} HTTP/1.1\r\n` +
      "Accept: application/json, text/plain, */*\r\n" +
      "User-Agent: test-util\r\n" +
      "Host: " + this.address + ":" + this.port + "\r\n" +
      "Connection: keep-alive\r\n" +
      (data
        ? "Content-Type: " + contentType + "\r\n" +
          "Content-Length: " + data.length + "\r\n"
        : ""
      ) +
      "\r\n" +
      (data
        ? data
        : ""
      ));
  }

  writeHTTPRequest(method: "GET" | "POST" | "PUT" | "DELETE", route: string, data?: string): void {
    this.write(this.formatHTTPRequest(method, route, data));
  }

  write(data: Buffer): void {
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
}
