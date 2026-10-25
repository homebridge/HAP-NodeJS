import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
  BufferEventCommandType,
  BufferUploadCommandType,
  BufferUploadStopAction,
  CameraBufferEventType,
  CameraSensorIntent,
  CameraSensorType,
  CameraVideoQuality,
  CMAFError,
  createClientCSR,
  decodeBufferEventCommand,
  decodeBufferEventCommandResponse,
  decodeBufferUploadCommand,
  decodeCameraCapabilities,
  decodeCameraRecordingPublishingPoint,
  decodeCameraZones,
  decodeSupportedAudioStreamTiers,
  decodeSupportedVideoStreamTiers,
  decodeWebRTCProvideAnswer,
  decodeWebRTCUpdateSession,
  encodeBufferEventCommandResponse,
  encodeCameraCapabilities,
  encodeCameraRecordingPublishingPoint,
  encodeCameraZones,
  encodeSupportedAudioStreamTiers,
  encodeSupportedVideoStreamTiers,
  generateClientKey,
  StreamTierAudioBitDepth,
  StreamTierAudioCodec,
  StreamTierAudioSampleRate,
  StreamTierVideoCodec,
  ZoneApplicationMethod,
} from ".";

function tlv(type: number, value: Buffer | number[]): Buffer {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([Buffer.from([type, data.length]), data]);
}

describe("SecureVideoTypes", () => {
  test("video stream tiers round trip with delimited tier list", () => {
    const value = {
      codec: StreamTierVideoCodec.H265,
      payloadType: 99,
      tiers: [
        { identifier: 1, quality: CameraVideoQuality.HIGH, targetAverageBitrate: 2800, width: 2560, height: 1440, frameRate: 30 },
        { identifier: 2, quality: CameraVideoQuality.MEDIUM, targetAverageBitrate: 1700, width: 1920, height: 1080, frameRate: 30 },
        { identifier: 3, quality: CameraVideoQuality.LOW, targetAverageBitrate: 180, width: 640, height: 360, frameRate: 15 },
      ],
    };

    const encoded = encodeSupportedVideoStreamTiers(value);
    expect(encoded.includes(Buffer.from([0x00, 0x00, 0x03]))).toBe(true);
    expect(decodeSupportedVideoStreamTiers(encoded)).toEqual(value);
  });

  test("audio stream tiers round trip", () => {
    const value = {
      codec: StreamTierAudioCodec.OPUS,
      payloadType: 110,
      tiers: [{
        identifier: 1,
        targetAverageBitrate: 24000,
        sampleRate: StreamTierAudioSampleRate.KHZ_16,
        bitDepth: StreamTierAudioBitDepth.BITS_16,
        packetTime: 20,
        channels: 1,
      }],
    };

    expect(decodeSupportedAudioStreamTiers(encodeSupportedAudioStreamTiers(value))).toEqual(value);
  });

  test("camera capabilities round trip", () => {
    const value = {
      version: 1,
      sensors: [{
        width: 2560,
        height: 1440,
        sensorUUID: crypto.randomUUID(),
        type: CameraSensorType.PRIMARY,
        intent: CameraSensorIntent.MAIN,
        videoStreams: [1, 2].map(index => ({
          identifier: crypto.randomUUID(),
          quality: index === 1 ? CameraVideoQuality.HIGH : CameraVideoQuality.LOW,
          width: 640 * index,
          height: 360 * index,
          frameRate: 30,
          averageBitrate: 180 * index,
          peakBitrate: 190 * index,
        })),
      }],
    };

    expect(decodeCameraCapabilities(encodeCameraCapabilities(value))).toEqual(value);
  });

  test("uint64 fields keep precision beyond 2^53", () => {
    const start = 0xE8F1_2345_6789_ABCDn;
    const request = Buffer.concat([
      tlv(1, Buffer.from("0100000000000000", "hex")),
      tlv(2, [BufferUploadCommandType.START_AND_STOP]),
      tlv(3, Buffer.from(start.toString(16).padStart(16, "0"), "hex").reverse()),
      tlv(4, Buffer.from((start + 5000n).toString(16).padStart(16, "0"), "hex").reverse()),
      tlv(5, [BufferUploadStopAction.FINALIZE]),
    ]);

    expect(decodeBufferUploadCommand(request)).toEqual({
      sessionId: 1n,
      command: BufferUploadCommandType.START_AND_STOP,
      start,
      stop: start + 5000n,
      stopAction: BufferUploadStopAction.FINALIZE,
    });
  });

  test("short integer encodings are accepted", () => {
    expect(decodeBufferEventCommand(Buffer.concat([tlv(1, [BufferEventCommandType.QUERY]), tlv(2, [5]), tlv(3, [10])])))
      .toEqual({ command: BufferEventCommandType.QUERY, sequenceNumber: 5n, limit: 10n });
  });

  test("buffer events round trip", () => {
    const events = [
      { sequenceNumber: 1n, type: CameraBufferEventType.MOTION as const, active: true },
      { sequenceNumber: 2n, type: CameraBufferEventType.CMAF_SESSION_START as const, cmafSessionId: 7n },
      { sequenceNumber: 3n, type: CameraBufferEventType.CMAF_ERROR as const, cmafSessionId: 7n, error: CMAFError.HTTP_INIT_MISSING },
      { sequenceNumber: 4n, type: CameraBufferEventType.CMAF_SESSION_STOP as const, cmafSessionId: 7n },
    ];

    expect(decodeBufferEventCommandResponse(encodeBufferEventCommandResponse(events))).toEqual(events);
    expect(encodeBufferEventCommandResponse([]).length).toBe(0);
  });

  test("candidates are read as a list with and without delimiters", () => {
    const sessionId = crypto.randomBytes(16);
    const candidate = (text: string) => tlv(3, tlv(1, Buffer.from(text)));
    const answer = Buffer.from("v=0\r\n".repeat(80));
    const sdp = Buffer.concat([tlv(2, answer.subarray(0, 255)), tlv(2, answer.subarray(255))]);

    const delimited = decodeWebRTCProvideAnswer(Buffer.concat([tlv(1, sessionId), sdp, candidate("a"), Buffer.from([0, 0]), candidate("b")]));
    const packed = decodeWebRTCProvideAnswer(Buffer.concat([tlv(1, sessionId), sdp, candidate("a"), candidate("b")]));

    expect(delimited.sdpAnswer).toBe(answer.toString());
    expect(delimited.candidates.map(entry => entry.candidate)).toEqual(["a", "b"]);
    expect(packed.candidates.map(entry => entry.candidate)).toEqual(["a", "b"]);
  });

  test("update session decodes keys and kids", () => {
    const request = Buffer.concat([
      tlv(1, crypto.randomBytes(16)),
      tlv(2, Buffer.concat([tlv(1, Buffer.alloc(16, 1)), tlv(2, [9])])),
      tlv(3, tlv(1, [3])),
    ]);

    const decoded = decodeWebRTCUpdateSession(request);
    expect(decoded.receiveKeysToAdd).toEqual([{ key: Buffer.alloc(16, 1), kid: 9n }]);
    expect(decoded.receiveKIDsToRemove).toEqual([3n]);
  });

  test("publishing point with large certificates round trip", () => {
    const value = { url: "https://ingest.example.com/abc/", serverCACertificates: [crypto.randomBytes(900), crypto.randomBytes(300)] };
    expect(decodeCameraRecordingPublishingPoint(encodeCameraRecordingPublishingPoint(value))).toEqual(value);
  });

  test("camera zones round trip", () => {
    const value = {
      version: 2,
      zones: [{
        method: ZoneApplicationMethod.INVERTED,
        polygons: [{ identifier: crypto.randomUUID(), vertices: [{ x: 0, y: 0 }, { x: 2559, y: 0 }, { x: 1200, y: 1439 }] }],
      }],
    };
    expect(decodeCameraZones(encodeCameraZones(value))).toEqual(value);
  });

  test("client csr is a valid PKCS#10 request and the nonce signature verifies", () => {
    const key = generateClientKey();
    const nonce = crypto.randomBytes(32);
    const { csr, nonceSignature } = createClientCSR(key, "camera.ui test", nonce);

    expect(nonceSignature.length).toBe(64);
    expect(crypto.verify("sha256", nonce, { key: crypto.createPublicKey(key), dsaEncoding: "ieee-p1363" }, nonceSignature)).toBe(true);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "csr-"));
    const file = path.join(directory, "request.der");
    fs.writeFileSync(file, csr);
    try {
      const output = execFileSync("openssl", ["req", "-inform", "DER", "-in", file, "-verify", "-noout", "-subject"], { stdio: "pipe" }).toString();
      expect(output).toContain("camera.ui test");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
