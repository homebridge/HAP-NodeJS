import * as uuid from "../util/uuid";

const DELIMITER = Buffer.from([0x00, 0x00]);

/**
 * @group Camera Secure Video
 */
export const CAMERA_CAPABILITIES_VERSION = "17.99";

/**
 * @group Camera Secure Video
 */
export const enum StreamTierVideoCodec {
  H264 = 1,
  H265 = 2,
}

/**
 * @group Camera Secure Video
 */
export const enum StreamTierAudioCodec {
  OPUS = 3,
}

/**
 * @group Camera Secure Video
 */
export const enum CameraVideoQuality {
  HIGHEST = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
}

/**
 * @group Camera Secure Video
 */
export const enum StreamTierAudioSampleRate {
  KHZ_16 = 1,
  KHZ_24 = 2,
  KHZ_32 = 3,
  KHZ_48 = 4,
}

/**
 * @group Camera Secure Video
 */
export const enum StreamTierAudioBitDepth {
  BITS_8 = 1,
  BITS_16 = 2,
  BITS_24 = 3,
}

/**
 * @group Camera Secure Video
 */
export const enum CameraSensorType {
  UNKNOWN = 0,
  PRIMARY = 1,
  GENERIC = 255,
}

/**
 * @group Camera Secure Video
 */
export const enum CameraSensorIntent {
  UNKNOWN = 0,
  MAIN = 1,
  PACKAGE = 2,
  GENERIC = 255,
}

/**
 * @group Camera Secure Video
 */
export const enum RTPStreamingCommand {
  END = 1,
  START = 2,
}

/**
 * @group Camera Secure Video
 */
export const enum RTPStreamingStatus {
  SUCCESS = 0,
  UNKNOWN_SESSION_IDENTIFIER = 1,
  NO_SUCH_STREAM = 2,
  BUSY = 3,
  ERROR = 4,
}

/**
 * @group Camera Secure Video
 */
export const enum WebRTCSolicitOfferStatus {
  SUCCESS = 0,
  PRIVACY_MODE_ACTIVE = 1,
  ERROR = 2,
}

/**
 * @group Camera Secure Video
 */
export const enum WebRTCStreamingStatus {
  SUCCESS = 0,
  UNKNOWN_SESSION_IDENTIFIER = 1,
  BUSY = 2,
  ERROR = 3,
}

/**
 * @group Camera Secure Video
 */
export const enum WebRTCStreamingCommand {
  END = 1,
}

/**
 * @group Camera Secure Video
 */
export const enum BufferUploadCommandType {
  START = 1,
  START_AND_STOP = 2,
  STOP = 3,
}

/**
 * @group Camera Secure Video
 */
export const enum BufferUploadStopAction {
  PAUSE = 1,
  FINALIZE = 2,
}

/**
 * @group Camera Secure Video
 */
export const enum BufferActivity {
  SHOULD_RECORD = 1,
  SHOULD_NOT_RECORD = 2,
}

/**
 * @group Camera Secure Video
 */
export const enum BufferEventCommandType {
  QUERY = 1,
  ACKNOWLEDGE = 2,
}

/**
 * @group Camera Secure Video
 */
export const enum CameraBufferEventType {
  CMAF_SESSION_START = 1,
  CMAF_SESSION_STOP = 2,
  MOTION = 3,
  CMAF_ERROR = 4,
}

/**
 * @group Camera Secure Video
 */
export const enum CMAFError {
  NONE = 0,
  UNKNOWN = 1,
  CANNOT_FIND_HOST = 2,
  CERT_CONNECTION_FAILURE = 3,
  CANNOT_CERTIFY = 4,
  INVALID_STATE = 5,
  REQUIRES_RETRY = 6,
  NO_RESPONSE = 7,
  MAX_SESSION_TIME_EXCEEDED = 8,
  CANCELED = 9,
  MP4_ERROR = 10,
  CONNECTION_FAILED = 11,
  TIMEOUT = 12,
  OUT_OF_RESOURCES = 13,
  INVALID_DATA = 14,
  HTTP_BAD_REQUEST = 15,
  HTTP_INVALID_TOKEN = 16,
  HTTP_CAMERA_ZONE_DISABLED = 17,
  HTTP_MISMATCHED_TOKEN = 18,
  HTTP_NOT_FOUND = 19,
  HTTP_INIT_MISSING = 20,
  HTTP_UNSUPPORTED_MEDIA_TYPE = 21,
  HTTP_BLOCKED = 22,
  HTTP_CERTIFICATE_EXPIRED = 23,
  HTTP_INTERNAL_SERVER_ERROR = 24,
  HTTP_SERVICE_UNAVAILABLE = 25,
  HTTP_CAMERA_ZONE_DOES_NOT_EXIST = 26,
}

/**
 * @group Camera Secure Video
 */
export const enum ZoneApplicationMethod {
  NORMAL = 1,
  INVERTED = 2,
}

/**
 * @group Camera Secure Video
 */
export interface VideoStreamTier {
  identifier: number;
  quality: CameraVideoQuality;
  /** kbps */
  targetAverageBitrate: number;
  width: number;
  height: number;
  frameRate: number;
}

/**
 * @group Camera Secure Video
 */
export interface SupportedVideoStreamTiersValue {
  codec: StreamTierVideoCodec;
  payloadType: number;
  tiers: VideoStreamTier[];
}

/**
 * @group Camera Secure Video
 */
export interface AudioStreamTier {
  identifier: number;
  /** bits per second */
  targetAverageBitrate: number;
  sampleRate: StreamTierAudioSampleRate;
  bitDepth: StreamTierAudioBitDepth;
  packetTime: number;
  channels: number;
}

/**
 * @group Camera Secure Video
 */
export interface SupportedAudioStreamTiersValue {
  codec: StreamTierAudioCodec;
  payloadType: number;
  tiers: AudioStreamTier[];
}

/**
 * @group Camera Secure Video
 */
export interface CameraVideoStreamCapability {
  /** uuid string */
  identifier: string;
  quality: CameraVideoQuality;
  width: number;
  height: number;
  frameRate: number;
  /** kbps */
  averageBitrate: number;
  /** kbps */
  peakBitrate: number;
}

/**
 * @group Camera Secure Video
 */
export interface CameraSensorConfiguration {
  width: number;
  height: number;
  /** uuid string */
  sensorUUID: string;
  type: CameraSensorType;
  intent: CameraSensorIntent;
  videoStreams: CameraVideoStreamCapability[];
}

/**
 * @group Camera Secure Video
 */
export interface CameraCapabilitiesValue {
  version: number;
  sensors: CameraSensorConfiguration[];
}

/**
 * @group Camera Secure Video
 */
export interface RTPStreamingControlRequest {
  sessionIdentifier: string;
  command: RTPStreamingCommand;
  videoTier?: number;
  videoSSRC?: number;
  audioTier?: number;
  audioSSRC?: number;
}

/**
 * @group Camera Secure Video
 */
export interface RTPStreamAddress {
  version: "ipv4" | "ipv6";
  address: string;
  videoRTPPort: number;
  audioRTPPort: number;
}

/**
 * @group Camera Secure Video
 */
export interface RTPSRTPParameters {
  /** SRTP crypto suite, 0 = AES_CM_128_HMAC_SHA1_80 */
  cryptoSuite: number;
  masterKey: Buffer;
  masterSalt: Buffer;
}

/**
 * @group Camera Secure Video
 */
export interface RTPSetupEndpointsRequest {
  sessionIdentifier: string;
  controllerAddress: RTPStreamAddress;
  video: RTPSRTPParameters;
  audio: RTPSRTPParameters;
}

/**
 * @group Camera Secure Video
 */
export interface RTPSetupEndpointsResponse {
  sessionIdentifier: string;
  /** 0 = success, 1 = busy, 2 = error */
  status?: number;
  accessoryAddress: RTPStreamAddress;
  video: RTPSRTPParameters;
  audio: RTPSRTPParameters;
  videoSSRC: number;
  audioSSRC: number;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCOfferOptions {
  sframeEnabled: boolean;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCICECandidate {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
}

/**
 * @group Camera Secure Video
 */
export interface SFrameKeyData {
  key: Buffer;
  kid: bigint;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCSolicitOfferResponse {
  sessionIdentifier?: string;
  sdpOffer?: string;
  candidates?: WebRTCICECandidate[];
  status: WebRTCSolicitOfferStatus;
  sframe?: SFrameKeyData;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCProvideAnswerRequest {
  sessionIdentifier: string;
  sdpAnswer: string;
  candidates: WebRTCICECandidate[];
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCStreamingControlRequest {
  sessionIdentifier: string;
  command: WebRTCStreamingCommand;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCReofferRequest {
  sessionIdentifier: string;
  sdpOffer: string;
  options?: WebRTCOfferOptions;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCReofferResponse {
  sessionIdentifier: string;
  sdpAnswer?: string;
  status: WebRTCStreamingStatus;
  sframe?: SFrameKeyData;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCUpdateSessionRequest {
  sessionIdentifier: string;
  receiveKeysToAdd: SFrameKeyData[];
  receiveKIDsToRemove: bigint[];
}

/**
 * @group Camera Secure Video
 */
export interface BufferUploadCommandRequest {
  sessionId: bigint;
  command: BufferUploadCommandType;
  start?: bigint;
  stop?: bigint;
  stopAction?: BufferUploadStopAction;
}

/**
 * @group Camera Secure Video
 */
export interface BufferActivityCommandRequest {
  /** NTP timestamp */
  start: bigint;
  /** milliseconds */
  duration: bigint;
  activity: BufferActivity;
}

/**
 * @group Camera Secure Video
 */
export interface BufferEventCommandRequest {
  command: BufferEventCommandType;
  sequenceNumber?: bigint;
  limit?: bigint;
}

/**
 * @group Camera Secure Video
 */
export type CameraBufferEvent =
  | { sequenceNumber: bigint, type: CameraBufferEventType.CMAF_SESSION_START, cmafSessionId: bigint }
  | { sequenceNumber: bigint, type: CameraBufferEventType.CMAF_SESSION_STOP, cmafSessionId: bigint }
  | { sequenceNumber: bigint, type: CameraBufferEventType.MOTION, active: boolean }
  | { sequenceNumber: bigint, type: CameraBufferEventType.CMAF_ERROR, cmafSessionId: bigint, error: CMAFError };

/**
 * @group Camera Secure Video
 */
export interface CameraRecordingPublishingPointValue {
  url: string;
  /** DER encoded */
  serverCACertificates: Buffer[];
}

/**
 * @group Camera Secure Video
 */
export interface CameraKeyValue {
  key: Buffer;
  keyNumber: bigint;
}

/**
 * @group Camera Secure Video
 */
export interface CameraClientCertificateValue {
  /** DER encoded */
  clientCertificate: Buffer;
  /** DER encoded */
  ca?: Buffer;
}

/**
 * @group Camera Secure Video
 */
export interface CameraZonePolygon {
  /** uuid string */
  identifier: string;
  vertices: { x: number, y: number }[];
}

/**
 * @group Camera Secure Video
 */
export interface CameraZoneData {
  method: ZoneApplicationMethod;
  polygons: CameraZonePolygon[];
}

/**
 * @group Camera Secure Video
 */
export interface CameraZonesValue {
  version: number;
  zones: CameraZoneData[];
}

function readUIntLE(buffer: Buffer): bigint {
  let result = 0n;
  for (let i = buffer.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(buffer[i]);
  }
  return result;
}

interface TLVEntry {
  type: number;
  value: Buffer;
  afterDelimiter: boolean;
}

class TLVReader {
  private readonly entries: TLVEntry[] = [];

  constructor(buffer: Buffer) {
    let index = 0;
    let afterDelimiter = false;
    let last: (TLVEntry & { lastLength: number }) | undefined;

    while (index < buffer.length) {
      if (index + 2 > buffer.length) {
        throw new Error("TLV decode failure: incomplete type/length header");
      }
      const type = buffer[index];
      const length = buffer[index + 1];
      if (index + 2 + length > buffer.length) {
        throw new Error(`TLV decode failure: declared length ${length} exceeds remaining buffer`);
      }
      const value = buffer.subarray(index + 2, index + 2 + length);
      index += 2 + length;

      if (type === 0 && length === 0) {
        afterDelimiter = true;
        continue;
      }

      // a full 255 byte fragment continues into the next entry of the same type
      if (last && !afterDelimiter && last.type === type && last.lastLength === 255) {
        last.value = Buffer.concat([last.value, value]);
        last.lastLength = length;
        continue;
      }

      last = { type, value, afterDelimiter, lastLength: length };
      this.entries.push(last);
      afterDelimiter = false;
    }
  }

  public has(type: number): boolean {
    return this.entries.some(entry => entry.type === type);
  }

  public buffer(type: number): Buffer | undefined {
    return this.entries.find(entry => entry.type === type)?.value;
  }

  public buffers(type: number): Buffer[] {
    return this.entries.filter(entry => entry.type === type).map(entry => entry.value);
  }

  public string(type: number): string | undefined {
    return this.buffer(type)?.toString("utf8");
  }

  public number(type: number): number | undefined {
    const value = this.buffer(type);
    return value && value.length ? Number(readUIntLE(value)) : undefined;
  }

  public bigint(type: number): bigint | undefined {
    const value = this.buffer(type);
    return value && value.length ? readUIntLE(value) : undefined;
  }

  public boolean(type: number): boolean | undefined {
    const value = this.buffer(type);
    return value && value.length ? value[0] !== 0 : undefined;
  }

  public uuid(type: number): string | undefined {
    const value = this.buffer(type);
    return value && value.length === 16 ? uuid.unparse(value) : undefined;
  }

  public required<T>(value: T | undefined, name: string): T {
    if (value === undefined) {
      throw new Error(`TLV decode failure: missing ${name}`);
    }
    return value;
  }
}

function item(type: number, value: Buffer | undefined): Buffer {
  if (value === undefined) {
    return Buffer.alloc(0);
  }

  const parts: Buffer[] = [];
  let offset = 0;
  do {
    const chunk = value.subarray(offset, offset + 255);
    parts.push(Buffer.from([type, chunk.length]), chunk);
    offset += 255;
  } while (offset < value.length);
  return Buffer.concat(parts);
}

function list(type: number, values: Buffer[]): Buffer {
  const parts: Buffer[] = [];
  values.forEach((value, index) => {
    if (index > 0) {
      parts.push(DELIMITER);
    }
    parts.push(item(type, value));
  });
  return Buffer.concat(parts);
}

function u8(value: number): Buffer {
  return Buffer.from([value & 0xff]);
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function u64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt.asUintN(64, value));
  return buffer;
}

function bool(value: boolean): Buffer {
  return Buffer.from([value ? 1 : 0]);
}

function str(value: string | undefined): Buffer | undefined {
  return value === undefined ? undefined : Buffer.from(value, "utf8");
}

function uuidBuffer(value: string): Buffer {
  return uuid.write(value);
}

/**
 * @group Camera Secure Video
 */
export function encodeSupportedVideoStreamTiers(value: SupportedVideoStreamTiersValue): Buffer {
  return Buffer.concat([
    item(1, u8(value.codec)),
    item(2, u8(value.payloadType)),
    list(3, value.tiers.map(tier => Buffer.concat([
      item(1, u32(tier.identifier)),
      item(2, u8(tier.quality)),
      item(3, u32(tier.targetAverageBitrate)),
      item(4, u16(tier.width)),
      item(5, u16(tier.height)),
      item(6, u8(tier.frameRate)),
    ]))),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeSupportedVideoStreamTiers(buffer: Buffer): SupportedVideoStreamTiersValue {
  const reader = new TLVReader(buffer);
  return {
    codec: reader.required(reader.number(1), "codec"),
    payloadType: reader.required(reader.number(2), "payload type"),
    tiers: reader.buffers(3).map(entry => {
      const tier = new TLVReader(entry);
      return {
        identifier: tier.required(tier.number(1), "tier identifier"),
        quality: tier.required(tier.number(2), "tier quality"),
        targetAverageBitrate: tier.required(tier.number(3), "tier bitrate"),
        width: tier.required(tier.number(4), "tier width"),
        height: tier.required(tier.number(5), "tier height"),
        frameRate: tier.required(tier.number(6), "tier frame rate"),
      };
    }),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeSupportedAudioStreamTiers(value: SupportedAudioStreamTiersValue): Buffer {
  return Buffer.concat([
    item(1, u8(value.codec)),
    item(2, u8(value.payloadType)),
    list(3, value.tiers.map(tier => Buffer.concat([
      item(1, u32(tier.identifier)),
      item(2, u32(tier.targetAverageBitrate)),
      item(3, u8(tier.sampleRate)),
      item(4, u8(tier.bitDepth)),
      item(5, u8(tier.packetTime)),
      item(6, u8(tier.channels)),
    ]))),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeSupportedAudioStreamTiers(buffer: Buffer): SupportedAudioStreamTiersValue {
  const reader = new TLVReader(buffer);
  return {
    codec: reader.required(reader.number(1), "codec"),
    payloadType: reader.required(reader.number(2), "payload type"),
    tiers: reader.buffers(3).map(entry => {
      const tier = new TLVReader(entry);
      return {
        identifier: tier.required(tier.number(1), "tier identifier"),
        targetAverageBitrate: tier.required(tier.number(2), "tier bitrate"),
        sampleRate: tier.required(tier.number(3), "tier sample rate"),
        bitDepth: tier.required(tier.number(4), "tier bit depth"),
        packetTime: tier.required(tier.number(5), "tier packet time"),
        channels: tier.required(tier.number(6), "tier channels"),
      };
    }),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraCapabilities(value: CameraCapabilitiesValue): Buffer {
  const sensors = value.sensors.map(sensor => Buffer.concat([
    item(1, Buffer.concat([item(1, u16(sensor.width)), item(2, u16(sensor.height))])),
    item(2, uuidBuffer(sensor.sensorUUID)),
    item(3, u8(sensor.type)),
    item(4, u8(sensor.intent)),
    list(5, sensor.videoStreams.map(stream => Buffer.concat([
      item(1, uuidBuffer(stream.identifier)),
      item(2, u8(stream.quality)),
      item(3, u16(stream.width)),
      item(4, u16(stream.height)),
      item(5, u8(stream.frameRate)),
      item(6, u32(stream.averageBitrate)),
      item(7, u32(stream.peakBitrate)),
    ]))),
  ]));

  return Buffer.concat([
    item(1, u8(value.version)),
    item(2, list(1, sensors)),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeCameraCapabilities(buffer: Buffer): CameraCapabilitiesValue {
  const reader = new TLVReader(buffer);
  const sensors = new TLVReader(reader.buffer(2) ?? Buffer.alloc(0));
  return {
    version: reader.required(reader.number(1), "version"),
    sensors: sensors.buffers(1).map(entry => {
      const sensor = new TLVReader(entry);
      const dimensions = new TLVReader(sensor.required(sensor.buffer(1), "sensor dimensions"));
      return {
        width: dimensions.required(dimensions.number(1), "sensor width"),
        height: dimensions.required(dimensions.number(2), "sensor height"),
        sensorUUID: sensor.required(sensor.uuid(2), "sensor uuid"),
        type: sensor.number(3) ?? CameraSensorType.UNKNOWN,
        intent: sensor.number(4) ?? CameraSensorIntent.UNKNOWN,
        videoStreams: sensor.buffers(5).map(streamEntry => {
          const stream = new TLVReader(streamEntry);
          return {
            identifier: stream.required(stream.uuid(1), "stream identifier"),
            quality: stream.required(stream.number(2), "stream quality"),
            width: stream.required(stream.number(3), "stream width"),
            height: stream.required(stream.number(4), "stream height"),
            frameRate: stream.required(stream.number(5), "stream frame rate"),
            averageBitrate: stream.required(stream.number(6), "stream average bitrate"),
            peakBitrate: stream.required(stream.number(7), "stream peak bitrate"),
          };
        }),
      };
    }),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeContributingSensors(sensorUUIDs: string[]): Buffer {
  return list(1, sensorUUIDs.map(sensorUUID => item(1, uuidBuffer(sensorUUID))));
}

/**
 * @group Camera Secure Video
 */
export function encodeSensorUUID(sensorUUID: string): Buffer {
  return uuidBuffer(sensorUUID);
}

/**
 * @group Camera Secure Video
 */
export function decodeRTPStreamingControl(buffer: Buffer): RTPStreamingControlRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionIdentifier: reader.required(reader.uuid(1), "session identifier"),
    command: reader.required(reader.number(2), "command"),
    videoTier: reader.number(3),
    videoSSRC: reader.number(4),
    audioTier: reader.number(5),
    audioSSRC: reader.number(6),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeSessionStatus(sessionIdentifier: string | undefined, status: number): Buffer {
  return Buffer.concat([
    sessionIdentifier ? item(1, uuidBuffer(sessionIdentifier)) : Buffer.alloc(0),
    item(2, u8(status)),
  ]);
}

function decodeRTPAddress(buffer: Buffer): RTPStreamAddress {
  const reader = new TLVReader(buffer);
  return {
    version: reader.number(1) === 1 ? "ipv6" : "ipv4",
    address: reader.required(reader.string(2), "address"),
    videoRTPPort: reader.required(reader.number(3), "video rtp port"),
    audioRTPPort: reader.required(reader.number(4), "audio rtp port"),
  };
}

function encodeRTPAddress(address: RTPStreamAddress): Buffer {
  return Buffer.concat([
    item(1, u8(address.version === "ipv6" ? 1 : 0)),
    item(2, str(address.address)),
    item(3, u16(address.videoRTPPort)),
    item(4, u16(address.audioRTPPort)),
  ]);
}

function decodeSRTPParameters(buffer: Buffer): RTPSRTPParameters {
  const reader = new TLVReader(buffer);
  return {
    cryptoSuite: reader.number(1) ?? 0,
    masterKey: reader.buffer(2) ?? Buffer.alloc(0),
    masterSalt: reader.buffer(3) ?? Buffer.alloc(0),
  };
}

function encodeSRTPParameters(parameters: RTPSRTPParameters): Buffer {
  return Buffer.concat([
    item(1, u8(parameters.cryptoSuite)),
    item(2, parameters.masterKey),
    item(3, parameters.masterSalt),
  ]);
}

/**
 * The multi-tier RTP Setup Endpoints characteristic reuses the same TLV as the legacy HAP Setup Endpoints.
 *
 * @group Camera Secure Video
 */
export function decodeRTPSetupEndpoints(buffer: Buffer): RTPSetupEndpointsRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionIdentifier: reader.required(reader.uuid(1), "session identifier"),
    controllerAddress: decodeRTPAddress(reader.required(reader.buffer(3), "controller address")),
    video: decodeSRTPParameters(reader.required(reader.buffer(4), "video srtp parameters")),
    audio: decodeSRTPParameters(reader.required(reader.buffer(5), "audio srtp parameters")),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeRTPSetupEndpointsResponse(response: RTPSetupEndpointsResponse): Buffer {
  return Buffer.concat([
    item(1, uuidBuffer(response.sessionIdentifier)),
    item(2, u8(response.status ?? 0)),
    item(3, encodeRTPAddress(response.accessoryAddress)),
    item(4, encodeSRTPParameters(response.video)),
    item(5, encodeSRTPParameters(response.audio)),
    item(6, u32(response.videoSSRC)),
    item(7, u32(response.audioSSRC)),
  ]);
}

function decodeOfferOptions(buffer: Buffer | undefined): WebRTCOfferOptions | undefined {
  if (!buffer) {
    return undefined;
  }
  return { sframeEnabled: new TLVReader(buffer).boolean(1) ?? false };
}

function encodeCandidate(candidate: WebRTCICECandidate): Buffer {
  return Buffer.concat([
    item(1, str(candidate.candidate)),
    item(2, str(candidate.sdpMid)),
    candidate.sdpMLineIndex !== undefined ? item(3, u16(candidate.sdpMLineIndex)) : Buffer.alloc(0),
  ]);
}

function decodeCandidate(buffer: Buffer): WebRTCICECandidate {
  const reader = new TLVReader(buffer);
  return {
    candidate: reader.required(reader.string(1), "candidate"),
    sdpMid: reader.string(2),
    sdpMLineIndex: reader.number(3),
  };
}

function encodeSFrameKey(key: SFrameKeyData): Buffer {
  return Buffer.concat([item(1, key.key), item(2, u64(key.kid))]);
}

function decodeSFrameKey(buffer: Buffer): SFrameKeyData {
  const reader = new TLVReader(buffer);
  return {
    key: reader.required(reader.buffer(1), "sframe key"),
    kid: reader.required(reader.bigint(2), "sframe kid"),
  };
}

/**
 * @group Camera Secure Video
 */
export function decodeWebRTCSolicitOffer(buffer: Buffer): WebRTCOfferOptions {
  const reader = new TLVReader(buffer);
  return decodeOfferOptions(reader.buffer(1)) ?? { sframeEnabled: false };
}

/**
 * @group Camera Secure Video
 */
export function encodeWebRTCSolicitOfferResponse(value: WebRTCSolicitOfferResponse): Buffer {
  return Buffer.concat([
    value.sessionIdentifier ? item(1, uuidBuffer(value.sessionIdentifier)) : Buffer.alloc(0),
    item(2, str(value.sdpOffer)),
    list(3, (value.candidates ?? []).map(encodeCandidate)),
    item(4, u8(value.status)),
    value.sframe ? item(5, encodeSFrameKey(value.sframe)) : Buffer.alloc(0),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeWebRTCProvideAnswer(buffer: Buffer): WebRTCProvideAnswerRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionIdentifier: reader.required(reader.uuid(1), "session identifier"),
    sdpAnswer: reader.required(reader.string(2), "sdp answer"),
    candidates: reader.buffers(3).map(decodeCandidate),
  };
}

/**
 * @group Camera Secure Video
 */
export function decodeWebRTCStreamingControl(buffer: Buffer): WebRTCStreamingControlRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionIdentifier: reader.required(reader.uuid(1), "session identifier"),
    command: reader.required(reader.number(2), "command"),
  };
}

/**
 * @group Camera Secure Video
 */
export function decodeWebRTCReoffer(buffer: Buffer): WebRTCReofferRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionIdentifier: reader.required(reader.uuid(1), "session identifier"),
    sdpOffer: reader.required(reader.string(2), "sdp offer"),
    options: decodeOfferOptions(reader.buffer(3)),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeWebRTCReofferResponse(value: WebRTCReofferResponse): Buffer {
  return Buffer.concat([
    item(1, uuidBuffer(value.sessionIdentifier)),
    item(2, str(value.sdpAnswer)),
    item(3, u8(value.status)),
    value.sframe ? item(4, encodeSFrameKey(value.sframe)) : Buffer.alloc(0),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeWebRTCUpdateSession(buffer: Buffer): WebRTCUpdateSessionRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionIdentifier: reader.required(reader.uuid(1), "session identifier"),
    receiveKeysToAdd: reader.buffers(2).map(decodeSFrameKey),
    receiveKIDsToRemove: reader.buffers(3).map(entry => {
      const kid = new TLVReader(entry);
      return kid.required(kid.bigint(1), "sframe kid");
    }),
  };
}

/**
 * @group Camera Secure Video
 */
export function decodeBufferUploadCommand(buffer: Buffer): BufferUploadCommandRequest {
  const reader = new TLVReader(buffer);
  return {
    sessionId: reader.required(reader.bigint(1), "session id"),
    command: reader.required(reader.number(2), "command"),
    start: reader.bigint(3),
    stop: reader.bigint(4),
    stopAction: reader.number(5),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeBufferUploadCommandResponse(clipId: bigint): Buffer {
  return item(1, u64(clipId));
}

/**
 * @group Camera Secure Video
 */
export function decodeBufferActivityCommand(buffer: Buffer): BufferActivityCommandRequest {
  const reader = new TLVReader(buffer);
  return {
    start: reader.required(reader.bigint(1), "start"),
    duration: reader.required(reader.bigint(2), "duration"),
    activity: reader.required(reader.number(3), "activity"),
  };
}

/**
 * @group Camera Secure Video
 */
export function decodeBufferEventCommand(buffer: Buffer): BufferEventCommandRequest {
  const reader = new TLVReader(buffer);
  return {
    command: reader.required(reader.number(1), "command"),
    sequenceNumber: reader.bigint(2),
    limit: reader.bigint(3),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeBufferEventCommandResponse(events: CameraBufferEvent[]): Buffer {
  return list(1, events.map(event => {
    let payload: Buffer;
    switch (event.type) {
    case CameraBufferEventType.CMAF_SESSION_START:
      payload = item(3, item(1, u64(event.cmafSessionId)));
      break;
    case CameraBufferEventType.CMAF_SESSION_STOP:
      payload = item(4, item(1, u64(event.cmafSessionId)));
      break;
    case CameraBufferEventType.MOTION:
      payload = item(5, item(1, bool(event.active)));
      break;
    case CameraBufferEventType.CMAF_ERROR:
      payload = item(6, Buffer.concat([item(1, u64(event.cmafSessionId)), item(2, u8(event.error))]));
      break;
    }
    return Buffer.concat([item(1, u64(event.sequenceNumber)), item(2, u8(event.type)), payload]);
  }));
}

/**
 * @group Camera Secure Video
 */
export function decodeBufferEventCommandResponse(buffer: Buffer): CameraBufferEvent[] {
  const reader = new TLVReader(buffer);
  return reader.buffers(1).map(entry => {
    const event = new TLVReader(entry);
    const sequenceNumber = event.required(event.bigint(1), "sequence number");
    const type: CameraBufferEventType = event.required(event.number(2), "event type");
    switch (type) {
    case CameraBufferEventType.CMAF_SESSION_START:
    case CameraBufferEventType.CMAF_SESSION_STOP: {
      const session = new TLVReader(event.required(event.buffer(type === CameraBufferEventType.CMAF_SESSION_START ? 3 : 4), "cmaf session"));
      return { sequenceNumber, type, cmafSessionId: session.required(session.bigint(1), "cmaf session id") };
    }
    case CameraBufferEventType.MOTION: {
      const motion = new TLVReader(event.required(event.buffer(5), "motion"));
      return { sequenceNumber, type, active: motion.boolean(1) ?? false };
    }
    case CameraBufferEventType.CMAF_ERROR: {
      const error = new TLVReader(event.required(event.buffer(6), "cmaf error"));
      return {
        sequenceNumber,
        type,
        cmafSessionId: error.required(error.bigint(1), "cmaf session id"),
        error: error.number(2) ?? CMAFError.UNKNOWN,
      };
    }
    default:
      throw new Error(`TLV decode failure: unknown buffer event type ${type}`);
    }
  });
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraRecordingPublishingPoint(value: CameraRecordingPublishingPointValue): Buffer {
  return Buffer.concat([
    item(1, str(value.url)),
    list(2, value.serverCACertificates.map(certificate => item(1, certificate))),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeCameraRecordingPublishingPoint(buffer: Buffer): CameraRecordingPublishingPointValue {
  const reader = new TLVReader(buffer);
  return {
    url: reader.required(reader.string(1), "url"),
    serverCACertificates: reader.buffers(2)
      .map(entry => new TLVReader(entry).buffer(1))
      .filter((certificate): certificate is Buffer => !!certificate),
  };
}

/**
 * @group Camera Secure Video
 */
export function decodeCameraKey(buffer: Buffer): CameraKeyValue {
  const reader = new TLVReader(buffer);
  return {
    key: reader.required(reader.buffer(1), "key"),
    keyNumber: reader.required(reader.bigint(2), "key number"),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraKeyID(keyId: bigint): Buffer {
  return item(1, u64(keyId));
}

/**
 * @group Camera Secure Video
 */
export function decodeCameraClientCSRRequest(buffer: Buffer): Buffer {
  const reader = new TLVReader(buffer);
  return reader.required(reader.buffer(1), "nonce");
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraClientCSRResponse(csr: Buffer, nonceSignature: Buffer): Buffer {
  return Buffer.concat([item(1, csr), item(2, nonceSignature)]);
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraClientCertificate(value: CameraClientCertificateValue): Buffer {
  return Buffer.concat([item(1, value.clientCertificate), item(2, value.ca)]);
}

/**
 * @group Camera Secure Video
 */
export function decodeCameraClientCertificate(buffer: Buffer): CameraClientCertificateValue {
  const reader = new TLVReader(buffer);
  return {
    clientCertificate: reader.required(reader.buffer(1), "client certificate"),
    ca: reader.buffer(2),
  };
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraClientCertificateStatus(needsUpdate: boolean): Buffer {
  return item(1, bool(needsUpdate));
}

/**
 * @group Camera Secure Video
 */
export function encodeCameraZones(value: CameraZonesValue): Buffer {
  const zones = value.zones.map(zone => Buffer.concat([
    item(1, u8(zone.method)),
    list(3, zone.polygons.map(polygon => {
      const vertices = Buffer.alloc(polygon.vertices.length * 4);
      polygon.vertices.forEach((vertex, index) => {
        vertices.writeUInt16LE(vertex.x, index * 4);
        vertices.writeUInt16LE(vertex.y, index * 4 + 2);
      });
      return Buffer.concat([item(1, uuidBuffer(polygon.identifier)), item(3, vertices)]);
    })),
  ]));

  return Buffer.concat([
    item(1, u8(value.version)),
    list(2, zones),
  ]);
}

/**
 * @group Camera Secure Video
 */
export function decodeCameraZones(buffer: Buffer): CameraZonesValue {
  const reader = new TLVReader(buffer);
  return {
    version: reader.required(reader.number(1), "zone data version"),
    zones: reader.buffers(2).map(entry => {
      const zone = new TLVReader(entry);
      return {
        method: zone.number(1) ?? ZoneApplicationMethod.NORMAL,
        polygons: zone.buffers(3).map(polygonEntry => {
          const polygon = new TLVReader(polygonEntry);
          const vertexData = polygon.buffer(3) ?? Buffer.alloc(0);
          const vertices: { x: number, y: number }[] = [];
          for (let offset = 0; offset + 4 <= vertexData.length; offset += 4) {
            vertices.push({ x: vertexData.readUInt16LE(offset), y: vertexData.readUInt16LE(offset + 2) });
          }
          return { identifier: polygon.uuid(1) ?? "", vertices };
        }),
      };
    }),
  };
}
