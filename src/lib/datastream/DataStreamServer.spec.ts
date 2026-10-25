import crypto from "crypto";
import { EventEmitter } from "events";
import { Socket } from "net";
import { HAPConnection } from "../util/eventedhttp";
import * as hapCrypto from "../util/hapCrypto";
import { DataStreamParser, DataStreamWriter } from "./DataStreamParser";
import { DataStreamConnection, DataStreamServer, PreparedDataStreamSession } from "./DataStreamServer";

class FakeSocket extends EventEmitter {
  remoteAddress = "192.0.2.1";
  setNoDelay = jest.fn();
  setKeepAlive = jest.fn();
  write = jest.fn();
  end = jest.fn();
  destroy = jest.fn();
}

interface TestSession {
  server: DataStreamServer;
  socket: FakeSocket;
  connection: DataStreamConnection;
  prepared: PreparedDataStreamSession;
  nonce: number;
}

function setupSession(): TestSession {
  const server = new DataStreamServer();
  const hapConnection = new EventEmitter() as unknown as HAPConnection;
  const prepared: PreparedDataStreamSession = {
    connection: hapConnection,
    accessoryToControllerEncryptionKey: crypto.randomBytes(32),
    controllerToAccessoryEncryptionKey: crypto.randomBytes(32),
    accessoryKeySalt: crypto.randomBytes(32),
  };
  server.preparedSessions.push(prepared);

  const socket = new FakeSocket();
  // @ts-expect-error: private method access
  server.onConnection(socket as unknown as Socket);
  // @ts-expect-error: private property access
  const connection: DataStreamConnection = server.connections[0];

  return {
    server,
    socket,
    connection,
    prepared,
    nonce: 0,
  };
}

// builds a frame encrypted with the controller-to-accessory key of the session
function encryptedFrame(session: TestSession, payload: Buffer): Buffer {
  const header = Buffer.from([0x01, 0, 0, 0]);
  header.writeUIntBE(payload.length, 1, 3);

  const nonce = Buffer.alloc(8);
  hapCrypto.writeUInt64LE(session.nonce++, nonce);
  const encrypted = hapCrypto.chacha20_poly1305_encryptAndSeal(session.prepared.controllerToAccessoryEncryptionKey, nonce, header, payload);

  return Buffer.concat([header, encrypted.ciphertext, encrypted.authTag]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function messagePayload(header: Record<string, any>, message: Record<string, any> = {}): Buffer {
  const headerWriter = new DataStreamWriter();
  const messageWriter = new DataStreamWriter();
  DataStreamParser.encode(header, headerWriter);
  DataStreamParser.encode(message, messageWriter);

  return Buffer.concat([
    Buffer.from([
      headerWriter.length(),
    ]),
    headerWriter.getData(),
    messageWriter.getData(),
  ]);
}

describe("DataStreamServer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("connection identification", () => {
    it("should close an unidentified connection without crashing on its undecryptable first frame", () => {
      const { socket } = setupSession();

      // someone without any keys: a frame header (type 1, length 0) followed by a junk 16-byte auth tag
      const junk = Buffer.concat([
        Buffer.from([0x01, 0, 0, 0]),
        Buffer.alloc(16),
      ]);

      expect(() => socket.emit("data", junk)).not.toThrow();
      expect(socket.end).toHaveBeenCalled();
    });

    it("should accept a hello request from an identified connection", () => {
      const session = setupSession();

      session.socket.emit("data", encryptedFrame(session, messagePayload({ protocol: "control", request: "hello", id: 1 })));

      expect(session.socket.end).not.toHaveBeenCalled();
      expect(session.socket.write).toHaveBeenCalledTimes(1); // the hello response
    });
  });

  describe("malformed frames", () => {
    function identifiedSession(): TestSession {
      const session = setupSession();
      session.socket.emit("data", encryptedFrame(session, messagePayload({ protocol: "control", request: "hello", id: 1 })));
      return session;
    }

    it.each([
      [
        "an empty payload",
        Buffer.alloc(0),
      ],
      [
        "a header length longer than the payload",
        Buffer.from([0x05, 0x04]),
      ],
      [
        "an undecodable header",
        Buffer.from([0x01, 0x00]),
      ],
      [
        "a header which is not a dictionary",
        Buffer.from([0x01, 0x04, 0xE0]),
      ],
    ])("should drop a first frame with %s and close the connection", (_, payload) => {
      const session = setupSession();

      expect(() => session.socket.emit("data", encryptedFrame(session, payload))).not.toThrow();
      expect(session.socket.end).toHaveBeenCalled();
    });

    it.each([
      [
        "an empty payload",
        Buffer.alloc(0),
      ],
      [
        "a header length longer than the payload",
        Buffer.from([0x05, 0x04]),
      ],
      [
        "a header which is not a dictionary",
        Buffer.from([0x01, 0x04, 0xE0]),
      ],
    ])("should drop a later frame with %s", (_, payload) => {
      const session = identifiedSession();

      expect(() => session.socket.emit("data", encryptedFrame(session, payload))).not.toThrow();
      expect(session.socket.end).not.toHaveBeenCalled();
    });
  });

  describe("closing", () => {
    it("should destroy a closed socket which the remote never closes", () => {
      const { socket, connection } = setupSession();

      connection.close();
      expect(socket.end).toHaveBeenCalledTimes(1);
      expect(socket.destroy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      expect(socket.destroy).toHaveBeenCalledTimes(1);
    });

    it("should not destroy a socket which the remote closed in time", () => {
      const { socket, connection } = setupSession();

      connection.close();
      socket.emit("close");

      jest.advanceTimersByTime(5000);
      expect(socket.destroy).not.toHaveBeenCalled();
    });
  });
});
