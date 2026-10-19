import crypto from "crypto";
import createDebug from "debug";
import { EventEmitter } from "events";
import {
  BufferActivityCommandRequest,
  BufferEventCommandType,
  BufferUploadCommandRequest,
  CAMERA_CAPABILITIES_VERSION,
  CameraBufferEvent,
  CameraBufferEventType,
  CameraRecordingPublishingPointValue,
  CameraSensorIntent,
  CameraSensorType,
  CameraZonesValue,
  CMAFError,
  decodeBufferActivityCommand,
  decodeBufferEventCommand,
  decodeBufferUploadCommand,
  decodeCameraClientCertificate,
  decodeCameraClientCSRRequest,
  decodeCameraKey,
  decodeCameraRecordingPublishingPoint,
  decodeCameraZones,
  decodeRTPSetupEndpoints,
  decodeRTPStreamingControl,
  decodeWebRTCProvideAnswer,
  decodeWebRTCReoffer,
  decodeWebRTCSolicitOffer,
  decodeWebRTCStreamingControl,
  decodeWebRTCUpdateSession,
  encodeBufferEventCommandResponse,
  encodeBufferUploadCommandResponse,
  encodeCameraCapabilities,
  encodeCameraClientCertificate,
  encodeCameraClientCertificateStatus,
  encodeCameraClientCSRResponse,
  encodeCameraKeyID,
  encodeCameraRecordingPublishingPoint,
  encodeCameraZones,
  encodeContributingSensors,
  encodeRTPSetupEndpointsResponse,
  encodeSensorUUID,
  encodeSessionStatus,
  encodeSupportedAudioStreamTiers,
  encodeSupportedVideoStreamTiers,
  encodeWebRTCReofferResponse,
  encodeWebRTCSolicitOfferResponse,
  RTPSetupEndpointsResponse,
  RTPSRTPParameters,
  RTPStreamingCommand,
  RTPStreamingStatus,
  SFrameKeyData,
  StreamTierAudioCodec,
  StreamTierVideoCodec,
  AudioStreamTier,
  VideoStreamTier,
  WebRTCICECandidate,
  WebRTCOfferOptions,
  WebRTCProvideAnswerRequest,
  WebRTCReofferRequest,
  WebRTCSolicitOfferStatus,
  WebRTCStreamingStatus,
  WebRTCUpdateSessionRequest,
} from "../camera/SecureVideoTypes";
import { CMAFIngest } from "../camera/CMAFIngest";
import { createClientCSR, generateClientKey } from "../camera/SecureVideoCredentials";
import { HDSSnapshotTransport } from "../camera/HDSSnapshotTransport";
import { EventTriggerOption, RecordingManagement } from "../camera/RecordingManagement";
import { Characteristic, CharacteristicEventTypes, Perms } from "../Characteristic";
import { DataStreamManagement } from "../datastream";
import {
  CameraBufferManagement,
  CameraCapabilities,
  CameraClientCertificateManagement,
  CameraGlobalOperatingMode,
  CameraKeyManagement,
  CameraMotionZones,
  CameraMultiTierRTPStreamManagement,
  CameraOperatingMode,
  CameraRecordingManagement,
  CameraWebRTCStreamManagement,
  DataStreamTransportManagement,
  Microphone,
  MotionSensor,
  Speaker,
} from "../definitions";
import { HAPStatus } from "../HAPServer";
import { Service } from "../Service";
import { HapStatusError } from "../util/hapStatusError";
import * as uuid from "../util/uuid";
import { ResourceRequestReason } from "./CameraController";
import { ControllerIdentifier, ControllerServiceMap, SerializableController, SnapshotController, StateChangeDelegate } from "./Controller";

import type { CharacteristicValue } from "../../types";
import type { CharacteristicChange } from "../Characteristic";
import type { CMAFMediaDescription } from "../camera/CMAFIngest";
import type { SecureVideoSnapshotHandler } from "../camera/HDSSnapshotTransport";
import type { CameraRecordingOptions, RecordingManagementState } from "../camera/RecordingManagement";
import type { HAPConnection } from "../util/eventedhttp";
import type { CameraRecordingDelegate } from "./CameraController";

const debug = createDebug("HAP-NodeJS:SecureVideo:Controller");

const MAX_QUEUED_EVENTS = 256;
const DEFAULT_MAX_WEBRTC_SESSIONS = 6;
// same budget as the image resource request of the CameraController (8s slow warning + 17s abort)
const SNAPSHOT_TIMEOUT_MS = 25000;

function setupEndpointsError(sessionIdentifier: string): RTPSetupEndpointsResponse {
  const emptySRTP: RTPSRTPParameters = { cryptoSuite: 0, masterKey: Buffer.alloc(0), masterSalt: Buffer.alloc(0) };
  return {
    sessionIdentifier,
    status: 2,
    accessoryAddress: { version: "ipv4", address: "0.0.0.0", videoRTPPort: 0, audioRTPPort: 0 },
    video: emptySRTP,
    audio: emptySRTP,
    videoSSRC: 0,
    audioSSRC: 0,
  };
}

/**
 * @group Camera Secure Video
 */
export interface SecureVideoVideoTier extends VideoStreamTier {
  /** kbps */
  peakBitrate: number;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCSolicitOfferRequest {
  sessionIdentifier: string;
  options: WebRTCOfferOptions;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCOffer {
  sdpOffer: string;
  candidates?: WebRTCICECandidate[];
  sframe?: SFrameKeyData;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCReofferAnswer {
  sdpAnswer: string;
  sframe?: SFrameKeyData;
}

/**
 * @group Camera Secure Video
 */
export interface WebRTCStreamingDelegate {
  handleSolicitOffer(request: WebRTCSolicitOfferRequest): Promise<WebRTCOffer>;
  handleProvideAnswer(request: WebRTCProvideAnswerRequest): Promise<void>;
  handleReoffer(request: WebRTCReofferRequest): Promise<WebRTCReofferAnswer>;
  handleUpdateSession(request: WebRTCUpdateSessionRequest): Promise<void>;
  handleEndSession(sessionIdentifier: string): Promise<void>;
}

/**
 * @group Camera Secure Video
 */
export interface MultiTierPrepareStreamRequest {
  sessionIdentifier: string;
  addressVersion: "ipv4" | "ipv6";
  /** the controller address media is sent to */
  targetAddress: string;
  /** the accessory address on this connection */
  sourceAddress: string;
  controllerVideoPort: number;
  controllerAudioPort: number;
  video: RTPSRTPParameters;
  audio: RTPSRTPParameters;
}

/**
 * @group Camera Secure Video
 */
export interface MultiTierPrepareStreamResponse {
  /** overrides the accessory address in the response, defaults to the connection source address */
  addressOverride?: string;
  videoPort: number;
  audioPort: number;
  videoSSRC: number;
  audioSSRC: number;
  video: RTPSRTPParameters;
  audio: RTPSRTPParameters;
}

/**
 * @group Camera Secure Video
 */
export interface MultiTierStreamStartRequest {
  sessionIdentifier: string;
  /** identifier of the selected video tier from the advertised supported video stream tiers */
  videoTier: number;
  /** ssrc the accessory must use for the outgoing video stream */
  videoSSRC: number;
  audioTier?: number;
  audioSSRC?: number;
}

/**
 * @group Camera Secure Video
 */
export interface MultiTierRTPStreamingDelegate {
  prepareStream(request: MultiTierPrepareStreamRequest): Promise<MultiTierPrepareStreamResponse>;
  startStream(request: MultiTierStreamStartRequest): Promise<void>;
  stopStream(sessionIdentifier: string): Promise<void>;
}

/**
 * @group Camera Secure Video
 */
export interface CMAFRecordingDelegate {
  /**
   * Streams the clip as fMP4: the init segment first, then media fragments, until `request.signal` aborts or the
   * source ends. The controller seals every segment, builds the HLS playlists and uploads them to the publishing point.
   */
  streamClip(request: CMAFClipRequest): AsyncGenerator<CMAFSegment>;
  /** the HomeKit HomeHub signals recording activity windows */
  handleBufferActivity?(request: BufferActivityCommandRequest): void;
  updateRecordingActive?(active: boolean, audioActive: boolean): void;
  /** called with undefined when the controller clears the publishing point */
  updatePublishingPoint?(publishingPoint: CameraRecordingPublishingPointValue | undefined): void;
  updateClientCertificate?(installed: boolean): void;
  /**
   * the upload session ended, `error` is set when it failed (the HomeKit HomeHub gets the same as a CMAF error event);
   * `detail` names the failed request or transport error, or summarizes the playlist requests of a finished upload
   */
  handleUploadResult?(cmafSessionId: bigint, error?: CMAFError, detail?: string): void;
}

/**
 * @group Camera Secure Video
 */
export interface CMAFClipRequest {
  cmafSessionId: bigint;
  command: BufferUploadCommandRequest;
  /** aborted when the HomeKit HomeHub stops the upload */
  signal: AbortSignal;
}

/**
 * @group Camera Secure Video
 */
export interface CMAFSegment {
  type: "init" | "media";
  /** raw fMP4; the controller seals it before upload */
  data: Buffer;
  /** on the init segment: the actual media description for the HLS playlists, overriding the controller default */
  media?: CMAFMediaDescription;
  /** on the init segment: wall clock of the first media fragment, defaults to the start of the upload command */
  startedAt?: Date;
  /** media fragment duration in seconds, defaults to 2 */
  duration?: number;
  /** set on the last media fragment */
  last?: boolean;
}

/**
 * @group Camera Secure Video
 */
export interface SecureVideoControllerOptions {
  sensor: {
    /** stable uuid string, must not change across restarts */
    uuid: string;
    width: number;
    height: number;
    type?: CameraSensorType;
    intent?: CameraSensorIntent;
  };
  video: {
    codec: StreamTierVideoCodec;
    payloadType?: number;
    tiers: SecureVideoVideoTier[];
  };
  audio?: {
    payloadType?: number;
    tier: AudioStreamTier;
    /** adds the Speaker service so the Home app offers talkback, like `twoWayAudio` of the {@link CameraStreamingOptions} */
    twoWayAudio?: boolean;
  };
  webrtc: {
    delegate: WebRTCStreamingDelegate;
    maxSessions?: number;
  };
  rtp: {
    delegate: MultiTierRTPStreamingDelegate;
  };
  /**
   * Event recording over HDS, owned by the controller like a {@link CameraController} owns its {@link RecordingManagement}.
   * A HomeKit HomeHub analyses and records the HDS stream and locates the stream management services through its
   * data stream, so it is part of every secure video accessory. {@link EventTriggerOption.MOTION} is always advertised,
   * {@link CameraRecordingOptions.overrideEventTriggerOptions} adds further triggers.
   */
  recording: {
    options: CameraRecordingOptions;
    delegate: CameraRecordingDelegate;
  };
  /**
   * Accessory direct upload of clips to the CMAF publishing point. Adds the buffer, key and client certificate
   * management services; without it the HomeKit HomeHub records over HDS bulk send only.
   */
  ingest?: {
    delegate: CMAFRecordingDelegate;
    /** common name placed into the client certificate signing request */
    certificateCommonName?: string;
  };
  /** reuse an existing motion sensor instead of creating one */
  motionService?: Service;
  /**
   * Produces the JPEG snapshots of the camera. They are requested through the HAP image resource request (the
   * camera tile in the Home app) and, on iOS 27, over the HDS `ipcamera.snapshot` relay. Without it both are rejected.
   */
  snapshot?: SecureVideoSnapshotHandler;
}

/**
 * @group Camera Secure Video
 */
export interface SecureVideoIngestCredentials {
  publishingPoint?: CameraRecordingPublishingPointValue;
  /** PKCS#8 PEM */
  privateKey?: string;
  /** DER */
  clientCertificate?: Buffer;
  /** DER */
  ca?: Buffer;
  keys: { keyNumber: bigint, key: Buffer }[];
  currentKeyNumber?: bigint;
}

/**
 * @group Camera Secure Video
 */
export interface SecureVideoControllerServiceMap extends ControllerServiceMap {
  capabilities?: CameraCapabilities;
  globalOperatingMode?: CameraGlobalOperatingMode;
  motionZones?: CameraMotionZones;
  multiTierStreamManagement?: CameraMultiTierRTPStreamManagement;
  webrtcStreamManagement?: CameraWebRTCStreamManagement;
  recordingManagement?: CameraRecordingManagement;
  cameraOperatingMode?: CameraOperatingMode;
  dataStreamTransportManagement?: DataStreamTransportManagement;
  bufferManagement?: CameraBufferManagement;
  keyManagement?: CameraKeyManagement;
  clientCertificateManagement?: CameraClientCertificateManagement;
  motionSensor?: MotionSensor;
  microphone?: Microphone;
  speaker?: Speaker;
}

/**
 * @group Camera Secure Video
 */
export interface SecureVideoControllerState {
  homeKitCameraActive: number;
  operatingModeIndicator: number;
  globalStreamingEnabled: boolean;
  webrtcStreamingEnabled: boolean;
  rtpStreamingEnabled: boolean;
  motionEnabled: boolean;
  motionZonesActive: number;
  zones?: string;
  recordingManagement?: RecordingManagementState;
  publishingPoint?: string;
  privateKey?: string;
  clientCertificate?: string;
  ca?: string;
  keys: { keyNumber: string, key: string }[];
  currentKeyNumber?: string;
  eventSequenceNumber: string;
}

/**
 * @group Camera Secure Video
 */
export const enum SecureVideoControllerEvents {
  ZONES_CHANGED = "zones-changed",
  OPERATING_MODE_CHANGED = "operating-mode-changed",
}

/**
 * @group Camera Secure Video
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface SecureVideoController {
  on(event: "zones-changed", listener: (zones: CameraZonesValue | undefined, active: boolean) => void): this;
  on(event: "operating-mode-changed", listener: () => void): this;

  emit(event: "zones-changed", zones: CameraZonesValue | undefined, active: boolean): boolean;
  emit(event: "operating-mode-changed"): boolean;
}

interface WebRTCSession {
  sessionIdentifier: string;
  answered: boolean;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type CameraBufferEventInput = DistributiveOmit<CameraBufferEvent, "sequenceNumber">;

type TLVWriteHandler = (value: Buffer, connection?: HAPConnection) => Promise<Buffer | undefined> | Buffer | undefined;

/**
 * Implements the camera services of the HomeKit Secure Video Open Source Compatibility Guide (WebRTC streaming,
 * multi-tier RTP streaming and CMAF ingest recording). Media handling is left to the supplied delegates.
 *
 * @group Camera Secure Video
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class SecureVideoController extends EventEmitter
  implements SerializableController<SecureVideoControllerServiceMap, SecureVideoControllerState>, SnapshotController<SecureVideoControllerServiceMap> {
  public static readonly CONTROLLER_ID = "secure-video";

  public capabilitiesService?: CameraCapabilities;
  public globalOperatingModeService?: CameraGlobalOperatingMode;
  public motionZonesService?: CameraMotionZones;
  public multiTierStreamManagementService?: CameraMultiTierRTPStreamManagement;
  public webrtcStreamManagementService?: CameraWebRTCStreamManagement;
  public recordingManagement?: RecordingManagement;
  public bufferManagementService?: CameraBufferManagement;
  public keyManagementService?: CameraKeyManagement;
  public clientCertificateManagementService?: CameraClientCertificateManagement;
  public motionService?: Service;
  public microphoneService?: Microphone;
  public speakerService?: Speaker;

  private readonly options: SecureVideoControllerOptions;
  private stateChangeDelegate?: StateChangeDelegate;
  private motionServiceExternallySupplied = false;
  private dataStreamManagement?: DataStreamManagement;
  private snapshotTransport?: HDSSnapshotTransport;
  private cmafIngest?: CMAFIngest;
  private readonly externalCleanups: (() => void)[] = [];

  private readonly webrtcSessions = new Map<string, WebRTCSession>();
  private readonly lastResponses = new Map<string, string>();
  private readonly readHandlers = new Set<string>();

  private events: CameraBufferEvent[] = [];
  private eventSequenceNumber = 0n;

  private zones?: CameraZonesValue;
  private publishingPoint?: CameraRecordingPublishingPointValue;
  private privateKey?: crypto.KeyObject;
  private clientCertificate?: Buffer;
  private ca?: Buffer;
  private readonly keys = new Map<bigint, Buffer>();
  private currentKeyNumber?: bigint;

  constructor(options: SecureVideoControllerOptions) {
    super();
    this.options = options;
  }

  public controllerId(): ControllerIdentifier {
    return SecureVideoController.CONTROLLER_ID;
  }

  /** Whether the camera is enabled in HomeKit, mirrored from the {@link Characteristic.HomeKitCameraActive} of the global operating mode. */
  public get homeKitCameraActive(): boolean {
    return !!this.globalOperatingModeService?.getCharacteristic(Characteristic.HomeKitCameraActive).value;
  }

  /** The recording management service, see {@link recordingManagement}. */
  public get recordingManagementService(): Service | undefined {
    return this.recordingManagement?.recordingManagementService;
  }

  /** Whether recording is enabled by the user, mirrored from the {@link Characteristic.Active} of the recording management. */
  public get recordingActive(): boolean {
    return !!this.recordingManagementService?.getCharacteristic(Characteristic.Active).value;
  }

  /** Whether audio recording is enabled by the user. */
  public get recordingAudioActive(): boolean {
    return !!this.recordingManagementService?.getCharacteristic(Characteristic.RecordingAudioActive).value;
  }

  /** The configured motion zones and whether zone based motion detection is active. */
  public get motionZones(): { active: boolean, zones?: CameraZonesValue } {
    return {
      active: !!this.motionZonesService?.getCharacteristic(Characteristic.Active).value,
      zones: this.zones,
    };
  }

  /** Identifiers of the currently active WebRTC streaming sessions. */
  public get activeWebRTCSessions(): string[] {
    return [...this.webrtcSessions.keys()];
  }

  /**
   * Whether streaming is currently allowed, honoring the global operating mode (camera active, streaming enabled and
   * not manually disabled). Pass a stream management service to additionally require its own streaming to be enabled.
   */
  public streamingAllowed(service?: Service): boolean {
    if (!this.homeKitCameraActive) {
      return false;
    }
    if (!this.globalOperatingModeService?.getCharacteristic(Characteristic.StreamingEnabled).value) {
      return false;
    }
    if (this.globalOperatingModeService.testCharacteristic(Characteristic.ManuallyDisabled)
      && this.globalOperatingModeService.getCharacteristic(Characteristic.ManuallyDisabled).value) {
      return false;
    }
    return !service || !!service.getCharacteristic(Characteristic.StreamingEnabled).value;
  }

  /** Reports a motion state change by updating the motion sensor's {@link Characteristic.MotionDetected}. */
  public setMotionDetected(active: boolean): void {
    this.motionService?.updateCharacteristic(Characteristic.MotionDetected, active);
  }

  private ingestCredentials(): SecureVideoIngestCredentials {
    return {
      publishingPoint: this.publishingPoint,
      privateKey: this.privateKey?.export({ type: "pkcs8", format: "pem" }).toString(),
      clientCertificate: this.clientCertificate,
      ca: this.ca,
      keys: [...this.keys.entries()].map(([keyNumber, key]) => ({ keyNumber, key })),
      currentKeyNumber: this.currentKeyNumber,
    };
  }

  private ingestMediaDescription(): CMAFMediaDescription {
    const tiers = this.options.video.tiers;
    const top = tiers.reduce((best, tier) => (tier.width * tier.height > best.width * best.height ? tier : best), tiers[0]);
    const codecs = this.options.video.codec === StreamTierVideoCodec.H265 ? "hvc1.1.6.L120.B0" : "avc1.640028";
    return {
      codecs,
      width: top?.width ?? 1920,
      height: top?.height ?? 1080,
      bitrate: (top?.targetAverageBitrate ?? 1700) * 1000,
    };
  }

  /** Signals whether the CMAF ingest client certificate needs to be (re)issued by the HomeKit HomeHub. */
  public setClientCertificateNeedsUpdate(needsUpdate: boolean): void {
    this.clientCertificateManagementService?.updateCharacteristic(Characteristic.CameraClientCertificateStatus,
      encodeCameraClientCertificateStatus(needsUpdate).toString("base64"));
  }

  /** Ends the WebRTC streaming session with the given identifier and notifies the delegate. */
  public async endWebRTCSession(sessionIdentifier: string): Promise<void> {
    if (!this.webrtcSessions.delete(sessionIdentifier)) {
      return;
    }
    this.updateWebRTCSessionCount();
    await this.options.webrtc.delegate.handleEndSession(sessionIdentifier);
  }

  public constructServices(): SecureVideoControllerServiceMap {
    return this.buildServiceMap({}).serviceMap;
  }

  public initWithServices(serviceMap: SecureVideoControllerServiceMap): SecureVideoControllerServiceMap | void {
    const result = this.buildServiceMap(serviceMap);
    if (result.updated) {
      return result.serviceMap;
    }
  }

  public configureServices(): void {
    const { sensor, video, audio } = this.options;
    const sensorUUID = encodeSensorUUID(sensor.uuid).toString("base64");

    const videoTiers = encodeSupportedVideoStreamTiers({
      codec: video.codec,
      payloadType: video.payloadType ?? 99,
      tiers: video.tiers,
    }).toString("base64");
    const audioTiers = audio
      ? encodeSupportedAudioStreamTiers({ codec: StreamTierAudioCodec.OPUS, payloadType: audio.payloadType ?? 110, tiers: [audio.tier] }).toString("base64")
      : "";

    const capabilities = this.capabilitiesService!;
    capabilities.setCharacteristic(Characteristic.Version, CAMERA_CAPABILITIES_VERSION);
    this.registerRead(capabilities.getCharacteristic(Characteristic.CameraCapabilitiesConfiguration), () => encodeCameraCapabilities({
      version: 1,
      sensors: [{
        width: sensor.width,
        height: sensor.height,
        sensorUUID: sensor.uuid,
        type: sensor.type ?? CameraSensorType.PRIMARY,
        intent: sensor.intent ?? CameraSensorIntent.MAIN,
        videoStreams: video.tiers.map(tier => ({
          identifier: uuid.generate(`${sensor.uuid}:tier:${tier.identifier}`),
          quality: tier.quality,
          width: tier.width,
          height: tier.height,
          frameRate: tier.frameRate,
          averageBitrate: tier.targetAverageBitrate,
          peakBitrate: tier.peakBitrate,
        })),
      }],
    }).toString("base64"));

    const operatingMode = this.globalOperatingModeService!;
    for (const characteristic of [Characteristic.HomeKitCameraActive, Characteristic.StreamingEnabled, Characteristic.CameraOperatingModeIndicator]) {
      operatingMode.getCharacteristic(characteristic).on(CharacteristicEventTypes.CHANGE, () => {
        this.updateStatusActive();
        this.emit(SecureVideoControllerEvents.OPERATING_MODE_CHANGED);
        this.stateChangeDelegate?.();
      });
    }
    if (operatingMode.testCharacteristic(Characteristic.ManuallyDisabled)) {
      operatingMode.getCharacteristic(Characteristic.ManuallyDisabled).on(CharacteristicEventTypes.CHANGE, () => this.updateStatusActive());
    }

    const zones = this.motionZonesService!;
    zones.setCharacteristic(Characteristic.Version, CAMERA_CAPABILITIES_VERSION);
    zones.getCharacteristic(Characteristic.Active).on(CharacteristicEventTypes.CHANGE, () => {
      this.emit(SecureVideoControllerEvents.ZONES_CHANGED, this.zones, this.motionZones.active);
      this.stateChangeDelegate?.();
    });
    this.registerRead(zones.getCharacteristic(Characteristic.CameraZones), () => this.zones ? encodeCameraZones(this.zones).toString("base64") : "");
    this.handleTLVWrite(zones.getCharacteristic(Characteristic.CameraZones), value => {
      this.zones = value.length ? decodeCameraZones(value) : undefined;
      this.emit(SecureVideoControllerEvents.ZONES_CHANGED, this.zones, this.motionZones.active);
      this.stateChangeDelegate?.();
      return undefined;
    });

    const rtp = this.multiTierStreamManagementService!;
    rtp.setCharacteristic(Characteristic.SensorUUID, sensorUUID);
    rtp.setCharacteristic(Characteristic.SupportedVideoStreamTiers, videoTiers);
    rtp.setCharacteristic(Characteristic.SupportedAudioStreamTiers, audioTiers);
    // SRTP_CRYPTO_SUITE: AES_CM_128_HMAC_SHA1_80
    rtp.setCharacteristic(Characteristic.SupportedRTPConfiguration, Buffer.from([0x02, 0x01, 0x00]).toString("base64"));
    rtp.getCharacteristic(Characteristic.StreamingEnabled).on(CharacteristicEventTypes.CHANGE, () => this.updateStatusActive());
    this.handleTLVWrite(rtp.getCharacteristic(Characteristic.SetupEndpoints), (value, connection) => this.handleSetupEndpoints(value, connection));
    this.handleTLVWrite(rtp.getCharacteristic(Characteristic.RTPStreamingControl), value => this.handleRTPStreamingControl(value));

    const webrtc = this.webrtcStreamManagementService!;
    // A HomeKit HomeHub finds one stream management service through the other's linked services when
    // setting up a remote stream; a shared sensor uuid alone does not establish the association.
    webrtc.addLinkedService(rtp);
    rtp.addLinkedService(webrtc);
    webrtc.setCharacteristic(Characteristic.SensorUUID, sensorUUID);
    webrtc.setCharacteristic(Characteristic.WebRTCSupportedVideoStreamTiers, videoTiers);
    webrtc.setCharacteristic(Characteristic.WebRTCSupportedAudioStreamTiers, audioTiers);
    webrtc.setCharacteristic(Characteristic.WebRTCNumberOfActiveSessions, 0);
    this.handleTLVWrite(webrtc.getCharacteristic(Characteristic.WebRTCSolicitOffer), value => this.handleSolicitOffer(value));
    this.handleTLVWrite(webrtc.getCharacteristic(Characteristic.WebRTCProvideAnswer), value => this.handleProvideAnswer(value));
    this.handleTLVWrite(webrtc.getCharacteristic(Characteristic.WebRTCReoffer), value => this.handleReoffer(value));
    this.handleTLVWrite(webrtc.getCharacteristic(Characteristic.WebRTCUpdateSession), value => this.handleUpdateSession(value));
    this.handleTLVWrite(webrtc.getCharacteristic(Characteristic.WebRTCStreamingControl), value => this.handleWebRTCStreamingControl(value));

    const recordingManagement = this.recordingManagement!;
    this.dataStreamManagement = recordingManagement.dataStreamManagement;
    const dataStreamService = this.dataStreamManagement.getService();
    // A HomeKit HomeHub locates the stream management services through the recording data stream they link to.
    rtp.addLinkedService(dataStreamService);
    webrtc.addLinkedService(dataStreamService);
    if (this.options.snapshot) {
      // iOS 27 fetches snapshots for the secure video services over HDS instead of the legacy image resource
      this.snapshotTransport = new HDSSnapshotTransport(this.dataStreamManagement, this.options.snapshot, () => this.homeKitCameraActive);
    }

    const recording = recordingManagement.recordingManagementService;
    for (const characteristic of [Characteristic.Active, Characteristic.RecordingAudioActive]) {
      this.onExternalChange(recording.getCharacteristic(characteristic), () => {
        this.options.ingest?.delegate.updateRecordingActive?.(this.recordingActive, this.recordingAudioActive);
        this.stateChangeDelegate?.();
      });
    }

    if (this.options.ingest) {
      this.configureCMAFIngestServices();
    }

    if (!this.motionServiceExternallySupplied && this.motionService) {
      this.motionService.setCharacteristic(Characteristic.StatusActive, true);
    }
    if (this.motionService) {
      recording.addLinkedService(this.motionService);
      recordingManagement.sensorServices.push(this.motionService);
      this.onExternalChange(this.motionService.getCharacteristic(Characteristic.MotionEnabled), () => this.stateChangeDelegate?.());
      this.onExternalChange(this.motionService.getCharacteristic(Characteristic.MotionDetected), change => {
        if (change.oldValue === change.newValue) {
          return;
        }
        const active = !!change.newValue;
        this.motionService!.updateCharacteristic(Characteristic.ContributingSensors,
          encodeContributingSensors(active ? [this.options.sensor.uuid] : []).toString("base64"));
        this.pushEvent({ type: CameraBufferEventType.MOTION, active });
      });
    }

    this.updateStatusActive();
  }

  private onExternalChange(characteristic: Characteristic, listener: (change: CharacteristicChange) => void): void {
    characteristic.on(CharacteristicEventTypes.CHANGE, listener);
    this.externalCleanups.push(() => characteristic.removeListener(CharacteristicEventTypes.CHANGE, listener));
  }

  private configureCMAFIngestServices(): void {
    this.cmafIngest = new CMAFIngest(this.options.ingest!.delegate, {
      sensorUUID: this.options.sensor.uuid,
      media: this.ingestMediaDescription(),
      credentials: () => this.ingestCredentials(),
      reportSessionStart: cmafSessionId => this.pushEvent({ type: CameraBufferEventType.CMAF_SESSION_START, cmafSessionId }),
      reportSessionStop: (cmafSessionId, detail) => {
        this.pushEvent({ type: CameraBufferEventType.CMAF_SESSION_STOP, cmafSessionId });
        this.options.ingest?.delegate.handleUploadResult?.(cmafSessionId, undefined, detail);
      },
      reportError: (cmafSessionId, error, detail) => {
        this.pushEvent({ type: CameraBufferEventType.CMAF_ERROR, cmafSessionId, error });
        this.options.ingest?.delegate.handleUploadResult?.(cmafSessionId, error, detail);
      },
    });

    const buffer = this.bufferManagementService!;
    buffer.setCharacteristic(Characteristic.BufferEventSequenceNumber, Number(this.eventSequenceNumber & 0xffffffffn));
    this.handleTLVWrite(buffer.getCharacteristic(Characteristic.BufferUploadCommand), value => this.handleBufferUpload(value));
    this.handleTLVWrite(buffer.getCharacteristic(Characteristic.BufferActivityCommand), value => {
      const request = decodeBufferActivityCommand(value);
      debug("buffer activity %o", request);
      this.options.ingest?.delegate.handleBufferActivity?.(request);
      return undefined;
    });
    this.handleTLVWrite(buffer.getCharacteristic(Characteristic.BufferEventCommand), value => this.handleBufferEventCommand(value));
    this.registerRead(buffer.getCharacteristic(Characteristic.CameraRecordingPublishingPoint),
      () => this.publishingPoint ? encodeCameraRecordingPublishingPoint(this.publishingPoint).toString("base64") : "");
    this.handleTLVWrite(buffer.getCharacteristic(Characteristic.CameraRecordingPublishingPoint), value => {
      this.publishingPoint = value.length ? decodeCameraRecordingPublishingPoint(value) : undefined;
      this.options.ingest?.delegate.updatePublishingPoint?.(this.publishingPoint);
      this.stateChangeDelegate?.();
      return undefined;
    });

    const keys = this.keyManagementService!;
    this.registerRead(keys.getCharacteristic(Characteristic.CameraKeyID),
      () => this.currentKeyNumber !== undefined ? encodeCameraKeyID(this.currentKeyNumber).toString("base64") : "");
    this.handleTLVWrite(keys.getCharacteristic(Characteristic.CameraKey), value => {
      if (!value.length) {
        this.keys.clear();
        this.currentKeyNumber = undefined;
        this.stateChangeDelegate?.();
        return undefined;
      }
      const { key, keyNumber } = decodeCameraKey(value);
      this.keys.set(keyNumber, key);
      this.currentKeyNumber = keyNumber;
      keys.getCharacteristic(Characteristic.CameraKeyID).sendEventNotification(encodeCameraKeyID(keyNumber).toString("base64"));
      this.stateChangeDelegate?.();
      return undefined;
    });

    const certificates = this.clientCertificateManagementService!;
    certificates.setCharacteristic(Characteristic.CameraClientCertificateStatus,
      encodeCameraClientCertificateStatus(!this.clientCertificate).toString("base64"));
    this.handleTLVWrite(certificates.getCharacteristic(Characteristic.CameraClientCSR), value => {
      const nonce = decodeCameraClientCSRRequest(value);
      this.privateKey ??= generateClientKey();
      const commonName = this.options.ingest?.certificateCommonName ?? this.options.sensor.uuid;
      const { csr, nonceSignature } = createClientCSR(this.privateKey, commonName, nonce);
      this.stateChangeDelegate?.();
      return encodeCameraClientCSRResponse(csr, nonceSignature);
    });
    this.registerRead(certificates.getCharacteristic(Characteristic.CameraClientCertificate), () => this.clientCertificate
      ? encodeCameraClientCertificate({ clientCertificate: this.clientCertificate, ca: this.ca }).toString("base64")
      : "");
    this.handleTLVWrite(certificates.getCharacteristic(Characteristic.CameraClientCertificate), value => {
      const { clientCertificate, ca } = value.length ? decodeCameraClientCertificate(value) : { clientCertificate: undefined, ca: undefined };
      this.clientCertificate = clientCertificate;
      this.ca = ca;
      this.setClientCertificateNeedsUpdate(!clientCertificate);
      this.options.ingest?.delegate.updateClientCertificate?.(!!clientCertificate);
      this.stateChangeDelegate?.();
      return undefined;
    });
  }

  /**
   * @private
   */
  handleSnapshotRequest(height: number, width: number, accessoryName?: string, reason?: ResourceRequestReason): Promise<Buffer> {
    const snapshot = this.options.snapshot;
    if (!snapshot) {
      return Promise.reject(HAPStatus.RESOURCE_DOES_NOT_EXIST);
    }

    const operatingMode = this.recordingManagement?.operatingModeService;
    if (!this.homeKitCameraActive || !operatingMode?.getCharacteristic(Characteristic.HomeKitCameraActive).value) {
      debug("[%s] rejecting snapshot as the HomeKit camera is disabled", accessoryName);
      return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }
    if (!operatingMode.getCharacteristic(Characteristic.EventSnapshotsActive).value) {
      if (reason == null) {
        return Promise.reject(HAPStatus.INSUFFICIENT_PRIVILEGES);
      } else if (reason === ResourceRequestReason.EVENT) {
        debug("[%s] rejecting snapshot as event snapshots are disabled", accessoryName);
        return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
      }
    }
    if (!operatingMode.getCharacteristic(Characteristic.PeriodicSnapshotsActive).value) {
      if (reason == null) {
        return Promise.reject(HAPStatus.INSUFFICIENT_PRIVILEGES);
      } else if (reason === ResourceRequestReason.PERIODIC) {
        debug("[%s] rejecting snapshot as periodic snapshots are disabled", accessoryName);
        return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        debug("[%s] the snapshot handler did not respond within %dms", accessoryName, SNAPSHOT_TIMEOUT_MS);
        reject(HAPStatus.OPERATION_TIMED_OUT);
      }, SNAPSHOT_TIMEOUT_MS);
      timeout.unref();

      snapshot({ height, width, reason }).then(buffer => {
        clearTimeout(timeout);
        resolve(buffer);
      }, error => {
        clearTimeout(timeout);
        debug("[%s] error getting snapshot: %s", accessoryName, error instanceof Error ? error.message : error);
        reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      });
    });
  }

  public handleControllerRemoved(): void {
    this.handleFactoryReset();
    this.snapshotTransport?.destroy();
    this.snapshotTransport = undefined;
    this.cmafIngest?.destroy();
    this.cmafIngest = undefined;
    this.recordingManagement?.destroy();
    this.recordingManagement = undefined;
    for (const cleanup of this.externalCleanups) {
      cleanup();
    }
    this.externalCleanups.length = 0;
    this.removeAllListeners();
  }

  public handleFactoryReset(): void {
    for (const sessionIdentifier of [...this.webrtcSessions.keys()]) {
      this.endWebRTCSession(sessionIdentifier).catch(error => debug("failed to end session %s: %s", sessionIdentifier, error));
    }
    this.recordingManagement?.handleFactoryReset();
    this.events = [];
    this.eventSequenceNumber = 0n;
    this.zones = undefined;
    this.publishingPoint = undefined;
    this.privateKey = undefined;
    this.clientCertificate = undefined;
    this.ca = undefined;
    this.keys.clear();
    this.currentKeyNumber = undefined;
    this.lastResponses.clear();
  }

  public serialize(): SecureVideoControllerState | undefined {
    const operatingMode = this.globalOperatingModeService;
    return {
      homeKitCameraActive: Number(operatingMode?.getCharacteristic(Characteristic.HomeKitCameraActive).value ?? 1),
      operatingModeIndicator: Number(operatingMode?.getCharacteristic(Characteristic.CameraOperatingModeIndicator).value ?? 1),
      globalStreamingEnabled: !!operatingMode?.getCharacteristic(Characteristic.StreamingEnabled).value,
      webrtcStreamingEnabled: !!this.webrtcStreamManagementService?.getCharacteristic(Characteristic.StreamingEnabled).value,
      rtpStreamingEnabled: !!this.multiTierStreamManagementService?.getCharacteristic(Characteristic.StreamingEnabled).value,
      motionEnabled: !!this.motionService?.getCharacteristic(Characteristic.MotionEnabled).value,
      motionZonesActive: Number(this.motionZonesService?.getCharacteristic(Characteristic.Active).value ?? 0),
      zones: this.zones ? encodeCameraZones(this.zones).toString("base64") : undefined,
      recordingManagement: this.recordingManagement?.serialize(),
      publishingPoint: this.publishingPoint ? encodeCameraRecordingPublishingPoint(this.publishingPoint).toString("base64") : undefined,
      privateKey: this.privateKey?.export({ type: "pkcs8", format: "pem" }).toString(),
      clientCertificate: this.clientCertificate?.toString("base64"),
      ca: this.ca?.toString("base64"),
      keys: [...this.keys.entries()].map(([keyNumber, key]) => ({ keyNumber: keyNumber.toString(), key: key.toString("base64") })),
      currentKeyNumber: this.currentKeyNumber?.toString(),
      eventSequenceNumber: this.eventSequenceNumber.toString(),
    };
  }

  public deserialize(serialized: SecureVideoControllerState): void {
    const operatingMode = this.globalOperatingModeService;
    operatingMode?.updateCharacteristic(Characteristic.HomeKitCameraActive, serialized.homeKitCameraActive);
    operatingMode?.updateCharacteristic(Characteristic.CameraOperatingModeIndicator, serialized.operatingModeIndicator);
    operatingMode?.updateCharacteristic(Characteristic.StreamingEnabled, serialized.globalStreamingEnabled);
    this.webrtcStreamManagementService?.updateCharacteristic(Characteristic.StreamingEnabled, serialized.webrtcStreamingEnabled);
    this.multiTierStreamManagementService?.updateCharacteristic(Characteristic.StreamingEnabled, serialized.rtpStreamingEnabled);
    this.motionService?.updateCharacteristic(Characteristic.MotionEnabled, serialized.motionEnabled);
    this.motionZonesService?.updateCharacteristic(Characteristic.Active, serialized.motionZonesActive);
    if (serialized.recordingManagement) {
      this.recordingManagement?.deserialize(serialized.recordingManagement);
    }

    this.zones = serialized.zones ? decodeCameraZones(Buffer.from(serialized.zones, "base64")) : undefined;
    this.publishingPoint = serialized.publishingPoint
      ? decodeCameraRecordingPublishingPoint(Buffer.from(serialized.publishingPoint, "base64"))
      : undefined;
    this.privateKey = serialized.privateKey ? crypto.createPrivateKey(serialized.privateKey) : undefined;
    this.clientCertificate = serialized.clientCertificate ? Buffer.from(serialized.clientCertificate, "base64") : undefined;
    this.ca = serialized.ca ? Buffer.from(serialized.ca, "base64") : undefined;
    this.keys.clear();
    for (const { keyNumber, key } of serialized.keys ?? []) {
      this.keys.set(BigInt(keyNumber), Buffer.from(key, "base64"));
    }
    this.currentKeyNumber = serialized.currentKeyNumber !== undefined ? BigInt(serialized.currentKeyNumber) : undefined;
    this.eventSequenceNumber = BigInt(serialized.eventSequenceNumber ?? "0");

    this.bufferManagementService?.updateCharacteristic(Characteristic.BufferEventSequenceNumber, Number(this.eventSequenceNumber & 0xffffffffn));
    this.setClientCertificateNeedsUpdate(!this.clientCertificate);
    this.updateStatusActive();
  }

  public setupStateChangeDelegate(delegate?: StateChangeDelegate): void {
    this.stateChangeDelegate = delegate;
    this.recordingManagement?.setupStateChangeDelegate(delegate);
  }

  private buildServiceMap(existing: SecureVideoControllerServiceMap): { serviceMap: SecureVideoControllerServiceMap, updated: boolean } {
    const serviceMap: SecureVideoControllerServiceMap = { ...existing };
    let updated = false;

    function ensure<K extends keyof SecureVideoControllerServiceMap>(key: K, create: () => NonNullable<SecureVideoControllerServiceMap[K]>) {
      if (!serviceMap[key]) {
        serviceMap[key] = create();
        updated = true;
      }
      return serviceMap[key]!;
    }

    this.capabilitiesService = ensure("capabilities", () => new Service.CameraCapabilities("", ""));
    this.globalOperatingModeService = ensure("globalOperatingMode", () => {
      const service = new Service.CameraGlobalOperatingMode("", "");
      service.setCharacteristic(Characteristic.HomeKitCameraActive, Characteristic.HomeKitCameraActive.ON);
      service.setCharacteristic(Characteristic.StreamingEnabled, true);
      service.setCharacteristic(Characteristic.CameraOperatingModeIndicator, Characteristic.CameraOperatingModeIndicator.ENABLE);
      service.setCharacteristic(Characteristic.ThirdPartyCameraActive, Characteristic.ThirdPartyCameraActive.ON);
      return service;
    });
    this.motionZonesService = ensure("motionZones", () => new Service.CameraMotionZones("", ""));
    this.multiTierStreamManagementService = ensure("multiTierStreamManagement", () => {
      const service = new Service.CameraMultiTierRTPStreamManagement("", "");
      service.setCharacteristic(Characteristic.StreamingEnabled, true);
      return service;
    });
    this.webrtcStreamManagementService = ensure("webrtcStreamManagement", () => {
      const service = new Service.CameraWebRTCStreamManagement("", "");
      service.setCharacteristic(Characteristic.StreamingEnabled, true);
      return service;
    });
    const { recording } = this.options;
    const eventTriggers = new Set<EventTriggerOption>([EventTriggerOption.MOTION, ...(recording.options.overrideEventTriggerOptions ?? [])]);
    if (serviceMap.recordingManagement && serviceMap.cameraOperatingMode && serviceMap.dataStreamTransportManagement) {
      this.recordingManagement = new RecordingManagement(recording.options, recording.delegate, eventTriggers, {
        recordingManagement: serviceMap.recordingManagement,
        operatingMode: serviceMap.cameraOperatingMode,
        dataStreamManagement: new DataStreamManagement(serviceMap.dataStreamTransportManagement),
      });
    } else {
      this.recordingManagement = new RecordingManagement(recording.options, recording.delegate, eventTriggers);
      serviceMap.recordingManagement = this.recordingManagement.recordingManagementService;
      serviceMap.cameraOperatingMode = this.recordingManagement.operatingModeService;
      serviceMap.dataStreamTransportManagement = this.recordingManagement.dataStreamManagement.getService();
      updated = true;
    }
    const recordingService = this.recordingManagement.recordingManagementService;
    if (!recordingService.testCharacteristic(Characteristic.RecordingAudioActive)) {
      recordingService.addCharacteristic(Characteristic.RecordingAudioActive);
    }
    // the buffer, key and certificate management services signal a CMAF accessory-direct-upload camera to the
    // HomeKit HomeHub. They are only added when an ingest delegate is supplied; without them the hub records
    // over the classic HDS bulk-send path.
    if (this.options.ingest) {
      this.bufferManagementService = ensure("bufferManagement", () => new Service.CameraBufferManagement("", ""));
      this.keyManagementService = ensure("keyManagement", () => new Service.CameraKeyManagement("", ""));
      this.clientCertificateManagementService = ensure("clientCertificateManagement", () => new Service.CameraClientCertificateManagement("", ""));
    } else {
      for (const key of ["bufferManagement", "keyManagement", "clientCertificateManagement"] as const) {
        if (serviceMap[key]) {
          delete serviceMap[key];
          updated = true;
        }
      }
    }

    if (this.options.audio) {
      this.microphoneService = ensure("microphone", () => {
        const service = new Service.Microphone("", "");
        service.setCharacteristic(Characteristic.Volume, 100);
        return service;
      });
    } else if (serviceMap.microphone) {
      delete serviceMap.microphone;
      updated = true;
    }
    if (this.options.audio?.twoWayAudio) {
      this.speakerService = ensure("speaker", () => {
        const service = new Service.Speaker("", "");
        service.setCharacteristic(Characteristic.Volume, 100);
        return service;
      });
    } else if (serviceMap.speaker) {
      delete serviceMap.speaker;
      updated = true;
    }

    if (this.options.motionService) {
      this.motionService = this.options.motionService;
      this.motionServiceExternallySupplied = true;
      if (serviceMap.motionSensor) {
        delete serviceMap.motionSensor;
        updated = true;
      }
    } else {
      this.motionService = ensure("motionSensor", () => new Service.MotionSensor("", ""));
    }
    for (const characteristic of [Characteristic.ContributingSensors, Characteristic.MotionEnabled]) {
      if (!this.motionService.testCharacteristic(characteristic)) {
        this.motionService.addCharacteristic(characteristic);
      }
    }
    if (!serviceMap.motionSensor || this.motionServiceExternallySupplied) {
      this.motionService.setCharacteristic(Characteristic.MotionEnabled, true);
    }

    return { serviceMap, updated };
  }

  private updateStatusActive(): void {
    const rtp = this.multiTierStreamManagementService;
    rtp?.updateCharacteristic(Characteristic.StatusActive, this.streamingAllowed(rtp));
  }

  private updateWebRTCSessionCount(): void {
    this.webrtcStreamManagementService?.updateCharacteristic(Characteristic.WebRTCNumberOfActiveSessions, Math.min(255, this.webrtcSessions.size));
  }

  private pushEvent(event: CameraBufferEventInput): void {
    this.eventSequenceNumber += 1n;
    const queued = { ...event, sequenceNumber: this.eventSequenceNumber } as CameraBufferEvent;
    this.events.push(queued);
    if (this.events.length > MAX_QUEUED_EVENTS) {
      this.events.splice(0, this.events.length - MAX_QUEUED_EVENTS);
    }

    debug("queued buffer event %o", queued);
    this.bufferManagementService?.updateCharacteristic(Characteristic.BufferEventSequenceNumber, Number(this.eventSequenceNumber & 0xffffffffn));
    this.stateChangeDelegate?.();
  }

  private handleBufferEventCommand(value: Buffer): Buffer {
    const request = decodeBufferEventCommand(value);
    debug("buffer event command %o", request);

    if (request.command === BufferEventCommandType.ACKNOWLEDGE) {
      const acknowledged = request.sequenceNumber ?? this.eventSequenceNumber;
      this.events = this.events.filter(event => event.sequenceNumber > acknowledged);
      return encodeBufferEventCommandResponse([]);
    }

    const from = request.sequenceNumber ?? 0n;
    const limit = request.limit && request.limit > 0n ? Number(request.limit) : this.events.length;
    return encodeBufferEventCommandResponse(this.events.filter(event => event.sequenceNumber >= from).slice(0, limit));
  }

  private handleBufferUpload(value: Buffer): Buffer {
    const request = decodeBufferUploadCommand(value);
    debug("buffer upload command %o", request);

    if (!this.cmafIngest) {
      throw new HapStatusError(HAPStatus.RESOURCE_DOES_NOT_EXIST);
    }
    return encodeBufferUploadCommandResponse(this.cmafIngest.handleUploadCommand(request));
  }

  private async handleSetupEndpoints(value: Buffer, connection?: HAPConnection): Promise<Buffer> {
    const request = decodeRTPSetupEndpoints(value);
    debug("setup endpoints %o", request);

    const delegate = this.options.rtp.delegate;
    if (!connection) {
      return encodeRTPSetupEndpointsResponse(setupEndpointsError(request.sessionIdentifier));
    }

    const version = request.controllerAddress.version;
    const sourceAddress = connection.getLocalAddress(version);

    try {
      const response = await delegate.prepareStream({
        sessionIdentifier: request.sessionIdentifier,
        addressVersion: version,
        targetAddress: request.controllerAddress.address,
        sourceAddress,
        controllerVideoPort: request.controllerAddress.videoRTPPort,
        controllerAudioPort: request.controllerAddress.audioRTPPort,
        video: request.video,
        audio: request.audio,
      });
      return encodeRTPSetupEndpointsResponse({
        sessionIdentifier: request.sessionIdentifier,
        status: 0,
        accessoryAddress: {
          version,
          address: response.addressOverride ?? sourceAddress,
          videoRTPPort: response.videoPort,
          audioRTPPort: response.audioPort,
        },
        video: response.video,
        audio: response.audio,
        videoSSRC: response.videoSSRC,
        audioSSRC: response.audioSSRC,
      });
    } catch (error) {
      debug("setup endpoints failed: %s", error);
      return encodeRTPSetupEndpointsResponse(setupEndpointsError(request.sessionIdentifier));
    }
  }

  private async handleRTPStreamingControl(value: Buffer): Promise<Buffer> {
    const request = decodeRTPStreamingControl(value);
    debug("rtp streaming control %o", request);

    const delegate = this.options.rtp.delegate;

    try {
      if (request.command === RTPStreamingCommand.START) {
        if (!this.streamingAllowed(this.multiTierStreamManagementService)) {
          return encodeSessionStatus(request.sessionIdentifier, RTPStreamingStatus.ERROR);
        }
        await delegate.startStream({
          sessionIdentifier: request.sessionIdentifier,
          videoTier: request.videoTier ?? 0,
          videoSSRC: request.videoSSRC ?? 0,
          audioTier: request.audioTier,
          audioSSRC: request.audioSSRC,
        });
      } else {
        await delegate.stopStream(request.sessionIdentifier);
      }
      return encodeSessionStatus(request.sessionIdentifier, RTPStreamingStatus.SUCCESS);
    } catch (error) {
      debug("rtp streaming control failed: %s", error);
      return encodeSessionStatus(request.sessionIdentifier, RTPStreamingStatus.ERROR);
    }
  }

  private async handleSolicitOffer(value: Buffer): Promise<Buffer> {
    const options = decodeWebRTCSolicitOffer(value);
    const delegate = this.options.webrtc.delegate;

    if (!this.streamingAllowed(this.webrtcStreamManagementService)) {
      const status = !this.homeKitCameraActive ? WebRTCSolicitOfferStatus.PRIVACY_MODE_ACTIVE : WebRTCSolicitOfferStatus.ERROR;
      return encodeWebRTCSolicitOfferResponse({ status });
    }

    if (this.webrtcSessions.size >= (this.options.webrtc.maxSessions ?? DEFAULT_MAX_WEBRTC_SESSIONS)) {
      return encodeWebRTCSolicitOfferResponse({ status: WebRTCSolicitOfferStatus.ERROR });
    }

    const sessionIdentifier = uuid.unparse(crypto.randomBytes(16));
    this.webrtcSessions.set(sessionIdentifier, { sessionIdentifier, answered: false });
    this.updateWebRTCSessionCount();

    try {
      const offer = await delegate.handleSolicitOffer({ sessionIdentifier, options });
      return encodeWebRTCSolicitOfferResponse({
        sessionIdentifier,
        sdpOffer: offer.sdpOffer,
        candidates: offer.candidates,
        status: WebRTCSolicitOfferStatus.SUCCESS,
        sframe: offer.sframe,
      });
    } catch (error) {
      debug("solicit offer failed: %s", error);
      this.webrtcSessions.delete(sessionIdentifier);
      this.updateWebRTCSessionCount();
      return encodeWebRTCSolicitOfferResponse({ status: WebRTCSolicitOfferStatus.ERROR });
    }
  }

  private async handleProvideAnswer(value: Buffer): Promise<Buffer> {
    const request = decodeWebRTCProvideAnswer(value);
    const session = this.webrtcSessions.get(request.sessionIdentifier);
    if (!session) {
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.UNKNOWN_SESSION_IDENTIFIER);
    }

    try {
      await this.options.webrtc.delegate.handleProvideAnswer(request);
      session.answered = true;
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.SUCCESS);
    } catch (error) {
      debug("provide answer failed: %s", error);
      await this.endWebRTCSession(request.sessionIdentifier).catch(() => undefined);
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.ERROR);
    }
  }

  private async handleReoffer(value: Buffer): Promise<Buffer> {
    const request = decodeWebRTCReoffer(value);
    if (!this.webrtcSessions.has(request.sessionIdentifier)) {
      return encodeWebRTCReofferResponse({ sessionIdentifier: request.sessionIdentifier, status: WebRTCStreamingStatus.UNKNOWN_SESSION_IDENTIFIER });
    }

    try {
      const answer = await this.options.webrtc.delegate.handleReoffer(request);
      return encodeWebRTCReofferResponse({
        sessionIdentifier: request.sessionIdentifier,
        sdpAnswer: answer.sdpAnswer,
        status: WebRTCStreamingStatus.SUCCESS,
        sframe: answer.sframe,
      });
    } catch (error) {
      debug("reoffer failed: %s", error);
      return encodeWebRTCReofferResponse({ sessionIdentifier: request.sessionIdentifier, status: WebRTCStreamingStatus.ERROR });
    }
  }

  private async handleUpdateSession(value: Buffer): Promise<Buffer> {
    const request = decodeWebRTCUpdateSession(value);
    if (!this.webrtcSessions.has(request.sessionIdentifier)) {
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.UNKNOWN_SESSION_IDENTIFIER);
    }

    try {
      await this.options.webrtc.delegate.handleUpdateSession(request);
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.SUCCESS);
    } catch (error) {
      debug("update session failed: %s", error);
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.ERROR);
    }
  }

  private async handleWebRTCStreamingControl(value: Buffer): Promise<Buffer> {
    const request = decodeWebRTCStreamingControl(value);
    if (!this.webrtcSessions.has(request.sessionIdentifier)) {
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.UNKNOWN_SESSION_IDENTIFIER);
    }

    try {
      await this.endWebRTCSession(request.sessionIdentifier);
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.SUCCESS);
    } catch (error) {
      debug("end session failed: %s", error);
      return encodeSessionStatus(request.sessionIdentifier, WebRTCStreamingStatus.ERROR);
    }
  }

  private registerRead(characteristic: Characteristic, read: () => CharacteristicValue): void {
    this.readHandlers.add(characteristic.UUID);
    characteristic.onGet(() => this.lastResponses.get(characteristic.UUID) ?? read());
  }

  private handleTLVWrite(characteristic: Characteristic, handler: TLVWriteHandler): void {
    const name = characteristic.displayName;

    if (!this.readHandlers.has(characteristic.UUID)) {
      characteristic.onGet(() => this.lastResponses.get(characteristic.UUID) ?? "");
    }

    characteristic.onSet(async (value, _context, connection) => {
      let response: Buffer | undefined;
      try {
        response = await handler(Buffer.from(String(value), "base64"), connection);
      } catch (error) {
        if (error instanceof HapStatusError) {
          throw error;
        }
        debug("%s write failed: %s", name, error);
        throw new HapStatusError(HAPStatus.INVALID_VALUE_IN_REQUEST);
      }

      if (response === undefined) {
        return;
      }

      const encoded = response.toString("base64");
      this.lastResponses.set(characteristic.UUID, encoded);

      // Setup Endpoints has no write-response permission, the controller reads the result back instead
      if (!characteristic.props.perms.includes(Perms.WRITE_RESPONSE)) {
        return;
      }
      return encoded;
    });
  }
}
