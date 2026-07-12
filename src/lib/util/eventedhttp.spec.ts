import { IncomingMessage, ServerResponse } from "http";
import { HAPHTTPClient } from "../../test-utils/HAPHTTPClient";
import { HAPHTTPCode } from "../HAPServer";
import { EventedHTTPServer, EventedHTTPServerEvent, HAPConnection, HAPConnectionEvent } from "./eventedhttp";
import { awaitEventOnce, PromiseTimeout } from "./promise-utils";

describe("eventedhttp", () => {
  let clients: HAPHTTPClient[];
  let server: EventedHTTPServer;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultRequestHandler = (connection: any, request: any, response: ServerResponse) => {
    response.writeHead(HAPHTTPCode.OK,  { "Content-Type": "plain/text" });
    response.end("Hello World", "ascii");
  };

  // Creates a connected client and registers it for teardown. One client instance owns one TCP connection, which is
  // exactly one server-side HAPConnection.
  const connectClient = async (): Promise<HAPHTTPClient> => {
    const address = server.address();
    const client = new HAPHTTPClient(address.address, address.port);
    await client.connect();
    clients.push(client);
    return client;
  };

  beforeEach(async () => {
    clients = [];

    server = new EventedHTTPServer();
    // @ts-expect-error: private access
    server.tcpServer.unref();

    server.listen(0);
    await awaitEventOnce(server, EventedHTTPServerEvent.LISTENING);
  });

  afterEach(() => {
    for (const client of clients) {
      client.destroy();
    }
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

    const client = await connectClient();
    const result = await client.writeHTTPRequest("GET", "/test?query=true");
    expect(result.statusCode).toBe(HAPHTTPCode.OK);
    expect(result.body.toString()).toEqual("Hello World");
    const connection = await connectionOpened;

    // we simulate the connection getting authenticated (e.g. through pair-verify)
    const username = "XX:XX:XX:XX:XX";
    const authenticatedEvent: Promise<string> = awaitEventOnce(connection, HAPConnectionEvent.AUTHENTICATED);
    connection.connectionAuthenticated(username);
    await expect(authenticatedEvent).resolves.toBe(username);

    expect(connection.getLocalAddress("ipv4")).toBe("127.0.0.1");
    expect(connection.getLocalAddress("ipv6")).toBe("::1");

    client.destroy(); // disconnect HAPConnection

    await connectionClosed;
  });

  test("ensure connection handling respects nature of unpair", async () => {
    // evented http server records the username of every authenticated HAPConnection.
    // For the same Apple ID (username) there might be multiple connections (iDevices, hubs, etc).
    // Once an unpair request happens, all other connections need to be torn down while the connection
    // that made the request must persist till the response is sent out!

    const username = "XX:XX:XX:XX:XX:XX";

    // OPEN CONNECTIONS
    server.once(EventedHTTPServerEvent.REQUEST, defaultRequestHandler);
    const connectionOpened0: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const client0 = await connectClient();
    const connection0 = await connectionOpened0;
    const result0 = await client0.writeHTTPRequest("GET", "/");
    expect(result0.statusCode).toBe(HAPHTTPCode.OK);
    expect(result0.body.toString()).toEqual("Hello World");

    server.once(EventedHTTPServerEvent.REQUEST, defaultRequestHandler);
    const connectionOpened1: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const client1 = await connectClient();
    const connection1 = await connectionOpened1;
    const result1 = await client1.writeHTTPRequest("GET", "/");
    expect(result1.statusCode).toBe(HAPHTTPCode.OK);
    expect(result1.body.toString()).toEqual("Hello World");

    // AUTHENTICATE CONNECTIONS
    const authenticatedEvent0: Promise<string> = awaitEventOnce(connection0, HAPConnectionEvent.AUTHENTICATED);
    connection0.connectionAuthenticated(username);
    await expect(authenticatedEvent0).resolves.toBe(username);

    const authenticatedEvent1: Promise<string> = awaitEventOnce(connection1, HAPConnectionEvent.AUTHENTICATED);
    connection1.connectionAuthenticated(username);
    await expect(authenticatedEvent1).resolves.toBe(username);

    // we make a request that we don't answer yet!
    const queuedRequestPromise: Promise<[HAPConnection, IncomingMessage, ServerResponse]> = awaitEventOnce(server, EventedHTTPServerEvent.REQUEST);
    client0.write(client0.formatHTTPRequest("GET", "/")); // simulate a "unpair" request!
    const queuedResponse = (await queuedRequestPromise)[2];

    // do the unpair!!
    const connectionClosed: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_CLOSED);
    EventedHTTPServer.destroyExistingConnectionsAfterUnpair(connection0, username);
    await expect(connectionClosed).resolves.toBe(connection1);

    // the other connection's client side must observe the teardown, while the requesting connection stays open until
    // its response has been sent out
    await client1.waitForClose();
    expect(client0.isClosed).toBe(false);

    // now finish the http request from above!
    defaultRequestHandler(undefined, undefined, queuedResponse!); // just reuse the request handler from above!
    const pendingResponse = await client0.readHTTPResponse();
    expect(pendingResponse.statusCode).toBe(HAPHTTPCode.OK);
    expect(pendingResponse.body.toString()).toBe("Hello World");

    // once the response is out the server tears the requesting connection down as well
    await client0.waitForClose();
  });

  test("event notifications", async () => {
    server.once(EventedHTTPServerEvent.REQUEST, defaultRequestHandler);

    const connectionOpened: Promise<HAPConnection> = awaitEventOnce(server, EventedHTTPServerEvent.CONNECTION_OPENED);
    const client = await connectClient();
    const connection = await connectionOpened;

    const result = await client.writeHTTPRequest("GET", "/test?query=true");
    expect(result.statusCode).toBe(HAPHTTPCode.OK);
    expect(result.body.toString()).toEqual("Hello World");

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

    // Regular events are coalesced: nothing may be delivered before the coalescing window elapses. We wait a fraction of
    // that window - comfortably less than it, since a timer never fires early - and assert nothing has arrived yet.
    await PromiseTimeout(HAPConnection.EVENT_COALESCING_DELAY / 5);
    expect(client.receiveBufferCount).toBe(0);

    // Once the coalescing timer fires the batched events flush as a single notification. We await the actual arrival
    // rather than a fixed delay so the assertion holds regardless of how the runtime schedules the round-trip.
    await client.waitForData(1);
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
    // An event flagged for immediate delivery flushes the currently queued events along with it. The wait is bounded well
    // below the coalescing window, so a regression to timer-based delivery fails loudly instead of passing late with the
    // same bytes.
    connection.sendEvent(1, 1, "Hello Mars!", true);
    await client.waitForData(1, HAPConnection.EVENT_COALESCING_DELAY / 2);
    expect(client.receiveBufferCount).toBe(1);
    expect(client.popReceiveBuffer().toString()).toBe("EVENT/1.0 200 OK\r\n" +
      "Content-Type: application/hap+json\r\n" +
      "Content-Length: 100\r\n" +
      "\r\n" +
      "{\"characteristics\":[{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"},{\"aid\":1,\"iid\":1,\"value\":\"Hello Sun!\"}]}");


    // The originating connection is excluded from its own broadcast, so it must receive nothing. Exclusion is decided
    // synchronously when the broadcast is dispatched, so a brief settle is enough to confirm non-delivery.
    server.broadcastEvent(1, 1, "Hello Sun!", connection, true);
    await PromiseTimeout(HAPConnection.EVENT_COALESCING_DELAY / 5);
    expect(client.receiveBufferCount).toBe(0);

    // NOW we test event delivery when there is ongoing request
    const testEventDelivery = async (sendEvents: () => Promise<void>, assertResult: () => Promise<void>) => {
      const queuedRequestPromise: Promise<[HAPConnection, IncomingMessage, ServerResponse]> = awaitEventOnce(server, EventedHTTPServerEvent.REQUEST);
      // the request is deliberately left unanswered for now, so we write the raw bytes and defer reading the response
      client.write(client.formatHTTPRequest("GET", "/"));
      const queuedResponse: ServerResponse = (await queuedRequestPromise)[2];

      await sendEvents();

      defaultRequestHandler(undefined, undefined, queuedResponse!); // just reuse the request handler from above!

      // Each assertion awaits exactly the delivery it expects, so no fixed settle delay is needed here.
      await assertResult();
    };

    await testEventDelivery(
      async () => {
        // we expect both events to be delivered immediately as there is one which is required to be delivered immediately
        connection.sendEvent(1, 1, "Hello World!", true);
        connection.sendEvent(1, 1, "Hello Mars!");
      },
      async () => {
        // The immediate event forces the HTTP response and the EVENT message out together; they may share one TCP segment
        // or arrive as two, so we read until the EVENT marker is present rather than assuming a segment count. The read is
        // bounded well below the coalescing window so an event that wrongly arrives on the coalescing timer fails loudly.
        const received = await client.readUntil("EVENT/1.0", HAPConnection.EVENT_COALESCING_DELAY / 2);
        const event = received.substring(received.indexOf("EVENT")); // splicing away the http response!
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
        // These events are coalesced, so only the HTTP response returns with the request and it must not contain an EVENT.
        await client.waitForData(1);
        expect(client.popReceiveBuffer().toString().includes("EVENT")).toBeFalsy();

        // Nothing further may arrive before the coalescing window elapses - a flush-with-response regression lands here
        // regardless of whether the runtime coalesced it into the response segment or sent it as its own.
        await PromiseTimeout(HAPConnection.EVENT_COALESCING_DELAY / 5);
        expect(client.receiveBufferCount).toBe(0);

        // After the coalescing window the batched event is flushed as its own notification.
        await client.waitForData(1);
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
        // Let the coalescing timer fire while the request is still open, exercising the path where queued events are
        // flushed together with the response instead of on their own timer.
        await PromiseTimeout(HAPConnection.EVENT_COALESCING_DELAY + 50);
      },
      async () => {
        // Response and coalesced event flush together and may or may not share a TCP segment, so read until the marker.
        const received = await client.readUntil("EVENT/1.0");
        const event = received.substring(received.indexOf("EVENT")); // splicing away the http response!
        expect(event).toBe("EVENT/1.0 200 OK\r\n" +
          "Content-Type: application/hap+json\r\n" +
          "Content-Length: 61\r\n" +
          "\r\n" +
          "{\"characteristics\":[{\"aid\":1,\"iid\":1,\"value\":\"Hello Mars!\"}]}");
      },
    );
  });

  // TODO test events not delivered while in a request!
});
