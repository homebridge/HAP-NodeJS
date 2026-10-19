import crypto from "crypto";
import {
  AudioRecordingCodecType,
  AudioRecordingSamplerate,
  BufferEventCommandType,
  CameraBufferEventType,
  CameraRecordingOptions,
  CameraVideoQuality,
  decodeBufferEventCommandResponse,
  H264Level,
  H264Profile,
  MediaContainerType,
  StreamTierAudioBitDepth,
  StreamTierAudioSampleRate,
  StreamTierVideoCodec,
  VideoCodecType,
  WebRTCSolicitOfferStatus,
  WebRTCStreamingStatus,
} from "../camera";
import { Accessory } from "../Accessory";
import { Characteristic } from "../Characteristic";
import "../definitions";
import { HAPStatus } from "../HAPServer";
import { Service } from "../Service";
import * as uuid from "../util/uuid";
import { CameraRecordingDelegate, ResourceRequestReason } from "./CameraController";
import { MultiTierRTPStreamingDelegate, SecureVideoController, SecureVideoControllerOptions, WebRTCStreamingDelegate } from "./SecureVideoController";

const recordingOptions: CameraRecordingOptions = {
  prebufferLength: 4000,
  mediaContainerConfiguration: { type: MediaContainerType.FRAGMENTED_MP4, fragmentLength: 4000 },
  video: {
    type: VideoCodecType.H264,
    parameters: { profiles: [H264Profile.MAIN], levels: [H264Level.LEVEL4_0] },
    resolutions: [[1920, 1080, 30]],
  },
  audio: { codecs: [{ type: AudioRecordingCodecType.AAC_LC, samplerate: AudioRecordingSamplerate.KHZ_32 }] },
};

const recordingDelegate: CameraRecordingDelegate = {
  updateRecordingActive: () => undefined,
  updateRecordingConfiguration: () => undefined,
  // eslint-disable-next-line require-yield
  handleRecordingStreamRequest: async function* () {
    return;
  },
  closeRecordingStream: () => undefined,
};

function tlv(type: number, value: Buffer | number[]): Buffer {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([Buffer.from([type, data.length]), data]);
}

function parse(value: unknown): Record<number, Buffer> {
  const buffer = Buffer.from(String(value), "base64");
  const result: Record<number, Buffer> = {};
  for (let index = 0; index < buffer.length; index += 2 + buffer[index + 1]) {
    result[buffer[index]] = buffer.subarray(index + 2, index + 2 + buffer[index + 1]);
  }
  return result;
}

describe("SecureVideoController", () => {
  let accessory: Accessory;
  let controller: SecureVideoController;
  let webrtc: jest.Mocked<WebRTCStreamingDelegate>;
  let rtp: jest.Mocked<MultiTierRTPStreamingDelegate>;
  let snapshot: jest.Mock;

  beforeEach(() => {
    webrtc = {
      handleSolicitOffer: jest.fn().mockResolvedValue({ sdpOffer: "v=0", candidates: [{ candidate: "candidate:1 1 udp 1 10.0.0.2 5000 typ host" }] }),
      handleProvideAnswer: jest.fn().mockResolvedValue(undefined),
      handleReoffer: jest.fn().mockResolvedValue({ sdpAnswer: "v=0" }),
      handleUpdateSession: jest.fn().mockResolvedValue(undefined),
      handleEndSession: jest.fn().mockResolvedValue(undefined),
    };
    rtp = {
      prepareStream: jest.fn().mockResolvedValue({ videoSSRC: 1, audioSSRC: 2 }),
      startStream: jest.fn().mockResolvedValue(undefined),
      stopStream: jest.fn().mockResolvedValue(undefined),
    };

    snapshot = jest.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const options: SecureVideoControllerOptions = {
      sensor: { uuid: uuid.generate("sensor"), width: 1920, height: 1080 },
      video: {
        codec: StreamTierVideoCodec.H265,
        tiers: [
          { identifier: 1, quality: CameraVideoQuality.HIGH, targetAverageBitrate: 1700, peakBitrate: 1800, width: 1920, height: 1080, frameRate: 30 },
          { identifier: 2, quality: CameraVideoQuality.MEDIUM, targetAverageBitrate: 768, peakBitrate: 800, width: 1280, height: 720, frameRate: 30 },
          { identifier: 3, quality: CameraVideoQuality.LOW, targetAverageBitrate: 180, peakBitrate: 190, width: 640, height: 360, frameRate: 15 },
        ],
      },
      audio: {
        tier: {
          identifier: 1,
          targetAverageBitrate: 24000,
          sampleRate: StreamTierAudioSampleRate.KHZ_16,
          bitDepth: StreamTierAudioBitDepth.BITS_16,
          packetTime: 20,
          channels: 1,
        },
        twoWayAudio: true,
      },
      webrtc: { delegate: webrtc, maxSessions: 1 },
      rtp: { delegate: rtp },
      recording: { options: recordingOptions, delegate: recordingDelegate },
      snapshot,
      ingest: {
        delegate: {
          // eslint-disable-next-line require-yield
          streamClip: async function* () {
            return;
          },
        },
      },
    };

    accessory = new Accessory("Camera", uuid.generate("camera"));
    controller = new SecureVideoController(options);
    accessory.configureController(controller);
  });

  test("adds all services from the guide", () => {
    for (const service of [
      Service.CameraCapabilities, Service.CameraGlobalOperatingMode, Service.CameraMotionZones, Service.CameraBufferManagement,
      Service.CameraMultiTierRTPStreamManagement, Service.CameraWebRTCStreamManagement, Service.CameraRecordingManagement,
      Service.CameraOperatingMode, Service.DataStreamTransportManagement, Service.CameraKeyManagement,
      Service.CameraClientCertificateManagement, Service.MotionSensor, Service.Microphone, Service.Speaker,
    ]) {
      expect(accessory.getService(service)).toBeDefined();
    }
    expect(controller.capabilitiesService!.getCharacteristic(Characteristic.Version).value).toBe("17.99");
  });

  test("webrtc session lifecycle", async () => {
    const service = controller.webrtcStreamManagementService!;

    const offer = parse(await service.getCharacteristic(Characteristic.WebRTCSolicitOffer).handleSetRequest(
      tlv(1, tlv(1, [0])).toString("base64")));
    expect(offer[4][0]).toBe(WebRTCSolicitOfferStatus.SUCCESS);
    expect(offer[2].toString()).toBe("v=0");
    expect(service.getCharacteristic(Characteristic.WebRTCNumberOfActiveSessions).value).toBe(1);

    const sessionId = offer[1];
    const busy = parse(await service.getCharacteristic(Characteristic.WebRTCSolicitOffer).handleSetRequest(tlv(1, tlv(1, [0])).toString("base64")));
    expect(busy[4][0]).toBe(WebRTCSolicitOfferStatus.ERROR);

    const answer = parse(await service.getCharacteristic(Characteristic.WebRTCProvideAnswer).handleSetRequest(
      Buffer.concat([tlv(1, sessionId), tlv(2, Buffer.from("v=0 answer"))]).toString("base64")));
    expect(answer[2][0]).toBe(WebRTCStreamingStatus.SUCCESS);
    expect(webrtc.handleProvideAnswer).toHaveBeenCalledWith(expect.objectContaining({ sdpAnswer: "v=0 answer" }));

    const unknown = parse(await service.getCharacteristic(Characteristic.WebRTCStreamingControl).handleSetRequest(
      Buffer.concat([tlv(1, crypto.randomBytes(16)), tlv(2, [1])]).toString("base64")));
    expect(unknown[2][0]).toBe(WebRTCStreamingStatus.UNKNOWN_SESSION_IDENTIFIER);

    const end = parse(await service.getCharacteristic(Characteristic.WebRTCStreamingControl).handleSetRequest(
      Buffer.concat([tlv(1, sessionId), tlv(2, [1])]).toString("base64")));
    expect(end[2][0]).toBe(WebRTCStreamingStatus.SUCCESS);
    expect(webrtc.handleEndSession).toHaveBeenCalledWith(uuid.unparse(sessionId));
    expect(service.getCharacteristic(Characteristic.WebRTCNumberOfActiveSessions).value).toBe(0);
  });

  test("solicit offer reports privacy mode when the camera is off", async () => {
    controller.globalOperatingModeService!.setCharacteristic(Characteristic.HomeKitCameraActive, 0);

    const offer = parse(await controller.webrtcStreamManagementService!.getCharacteristic(Characteristic.WebRTCSolicitOffer)
      .handleSetRequest(tlv(1, tlv(1, [0])).toString("base64")));
    expect(offer[4][0]).toBe(WebRTCSolicitOfferStatus.PRIVACY_MODE_ACTIVE);
    expect(webrtc.handleSolicitOffer).not.toHaveBeenCalled();
  });

  test("event queue notifies, queries and acknowledges", async () => {
    const buffer = controller.bufferManagementService!;
    controller.setMotionDetected(true);
    controller.setMotionDetected(false);
    expect(buffer.getCharacteristic(Characteristic.BufferEventSequenceNumber).value).toBe(2);

    const command = buffer.getCharacteristic(Characteristic.BufferEventCommand);
    const query = await command.handleSetRequest(Buffer.concat([tlv(1, [BufferEventCommandType.QUERY]), tlv(2, [1])]).toString("base64"));
    expect(decodeBufferEventCommandResponse(Buffer.from(String(query), "base64")).map(event => event.type))
      .toEqual([CameraBufferEventType.MOTION, CameraBufferEventType.MOTION]);

    await command.handleSetRequest(Buffer.concat([tlv(1, [BufferEventCommandType.ACKNOWLEDGE]), tlv(2, [1])]).toString("base64"));
    const remaining = await command.handleSetRequest(Buffer.concat([tlv(1, [BufferEventCommandType.QUERY]), tlv(2, [0])]).toString("base64"));
    expect(decodeBufferEventCommandResponse(Buffer.from(String(remaining), "base64")).map(event => event.sequenceNumber)).toEqual([2n]);
  });

  test("csr, certificate, key and publishing point survive serialization", async () => {
    const certificates = controller.clientCertificateManagementService!;
    const csr = parse(await certificates.getCharacteristic(Characteristic.CameraClientCSR).handleSetRequest(
      tlv(1, crypto.randomBytes(32)).toString("base64")));
    expect(csr[1][0]).toBe(0x30);

    await certificates.getCharacteristic(Characteristic.CameraClientCertificate).handleSetRequest(
      Buffer.concat([tlv(1, Buffer.from([1, 2, 3])), tlv(2, Buffer.from([4, 5]))]).toString("base64"));
    await controller.keyManagementService!.getCharacteristic(Characteristic.CameraKey).handleSetRequest(
      Buffer.concat([tlv(1, Buffer.alloc(16, 7)), tlv(2, [3])]).toString("base64"));
    await controller.bufferManagementService!.getCharacteristic(Characteristic.CameraRecordingPublishingPoint).handleSetRequest(
      Buffer.concat([tlv(1, Buffer.from("https://ingest.example.com/x/")), tlv(2, tlv(1, Buffer.from([9])))]).toString("base64"));

    const state = JSON.parse(JSON.stringify(controller.serialize()));
    controller.handleFactoryReset();
    expect(controller.serialize()!.privateKey).toBeUndefined();

    controller.deserialize(state);
    const restored = controller.serialize()!;
    expect(restored.privateKey).toContain("PRIVATE KEY");
    expect(restored.clientCertificate).toBe(Buffer.from([1, 2, 3]).toString("base64"));
    expect(restored.ca).toBe(Buffer.from([4, 5]).toString("base64"));
    expect(restored.keys).toEqual([{ keyNumber: "3", key: Buffer.alloc(16, 7).toString("base64") }]);
    expect(restored.publishingPoint).toBe(state.publishingPoint);
  });

  test("empty writes clear certificate, publishing point and keys", async () => {
    const certificate = controller.clientCertificateManagementService!.getCharacteristic(Characteristic.CameraClientCertificate);
    const publishingPoint = controller.bufferManagementService!.getCharacteristic(Characteristic.CameraRecordingPublishingPoint);

    await certificate.handleSetRequest(Buffer.concat([tlv(1, Buffer.from([1, 2, 3]))]).toString("base64"));
    await publishingPoint.handleSetRequest(tlv(1, Buffer.from("https://ingest.example.com/x/")).toString("base64"));
    await controller.keyManagementService!.getCharacteristic(Characteristic.CameraKey).handleSetRequest(
      Buffer.concat([tlv(1, Buffer.alloc(16, 7)), tlv(2, [3])]).toString("base64"));

    await expect(certificate.handleSetRequest("")).resolves.toBeUndefined();
    await expect(publishingPoint.handleSetRequest("")).resolves.toBeUndefined();
    await expect(controller.keyManagementService!.getCharacteristic(Characteristic.CameraKey).handleSetRequest("")).resolves.toBeUndefined();

    const cleared = controller.serialize()!;
    expect(cleared.clientCertificate).toBeUndefined();
    expect(cleared.publishingPoint).toBeUndefined();
    expect(cleared.keys).toEqual([]);
    expect(controller.clientCertificateManagementService!.getCharacteristic(Characteristic.CameraClientCertificateStatus).value).toBe("AQEB");
  });

  test("owns the recording management and links it to the stream services", () => {
    const recording = controller.recordingManagementService!;
    const dataStream = controller.recordingManagement!.dataStreamManagement.getService();
    expect(accessory.getService(Service.CameraRecordingManagement)).toBe(recording);
    expect(recording.testCharacteristic(Characteristic.RecordingAudioActive)).toBe(true);
    expect(recording.linkedServices).toContain(controller.motionService);
    expect(controller.multiTierStreamManagementService!.linkedServices).toContain(dataStream);
    expect(controller.webrtcStreamManagementService!.linkedServices).toContain(dataStream);
    expect(recording.getCharacteristic(Characteristic.SupportedCameraRecordingConfiguration).value).toBeDefined();
  });

  test("serves the image resource request through the snapshot handler", async () => {
    await expect(controller.handleSnapshotRequest(720, 1280, "Camera", ResourceRequestReason.PERIODIC))
      .resolves.toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    expect(snapshot).toHaveBeenCalledWith({ height: 720, width: 1280, reason: ResourceRequestReason.PERIODIC });

    controller.globalOperatingModeService!.setCharacteristic(Characteristic.HomeKitCameraActive, 0);
    await expect(controller.handleSnapshotRequest(720, 1280, "Camera")).rejects.toBe(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    controller.globalOperatingModeService!.setCharacteristic(Characteristic.HomeKitCameraActive, 1);

    controller.recordingManagement!.operatingModeService.setCharacteristic(Characteristic.PeriodicSnapshotsActive, false);
    await expect(controller.handleSnapshotRequest(720, 1280, "Camera", ResourceRequestReason.PERIODIC))
      .rejects.toBe(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    await expect(controller.handleSnapshotRequest(720, 1280, "Camera", ResourceRequestReason.EVENT)).resolves.toBeDefined();

    snapshot.mockRejectedValueOnce(new Error("camera offline"));
    await expect(controller.handleSnapshotRequest(720, 1280, "Camera", ResourceRequestReason.EVENT))
      .rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  });

  test("hds only without an ingest delegate", () => {
    const hds = new Accessory("HDS", uuid.generate("hds"));
    const secureVideo = new SecureVideoController({
      sensor: { uuid: uuid.generate("hds-sensor"), width: 1920, height: 1080 },
      video: { codec: StreamTierVideoCodec.H265, tiers: [] },
      webrtc: { delegate: webrtc },
      rtp: { delegate: rtp },
      recording: { options: recordingOptions, delegate: recordingDelegate },
    });
    hds.configureController(secureVideo);

    expect(hds.getService(Service.CameraRecordingManagement)).toBeDefined();
    expect(hds.getService(Service.CameraBufferManagement)).toBeUndefined();
    expect(hds.getService(Service.CameraKeyManagement)).toBeUndefined();
    expect(hds.getService(Service.CameraClientCertificateManagement)).toBeUndefined();
  });

  test("buffer upload returns a generated clip id", async () => {
    const response = await controller.bufferManagementService!.getCharacteristic(Characteristic.BufferUploadCommand).handleSetRequest(
      Buffer.concat([tlv(1, [1]), tlv(2, [1])]).toString("base64"));
    const decoded = Buffer.from(String(response), "base64");
    expect(decoded[0]).toBe(1);   // TLV type: clip id
    expect(decoded[1]).toBe(8);   // encoded as a uint64
    expect(decoded.subarray(2, 10)).not.toEqual(Buffer.alloc(8));
  });
});
