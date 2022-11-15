import axios, { AxiosResponse } from "axios";
import { Agent, IncomingMessage, ServerResponse } from "http";
import { HAPHTTPClient } from "../../test-utils/HAPHTTPClient";
import { HAPHTTPCode } from "../HAPServer";
import { EventedHTTPServer, EventedHTTPServerEvent, HAPConnection, HAPConnectionEvent } from "./eventedhttp";
import { awaitEventOnce, PromiseTimeout } from "./promise-utils";

describe("eventedhttp", () => {
  let httpAgent: Agent;
  let server: EventedHTTPServer;
  let baseUrl: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultRequestHandler = (connection: any, request: any, response: ServerResponse) => {
    response.writeHead(HAPHTTPCode.OK,  { "Content-Type": "plain/text" });
    response.end("Hello World", "ascii");
  };

  beforeEach(async () => {
    // used to do long living http connections without own tcp interface
    httpAgent = new Agent({
      keepAlive: true,
    });

    server = new EventedHTTPServer();
    // @ts-expect-error: private access
    server.tcpServer.unref();

    server.listen(0);
    await awaitEventOnce(server, EventedHTTPServerEvent.LISTENING);

    const address = server.address();
    baseUrl = `http://${address.address}:${address.port}`;
  });

  afterEach(() => {
    server.stop();
    server.destroy();
  });

  test("simple http request", async () => {
    const connectionOpened: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const connectionClosed: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_CLOSED);

    server.on(EventedHTTPServerEvent.REQUEST, (connection, request, response) => {
      expect(request.method).toBe("GET");
      expect(request.url!.endsWith("/test?query=true")).toBeTruthy();
      response.writeHead(HAPHTTPCode.OK,  { "Content-Type": "plain/text" });
      response.end("Hello World", "ascii");
    });

    const result: AxiosResponse<string> = await axios.get(`${baseUrl}/test?query=true`, { httpAgent });
    expect(result.data).toEqual("Hello World");
    const connection = await connectionOpened;

    // we simulate the connection getting authenticated (e.g. through pair-verify)
    const username = "XX:XX:XX:XX:XX";
    const authenticatedEvent: Promise<string> = awaitEventOnce(connection, HAPConnectionEvent.AUTHENTICATED);
    connection.connectionAuthenticated(username);
    await expect(authenticatedEvent).resolves.toBe(username);

    expect(connection.getLocalAddress("ipv4")).toBe("127.0.0.1");
    expect(connection.getLocalAddress("ipv6")).toBe("::1");

    httpAgent.destroy(); // disconnect HAPConnection

    await connectionClosed;
  });

  test("ensure connection handling respects nature of unpair", async () => {
    // evented http server records the username of every authenticated HAPConnection.
    // For the same Apple ID (username) there might be multiple connections (iDevices, hubs, etc).
    // Once an unpair request happens, all other connections need to be torn down while the connection
    // that made the request must persist till the response is sent out!

    const username = "XX:XX:XX:XX:XX:XX";
    const secondAgent = new Agent({ keepAlive: true });

    // OPEN CONNECTIONS
    server.once(EventedHTTPServerEvent.REQUEST, defaultRequestHandler);
    const connectionOpened0: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const result0: AxiosResponse<string> = await axios.get(baseUrl, { httpAgent });
    expect(result0.data).toEqual("Hello World");
    const connection0 = await connectionOpened0;

    server.once(EventedHTTPServerEvent.REQUEST, defaultRequestHandler);
    const connectionOpened1: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const result1: AxiosResponse<string> = await axios.get(baseUrl, { httpAgent: secondAgent });
    expect(result1.data).toEqual("Hello World");
    const connection1 = await connectionOpened1;

    // AUTHENTICATE CONNECTIONS
    const authenticatedEvent0: Promise<string> = awaitEventOnce(connection0, HAPConnectionEvent.AUTHENTICATED);
    connection0.connectionAuthenticated(username);
    await expect(authenticatedEvent0).resolves.toBe(username);

    const authenticatedEvent1: Promise<string> = awaitEventOnce(connection1, HAPConnectionEvent.AUTHENTICATED);
    connection1.connectionAuthenticated(username);
    await expect(authenticatedEvent1).resolves.toBe(username);

    // we make a request that we don't answer yet!
    const queuedRequestPromise: Promise<[HAPConnection, IncomingMessage, ServerResponse]> = awaitEventOnce(server, EventedHTTPServerEvent.REQUEST);
    const pendingRequest = axios.get(baseUrl, { httpAgent }); // simulate a "unpair" request!
    const queuedResponse = (await queuedRequestPromise)[2];

    // do the unpair!!
    const connectionClosed: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_CLOSED);
    EventedHTTPServer.destroyExistingConnectionsAfterUnpair(connection0, username);
    await expect(connectionClosed).resolves.toBe(connection1);

    await PromiseTimeout(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((secondAgent as any).totalSocketCount <= 0).toBeTruthy(); // assert that the client side was closed!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((httpAgent as any).totalSocketCount).toBe(1); // the other socket shouldn't be closed yet

    // now finish the http request from above!
    defaultRequestHandler(undefined, undefined, queuedResponse!); // just reuse the request handler from above!
    const pendingRequestResult = await pendingRequest;
    expect(pendingRequestResult.data).toBe("Hello World");

    await PromiseTimeout(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((httpAgent as any).totalSocketCount <= 0).toBeTruthy(); // the other socket shall now be closed!
  });

  test("event notifications", async () => {
    const address = server.address();

    server.once(EventedHTTPServerEvent.REQUEST, defaultRequestHandler);

    const connectionOpened: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const result: AxiosResponse<string> = await axios.get(`http://${address.address}:${address.port}/test?query=true`, { httpAgent });
    expect(result.data).toEqual("Hello World");
    const connection = await connectionOpened;

    const client = new HAPHTTPClient(httpAgent, address.address, address.port);
    client.attachSocket(); // capture the free socket of the http agent!

    connection.enableEventNotifications(1, 1);
    // we implicitly test below that this event won't be delivered!
    connection.sendEvent(0, 0, "string");

    expect(connection.hasEventNotifications(1, 1)).toBeTruthy();
    expect(connection.hasEventNotifications(0, 0)).toBeFalsy();
    expect(connection.getRegisteredEvents()).toEqual(new Set(["1.1"]));


    connection.sendEvent(1, 1, "Hello World!");
    connection.sendEvent(1, 1, "Hello World!"); // won't be sent (duplicate)
    connection.sendEvent(1, 1, "Hello Mars!");
    connection.sendEvent(1, 1, "Hello World!"); // should send

    // no immediate delivery!
    await PromiseTimeout(50);
    expect(client.receiveBufferCount).toBe(0);

    await PromiseTimeout(300);
    expect(client.receiveBufferCount).toBe(1);
    expect(client.popReceiveBuffer().toString()).toBe("EVENT/1.0 200 OK\r\n" +
      "Content-Type: application/hap+json\r\n" +
      "Content-Length: 143\r\n" +
      "\r\n" +
      "{\"characteristics\":[" +
      "{\"aid\":1,\"iid\":1,\"value\":\"Hello World!\"}" +
      ",{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"}," +
      "{\"aid\":1,\"iid\":1,\"value\":\"Hello World!\"}" +
      "]}");


    server.broadcastEvent(1, 1, "Hello Sun!", undefined, false);
    // event with immediate delivery shall send currently queued events. Nothing gets out of order!
    connection.sendEvent(1, 1, "Hello Mars!", true);
    await PromiseTimeout(10);
    expect(client.receiveBufferCount).toBe(1);
    expect(client.popReceiveBuffer().toString()).toBe("EVENT/1.0 200 OK\r\n" +
      "Content-Type: application/hap+json\r\n" +
      "Content-Length: 100\r\n" +
      "\r\n" +
      "{\"characteristics\":[{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"},{\"aid\":1,\"iid\":1,\"value\":\"Hello Sun!\"}]}");


    server.broadcastEvent(1, 1, "Hello Sun!", connection, true);
    await PromiseTimeout(10);
    expect(client.receiveBufferCount).toBe(0);

    // NOW we test event delivery when there is ongoing request
    const testEventDelivery = async (sendEvents: () => Promise<void>, assertResult: () => Promise<void>) => {
      const queuedRequestPromise: Promise<[HAPConnection, IncomingMessage, ServerResponse]> = awaitEventOnce(server, EventedHTTPServerEvent.REQUEST);
      // we can't use axios here, as our special EVENT http message is involved!

      client.write(client.formatHTTPRequest("GET", "/"));
      const queuedResponse: ServerResponse = (await queuedRequestPromise)[2];

      await sendEvents();

      defaultRequestHandler(undefined, undefined, queuedResponse!); // just reuse the request handler from above!

      await PromiseTimeout(20);
      await assertResult();
    };

    await testEventDelivery(
      async () => {
        // we expect both events to be delivered immediately as there is one which is required to be delivered immediately
        connection.sendEvent(1, 1, "Hello World!", true);
        connection.sendEvent(1, 1, "Hello Mars!");
      },
      async () => {
        expect(client.receiveBufferCount > 0).toBeTruthy();

        let eventMessage = "";
        // sometimes the HTTP response message and the EVENT message are combined
        // into a single TCP segment, sometimes they get sent separately.
        while (client.receiveBufferCount > 0) {
          eventMessage = client.popReceiveBuffer().toString();
        }

        expect(eventMessage.includes("EVENT/1.0")).toBeTruthy();
        const event = eventMessage.substring(eventMessage.indexOf("EVENT")); // splicing away the http response!
        expect(event).toBe("EVENT/1.0 200 OK\r\n" +
          "Content-Type: application/hap+json\r\n" +
          "Content-Length: 102\r\n" +
          "\r\n" +
          "{\"characteristics\":[{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"},{\"aid\":1,\"iid\":1,\"value\":\"Hello World!\"}]}");
      },
    );

    await testEventDelivery(
      async () => {
        connection.sendEvent(1, 1, "Hello Mars!");
        connection.sendEvent(1, 1, "Hello Sun!");
      },
      async () => {
        expect(client.receiveBufferCount).toBe(1);
        expect(client.popReceiveBuffer().toString().includes("EVENT")).toBeFalsy();

        await PromiseTimeout(300);
        expect(client.receiveBufferCount).toBe(1);
        expect(client.popReceiveBuffer().toString()).toBe("EVENT/1.0 200 OK\r\n" +
          "Content-Type: application/hap+json\r\n" +
          "Content-Length: 100\r\n" +
          "\r\n" +
          "{\"characteristics\":[{\"aid\":1,\"iid\":1,\"value\":\"Hello Sun!\"},{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"}]}");
      },
    );

    await testEventDelivery(
      async () => {
        connection.sendEvent(1, 1, "Hello Mars!");
        await PromiseTimeout(300); // the timeout runs out while the request is still processed
      },
      async () => {
        expect(client.receiveBufferCount > 0).toBeTruthy();

        let eventMessage = "";
        // sometimes the HTTP response message and the EVENT message are combined
        // into a single TCP segment, sometimes they get sent separately.
        while (client.receiveBufferCount > 0) {
          eventMessage = client.popReceiveBuffer().toString();
        }

        expect(eventMessage.includes("EVENT/1.0")).toBeTruthy();
        const event = eventMessage.substring(eventMessage.indexOf("EVENT")); // splicing away the http response!
        expect(event).toBe("EVENT/1.0 200 OK\r\n" +
          "Content-Type: application/hap+json\r\n" +
          "Content-Length: 61\r\n" +
          "\r\n" +
          "{\"characteristics\":[{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"}]}");
      },
    );

    client.releaseSocket();
  });

  // TODO test events not delivered while in a request!
});
