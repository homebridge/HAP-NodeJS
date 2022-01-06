import crypto from "crypto";
import createDebug from "debug";
import { EventEmitter } from "events";
import { VideoCodecType } from ".";
import { Access, Characteristic, CharacteristicEventTypes } from "../Characteristic";
import { AudioBitrate, CameraRecordingDelegate, StateChangeDelegate } from "../controller";
import {
  DataStreamConnection,
  DataStreamConnectionEvent,
  DataStreamManagement,
  DataStreamProtocolHandler,
  EventHandler,
  HDSProtocolError,
  HDSProtocolSpecificErrorReason,
  HDSStatus,
  Protocols,
  RequestHandler,
  Topics,
} from "../datastream";
import { CameraOperatingMode, CameraRecordingManagement, SelectedCameraRecordingConfiguration } from "../definitions";
import { HAPStatus } from "../HAPServer";
import { Service } from "../Service";
import { HapStatusError } from "../util/hapStatusError";
import * as tlv from "../util/tlv";
import { H264CodecParameters, H264Level, H264Profile, Resolution } from "./RTPStreamManagement";

const debug = createDebug('HAP-NodeJS:Camera:RecordingManagement');

/**
 * Describes options passed to the {@link RecordingManagement}.
 */
export type CameraRecordingOptions = {
  /**
   * The size of the prebuffer in milliseconds. It must be at least 4000 ms.
   * A sensible value for this property is in the interval [4000, 8000].
   *
   * In order to provide some context to recording event, it is a good user experience
   * to also have the recording of a few seconds before the event occurs.
   * This exactly is the prebuffer. A camera will constantly store the last
   * x seconds (the `prebufferLength`) to provide more context to a given event.
   */
  prebufferLength: number;

  /**
   * This property can be used to override the automatic heuristic of the {@link CameraController}
   * which derives the {@link EventTriggerOption}s from application state.
   *
   * {@link EventTriggerOption}s are derived automatically as follows:
   * * {@link EventTriggerOption.MOTION} is enabled when a {@link MotionSensor} is configured (via {@link CameraControllerOptions.sensors}).
   * * {@link EventTriggerOption.DOORBELL} is enabled when the {@link DoorbellController} is used.
   *
   * Note: This property is **ADDITIVE**. Meaning if the {@link CameraController} decides to add
   * a certain {@link EventTriggerOption} it will still do so. This option can only be used to
   * add **additional** {@link EventTriggerOption}s!
   */
  overrideEventTriggerOptions?: EventTriggerOption[]

  /**
   * List of supported media {@link MediaContainerConfiguration}s (or a single one).
   */
  mediaContainerConfiguration: MediaContainerConfiguration | MediaContainerConfiguration[];

  video: VideoRecordingOptions,
  audio: AudioRecordingOptions,
}

/**
 * Describes the Event trigger.
 */
export const enum EventTriggerOption {
  /**
   * The Motion trigger. If enabled motion should trigger the start of a recording.
   */
  MOTION = 0x01,
  /**
   * The Doorbell trigger. If enabled a doorbell button press should trigger the start of a recording.
   */
  DOORBELL = 0x02,
}

export const enum MediaContainerType {
  FRAGMENTED_MP4 = 0x00
}

export interface MediaContainerConfiguration {
  /**
   * The type of media container.
   */
  type: MediaContainerType;
  /**
   * The length in milliseconds of every individual recording fragment.
   * A typical value of HomeKit Secure Video cameras is 4000ms.
   */
  fragmentLength: number;
}

export interface VideoRecordingOptions {
  type: VideoCodecType;
  parameters: H264CodecParameters;
  /**
   * Required resolutions to be supported are:
   * * 1920x1080
   * * 1280x720
   *
   * The following frame rates are required to be supported:
   * * 15 fps
   * * 24fps or 30fps
   */
  resolutions: Resolution[];
}

export type AudioRecordingOptions = {
  /**
   * List (or single entry) of supported {@link AudioRecordingCodec}s.
   */
  codecs: AudioRecordingCodec | AudioRecordingCodec[],
}

export type AudioRecordingCodec = {
  type: AudioRecordingCodecType,
  /**
   * The count of audio channels. Must be at least `1`.
   * Defaults to `1`.
   */
  audioChannels?: number,
  /**
   * The supported bitrate mode. Defaults to {@link AudioBitrate.VARIABLE}.
   */
  bitrateMode?: AudioBitrate,
  samplerate: AudioRecordingSamplerate[] | AudioRecordingSamplerate,
}

/**
 * This type describes the SelectedCameraRecordingConfiguration (written by the device to {@link SelectedCameraRecordingConfiguration}).
 */
export interface CameraRecordingConfiguration {
  /**
   * The size of the prebuffer in milliseconds.
   * This value is less or equal of the value advertised in the {@link SupportedCameraRecordingConfiguration}.
   */
  prebufferLength: number;
  /**
   * List of the enabled {@link EventTriggerOption}s.
   */
  eventTriggerTypes: EventTriggerOption[];
  /**
   * The selected {@link MediaContainerConfiguration}.
   */
  mediaContainerConfiguration: MediaContainerConfiguration;

  /**
   * The selected video codec configuration.
   */
  videoCodec: {
    type: VideoCodecType.H264;
    parameters: SelectedH264CodecParameters,
    resolution: Resolution,
  },

  /**
   * The selected audio codec configuration.
   */
  audioCodec: AudioRecordingCodec & {
    bitrate: number,
    samplerate: AudioRecordingSamplerate,
  },
}

export interface SelectedH264CodecParameters {
  profile: H264Profile,
  level: H264Level,
  bitRate: number,
  /**
   * The selected i-frame interval in milliseconds.
   */
  iFrameInterval: number,
}


const enum VideoCodecConfigurationTypes {
  CODEC_TYPE = 0x01,
  CODEC_PARAMETERS = 0x02,
  ATTRIBUTES = 0x03,
}

const enum VideoCodecParametersTypes {
  PROFILE_ID = 0x01,
  LEVEL = 0x02,
  BITRATE = 0x03,
  IFRAME_INTERVAL = 0x04,
}

const enum VideoAttributesTypes {
  IMAGE_WIDTH = 0x01,
  IMAGE_HEIGHT = 0x02,
  FRAME_RATE = 0x03,
}

const enum SelectedCameraRecordingConfigurationTypes {
  SELECTED_RECORDING_CONFIGURATION = 0x01,
  SELECTED_VIDEO_CONFIGURATION = 0x02,
  SELECTED_AUDIO_CONFIGURATION = 0x03,
}

export const enum AudioRecordingCodecType {
  AAC_LC = 0,
  AAC_ELD = 1,
}

export const enum AudioRecordingSamplerate {
  KHZ_8 = 0,
  KHZ_16 = 1,
  KHZ_24 = 2,
  KHZ_32 = 3,
  KHZ_44_1 = 4,
  KHZ_48 = 5,
}

const enum SupportedVideoRecordingConfigurationTypes {
  VIDEO_CODEC_CONFIGURATION = 0x01,
}

const enum SupportedCameraRecordingConfigurationTypes {
  PREBUFFER_LENGTH = 0x01,
  EVENT_TRIGGER_OPTIONS = 0x02,
  MEDIA_CONTAINER_CONFIGURATIONS = 0x03
}

const enum MediaContainerConfigurationTypes {
  MEDIA_CONTAINER_TYPE = 0x01,
  MEDIA_CONTAINER_PARAMETERS = 0x02,
}

const enum MediaContainerParameterTypes {
  FRAGMENT_LENGTH = 0x01,
}

const enum AudioCodecParametersTypes {
  CHANNEL = 0x01,
  BIT_RATE = 0x02,
  SAMPLE_RATE = 0x03,
  MAX_AUDIO_BITRATE = 0x04 // only present in selected audio codec parameters tlv
}

const enum AudioCodecConfigurationTypes {
  CODEC_TYPE = 0x01,
  CODEC_PARAMETERS = 0x02,
}

const enum SupportedAudioRecordingConfigurationTypes {
  AUDIO_CODEC_CONFIGURATION = 0x01,
}

export const enum PacketDataType {
  // mp4 moov box
  MEDIA_INITIALIZATION = "mediaInitialization",
  // mp4 moof + mdat boxes
  MEDIA_FRAGMENT = "mediaFragment",
}

interface DataSendDataEvent {
  streamId: number;
  packets: {
    data: Buffer;
    metadata: {
      dataType: PacketDataType,
      dataSequenceNumber: number,
      isLastDataChunk: boolean,
      dataChunkSequenceNumber: number,
      dataTotalSize?: number,
    }
  }[];
  endOfStream?: boolean;
}

export interface RecordingPacket {
  /**
   * The `Buffer` containing the data of the packet.
   */
  data: Buffer;
  /**
   * Defines if this `RecordingPacket` is the last one in the recording stream.
   * If `true` this will signal an end of stream and closes the recording stream.
   */
  isLast: boolean;
}


interface RecordingManagementServices {
  recordingManagement: CameraRecordingManagement;
  operatingMode: CameraOperatingMode;
  dataStreamManagement: DataStreamManagement;
}

export interface RecordingManagementState {
  /**
   * This property stores a hash of the supported configurations (recording, video and audio) of
   * the recording management. We use this to determine if the configuration was changed by the user.
   * If it was changed, we need to discard the `selectedConfiguration` to signify to HomeKit Controllers
   * that they might reconsider their decision based on the updated configuration.
   */
  configurationHash: {
    algorithm: "sha256";
    hash: string;
  };

  /**
   * The base64 encoded tlv of the {@link CameraRecordingConfiguration}.
   * This value MIGHT be `undefined` if no HomeKit controller has yet selected a configuration.
   */
  selectedConfiguration?: string;

  /**
   * Service `CameraRecordingManagement`; Characteristic `Active`
   */
  recordingActive: boolean;
  /**
   * Service `CameraRecordingManagement`; Characteristic `RecordingAudioActive`
   */
  recordingAudioActive: boolean;

  /**
   * Service `CameraOperatingMode`; Characteristic `EventSnapshotsActive`
   */
  eventSnapshotsActive: boolean;
  /**
   * Service `CameraOperatingMode`; Characteristic `HomeKitCameraActive`
   */
  homeKitCameraActive: boolean;
  /**
   * Service `CameraOperatingMode`; Characteristic `PeriodicSnapshotsActive`
   */
  periodicSnapshotsActive: boolean;
}

export class RecordingManagement {
  readonly options: CameraRecordingOptions;
  readonly delegate: CameraRecordingDelegate;

  private stateChangeDelegate?: StateChangeDelegate;

  private readonly supportedCameraRecordingConfiguration: string;
  private readonly supportedVideoRecordingConfiguration: string;
  private readonly supportedAudioRecordingConfiguration: string;

  /**
   * 32 bit mask of enabled {@link EventTriggerOption}s.
   */
  private readonly eventTriggerOptions: number;

  readonly recordingManagementService: CameraRecordingManagement;
  readonly operatingModeService: CameraOperatingMode;
  readonly dataStreamManagement: DataStreamManagement;

  /**
   * The currently active recording stream.
   * Any camera only supports one stream at a time.
   */
  private recordingStream?: CameraRecordingStream;
  private selectedConfiguration?: {
    /**
     * The parsed configuration structure.
     */
    parsed: CameraRecordingConfiguration,
    /**
     * The rawValue representation. TLV8 data encoded as base64 string.
     */
    base64: string,
  }

  /**
   * Array of sensor services (e.g. {@link Service.MotionSensor} or {@link Service.OccupancySensor}).
   * Any service in this array owns a {@link Characteristic.StatusActive} characteristic.
   * The value of the {@link Characteristic.HomeKitCameraActive} is mirrored towards the {@link Characteristic.StatusActive} characteristic.
   * The array is initialized my the caller shortly after calling the constructor.
   */
  sensorServices: Service[] = [];

  constructor(options: CameraRecordingOptions, delegate: CameraRecordingDelegate, eventTriggerOptions: Set<EventTriggerOption>, services?: RecordingManagementServices) {
    this.options = options;
    this.delegate = delegate;

    const recordingServices = services || this.constructService();
    this.recordingManagementService = recordingServices.recordingManagement;
    this.operatingModeService = recordingServices.operatingMode;
    this.dataStreamManagement = recordingServices.dataStreamManagement;

    this.eventTriggerOptions = 0;
    for (const option of eventTriggerOptions) {
      this.eventTriggerOptions |= option; // OR
    }

    this.supportedCameraRecordingConfiguration = this._supportedCameraRecordingConfiguration(options);
    this.supportedVideoRecordingConfiguration = this._supportedVideoRecordingConfiguration(options.video);
    this.supportedAudioRecordingConfiguration = this._supportedAudioStreamConfiguration(options.audio);

    this.setupServiceHandlers();
  }

  private constructService(): RecordingManagementServices {
    const recordingManagement = new Service.CameraRecordingManagement('', '');
    recordingManagement.setCharacteristic(Characteristic.Active, false);
    recordingManagement.setCharacteristic(Characteristic.RecordingAudioActive, false);

    const operatingMode = new Service.CameraOperatingMode('', '');
    operatingMode.setCharacteristic(Characteristic.EventSnapshotsActive, true);
    operatingMode.setCharacteristic(Characteristic.HomeKitCameraActive, true);
    operatingMode.setCharacteristic(Characteristic.PeriodicSnapshotsActive, true);

    const dataStreamManagement = new DataStreamManagement();
    recordingManagement.addLinkedService(dataStreamManagement.getService());

    return {
      recordingManagement: recordingManagement,
      operatingMode: operatingMode,
      dataStreamManagement: dataStreamManagement,
    };
  }

  private setupServiceHandlers() {
    // update the current configuration values to the current state.
    this.recordingManagementService.setCharacteristic(Characteristic.SupportedCameraRecordingConfiguration, this.supportedCameraRecordingConfiguration);
    this.recordingManagementService.setCharacteristic(Characteristic.SupportedVideoRecordingConfiguration, this.supportedVideoRecordingConfiguration);
    this.recordingManagementService.setCharacteristic(Characteristic.SupportedAudioRecordingConfiguration, this.supportedAudioRecordingConfiguration);

    this.recordingManagementService.getCharacteristic(Characteristic.SelectedCameraRecordingConfiguration)
      .onGet(this.handleSelectedCameraRecordingConfigurationRead.bind(this))
      .onSet(this.handleSelectedCameraRecordingConfigurationWrite.bind(this))
      .setProps({ adminOnlyAccess: [Access.WRITE] });

    this.recordingManagementService.getCharacteristic(Characteristic.Active)
      .onSet(value => this.delegate.updateRecordingActive(!!value))
      .on(CharacteristicEventTypes.CHANGE, () => this.stateChangeDelegate?.())
      .setProps({ adminOnlyAccess: [Access.WRITE] });

    this.recordingManagementService.getCharacteristic(Characteristic.RecordingAudioActive)
      .on(CharacteristicEventTypes.CHANGE, () => this.stateChangeDelegate?.())

    this.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive)
      .on(CharacteristicEventTypes.CHANGE, change => {
        for (const service of this.sensorServices) {
          service.setCharacteristic(Characteristic.StatusActive, !!change.newValue);
        }

        if (!change.newValue && this.recordingStream) {
          this.recordingStream.close(HDSProtocolSpecificErrorReason.NOT_ALLOWED);
        }

        this.stateChangeDelegate?.();
      })
      .setProps({ adminOnlyAccess: [Access.WRITE] });

    this.operatingModeService.getCharacteristic(Characteristic.EventSnapshotsActive)
      .on(CharacteristicEventTypes.CHANGE, () => this.stateChangeDelegate?.())
      .setProps({ adminOnlyAccess: [Access.WRITE] });

    this.operatingModeService.getCharacteristic(Characteristic.PeriodicSnapshotsActive)
      .on(CharacteristicEventTypes.CHANGE, () => this.stateChangeDelegate?.())
      .setProps({ adminOnlyAccess: [Access.WRITE] });

    this.dataStreamManagement
      .onRequestMessage(Protocols.DATA_SEND, Topics.OPEN, this.handleDataSendOpen.bind(this))
  }

  private handleDataSendOpen(connection: DataStreamConnection, id: number, message: Record<any, any>) {
    // for message fields see https://github.com/Supereg/secure-video-specification#41-start
    const streamId: number = message.streamId;
    const type: string = message.type;
    const target: string = message.target;
    const reason: string = message.reason;

    if (target != "controller" || type != "ipcamera.recording") {
      debug("[HDS %s] Received data send with unexpected target: %s or type: %d. Rejecting...",
        connection.remoteAddress, target, type);
      connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.PROTOCOL_SPECIFIC_ERROR, {
        status: HDSProtocolSpecificErrorReason.UNEXPECTED_FAILURE,
      });
      return;
    }

    if (!this.recordingManagementService.getCharacteristic(Characteristic.Active).value) {
      connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.PROTOCOL_SPECIFIC_ERROR, {
        status: HDSProtocolSpecificErrorReason.NOT_ALLOWED,
      });
      return;
    }

    if (!this.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value) {
      connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.PROTOCOL_SPECIFIC_ERROR, {
        status: HDSProtocolSpecificErrorReason.NOT_ALLOWED,
      });
      return;
    }

    if (this.recordingStream) {
      debug("[HDS %s] Rejecting DATA_SEND OPEN as another stream (%s) is already recording with streamId %d!",
        connection.remoteAddress, this.recordingStream.connection.remoteAddress, this.recordingStream.streamId);
      // there is already a recording stream running.
      connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.PROTOCOL_SPECIFIC_ERROR, {
        status: HDSProtocolSpecificErrorReason.BUSY,
      });
      return;
    }

    if (!this.selectedConfiguration) {
      connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.PROTOCOL_SPECIFIC_ERROR, {
        status: HDSProtocolSpecificErrorReason.INVALID_CONFIGURATION,
      });
      return;
    }

    debug("[HDS %s] HDS DATA_SEND Open with reason '%s'.", connection.remoteAddress, reason);

    this.recordingStream = new CameraRecordingStream(connection, this.delegate, id, streamId);
    this.recordingStream.on(CameraRecordingStreamEvents.CLOSED, () => {
      this.recordingStream = undefined;
    });

    this.recordingStream.startStreaming();
  }

  private handleSelectedCameraRecordingConfigurationRead(): string {
    if (!this.selectedConfiguration) {
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    return this.selectedConfiguration.base64;
  }

  private handleSelectedCameraRecordingConfigurationWrite(value: any): void {
    const configuration = this.parseSelectedConfiguration(value);

    this.selectedConfiguration = {
      parsed: configuration,
      base64: value,
    };

    this.delegate.updateRecordingConfiguration(this.selectedConfiguration.parsed);

    // notify controller storage about updated values!
    this.stateChangeDelegate?.();
  }

  private parseSelectedConfiguration(value: string): CameraRecordingConfiguration {
    const decoded = tlv.decode(Buffer.from(value, 'base64'));

    const recording = tlv.decode(decoded[SelectedCameraRecordingConfigurationTypes.SELECTED_RECORDING_CONFIGURATION]);
    const video = tlv.decode(decoded[SelectedCameraRecordingConfigurationTypes.SELECTED_VIDEO_CONFIGURATION]);
    const audio = tlv.decode(decoded[SelectedCameraRecordingConfigurationTypes.SELECTED_AUDIO_CONFIGURATION]);

    const prebufferLength = recording[SupportedCameraRecordingConfigurationTypes.PREBUFFER_LENGTH].readInt32LE(0);
    let eventTriggerOptions = recording[SupportedCameraRecordingConfigurationTypes.EVENT_TRIGGER_OPTIONS].readInt32LE(0);
    const mediaContainerConfiguration = tlv.decode(recording[SupportedCameraRecordingConfigurationTypes.MEDIA_CONTAINER_CONFIGURATIONS]);
    const containerType = mediaContainerConfiguration[MediaContainerConfigurationTypes.MEDIA_CONTAINER_TYPE][0];
    const mediaContainerParameters = tlv.decode(mediaContainerConfiguration[MediaContainerConfigurationTypes.MEDIA_CONTAINER_PARAMETERS]);
    const fragmentLength = mediaContainerParameters[MediaContainerParameterTypes.FRAGMENT_LENGTH].readInt32LE(0);

    const videoCodec = video[VideoCodecConfigurationTypes.CODEC_TYPE][0];
    const videoParameters = tlv.decode(video[VideoCodecConfigurationTypes.CODEC_PARAMETERS]);
    const videoAttributes = tlv.decode(video[VideoCodecConfigurationTypes.ATTRIBUTES]);

    const profile = videoParameters[VideoCodecParametersTypes.PROFILE_ID][0];
    const level = videoParameters[VideoCodecParametersTypes.LEVEL][0];
    const videoBitrate = videoParameters[VideoCodecParametersTypes.BITRATE].readInt32LE(0);
    const iFrameInterval = videoParameters[VideoCodecParametersTypes.IFRAME_INTERVAL].readInt32LE(0);

    const width = videoAttributes[VideoAttributesTypes.IMAGE_WIDTH].readInt16LE(0);
    const height = videoAttributes[VideoAttributesTypes.IMAGE_HEIGHT].readInt16LE(0);
    const framerate = videoAttributes[VideoAttributesTypes.FRAME_RATE][0];

    const audioCodec = audio[AudioCodecConfigurationTypes.CODEC_TYPE][0];
    const audioParameters = tlv.decode(audio[AudioCodecConfigurationTypes.CODEC_PARAMETERS]);

    const audioChannels = audioParameters[AudioCodecParametersTypes.CHANNEL][0];
    const samplerate = audioParameters[AudioCodecParametersTypes.SAMPLE_RATE][0];
    const audioBitrateMode = audioParameters[AudioCodecParametersTypes.BIT_RATE][0];
    const audioBitrate = audioParameters[AudioCodecParametersTypes.MAX_AUDIO_BITRATE].readUInt32LE(0);

    const typedEventTriggers: EventTriggerOption[] = [];
    let bit_index = 0;
    while (eventTriggerOptions > 0) {
      if (eventTriggerOptions & 0x01) { // of the lowest bit is set add the next event trigger option
        typedEventTriggers.push(1 << bit_index);
      }
      eventTriggerOptions = eventTriggerOptions >> 1; // shift to right till we reach zero.
      bit_index += 1; // count our current bit index
    }

    return {
      prebufferLength: prebufferLength,
      eventTriggerTypes: typedEventTriggers,
      mediaContainerConfiguration: {
        type: containerType,
        fragmentLength,
      },
      videoCodec: {
        type: videoCodec,
        parameters: {
          profile: profile,
          level: level,
          bitRate: videoBitrate,
          iFrameInterval: iFrameInterval,
        },
        resolution: [width, height, framerate],
      },
      audioCodec: {
        audioChannels,
        type: audioCodec,
        samplerate,
        bitrateMode: audioBitrateMode,
        bitrate: audioBitrate,
      },
    };
  }

  private _supportedCameraRecordingConfiguration(options: CameraRecordingOptions): string {
    const mediaContainers = Array.isArray(options.mediaContainerConfiguration)
      ? options.mediaContainerConfiguration
      : [options.mediaContainerConfiguration]

    const prebufferLength = Buffer.alloc(4);
    const eventTriggerOptions = Buffer.alloc(8);

    prebufferLength.writeInt32LE(options.prebufferLength, 0);
    eventTriggerOptions.writeInt32LE(this.eventTriggerOptions, 0);

    return tlv.encode(
      SupportedCameraRecordingConfigurationTypes.PREBUFFER_LENGTH, prebufferLength,
      SupportedCameraRecordingConfigurationTypes.EVENT_TRIGGER_OPTIONS, eventTriggerOptions,
      SupportedCameraRecordingConfigurationTypes.MEDIA_CONTAINER_CONFIGURATIONS, mediaContainers.map(config => {
        const fragmentLength = Buffer.alloc(4);

        fragmentLength.writeInt32LE(config.fragmentLength, 0);

        return tlv.encode(
          MediaContainerConfigurationTypes.MEDIA_CONTAINER_TYPE, config.type,
          MediaContainerConfigurationTypes.MEDIA_CONTAINER_PARAMETERS, tlv.encode(
            MediaContainerParameterTypes.FRAGMENT_LENGTH, fragmentLength,
          )
        );
      })
    ).toString('base64');
  }

  private _supportedVideoRecordingConfiguration(videoOptions: VideoRecordingOptions): string {
    if (!videoOptions.parameters) {
      throw new Error('Video parameters cannot be undefined');
    }
    if (!videoOptions.resolutions) {
      throw new Error('Video resolutions cannot be undefined');
    }

    let codecParameters = tlv.encode(
      VideoCodecParametersTypes.PROFILE_ID, videoOptions.parameters.profiles,
      VideoCodecParametersTypes.LEVEL, videoOptions.parameters.levels,
    );

    const videoStreamConfiguration = tlv.encode(
      VideoCodecConfigurationTypes.CODEC_TYPE, videoOptions.type,
      VideoCodecConfigurationTypes.CODEC_PARAMETERS, codecParameters,
      VideoCodecConfigurationTypes.ATTRIBUTES, videoOptions.resolutions.map(resolution => {
        if (resolution.length != 3) {
          throw new Error('Unexpected video resolution');
        }

        const width = Buffer.alloc(2);
        const height = Buffer.alloc(2);
        const frameRate = Buffer.alloc(1);

        width.writeUInt16LE(resolution[0], 0);
        height.writeUInt16LE(resolution[1], 0);
        frameRate.writeUInt8(resolution[2], 0);

        return tlv.encode(
          VideoAttributesTypes.IMAGE_WIDTH, width,
          VideoAttributesTypes.IMAGE_HEIGHT, height,
          VideoAttributesTypes.FRAME_RATE, frameRate,
        );
      }),
    );

    return tlv.encode(
      SupportedVideoRecordingConfigurationTypes.VIDEO_CODEC_CONFIGURATION, videoStreamConfiguration,
    ).toString('base64');
  }

  private _supportedAudioStreamConfiguration(audioOptions: AudioRecordingOptions): string {
    const audioCodecs = Array.isArray(audioOptions.codecs)
      ? audioOptions.codecs
      : [audioOptions.codecs]

    if (audioCodecs.length === 0) {
      throw Error("CameraRecordingOptions.audio: At least one audio codec configuration must be specified!");
    }

    const codecConfigurations: Buffer[] = audioCodecs.map(codec => {
      const providedSamplerates = Array.isArray(codec.samplerate)
        ? codec.samplerate
        : [codec.samplerate];

      if (providedSamplerates.length === 0) {
        throw new Error("CameraRecordingOptions.audio.codecs: Audio samplerate cannot be empty!");
      }

      const audioParameters = tlv.encode(
        AudioCodecParametersTypes.CHANNEL, Math.max(1, codec.audioChannels || 1),
        AudioCodecParametersTypes.BIT_RATE, codec.bitrateMode || AudioBitrate.VARIABLE,
        AudioCodecParametersTypes.SAMPLE_RATE, providedSamplerates,
      )

      return tlv.encode(
        AudioCodecConfigurationTypes.CODEC_TYPE, codec.type,
        AudioCodecConfigurationTypes.CODEC_PARAMETERS, audioParameters
      );
    });

    return tlv.encode(
      SupportedAudioRecordingConfigurationTypes.AUDIO_CODEC_CONFIGURATION, codecConfigurations,
    ).toString("base64");
  }

  private computeConfigurationHash(algorithm: string = "sha256"): string {
    const configurationHash = crypto.createHash(algorithm);
    configurationHash.update(this.supportedCameraRecordingConfiguration);
    configurationHash.update(this.supportedVideoRecordingConfiguration);
    configurationHash.update(this.supportedAudioRecordingConfiguration);
    return configurationHash.digest().toString("hex");
  }

  /**
   * @private
   */
  serialize(): RecordingManagementState | undefined {
    return {
      configurationHash: {
        algorithm: "sha256",
        hash: this.computeConfigurationHash("sha256"),
      },
      selectedConfiguration: this.selectedConfiguration?.base64,

      recordingActive: !!this.recordingManagementService.getCharacteristic(Characteristic.Active).value,
      recordingAudioActive: !!this.recordingManagementService.getCharacteristic(Characteristic.RecordingAudioActive).value,

      eventSnapshotsActive: !!this.operatingModeService.getCharacteristic(Characteristic.EventSnapshotsActive).value,
      homeKitCameraActive: !!this.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value,
      periodicSnapshotsActive: !!this.operatingModeService.getCharacteristic(Characteristic.PeriodicSnapshotsActive).value,
    };
  }

  /**
   * @private
   */
  deserialize(serialized: RecordingManagementState): void {
    let changedState = false;

    // we only restore the `selectedConfiguration` if our supported configuration hasn't changed.
    let currentConfigurationHash = this.computeConfigurationHash(serialized.configurationHash.algorithm);
    if (serialized.selectedConfiguration) {
      if (currentConfigurationHash == serialized.configurationHash.hash) {
        this.selectedConfiguration = {
          base64: serialized.selectedConfiguration,
          parsed: this.parseSelectedConfiguration(serialized.selectedConfiguration),
        }
      } else {
        changedState = true;
      }
    }

    this.recordingManagementService.updateCharacteristic(Characteristic.Active, serialized.recordingActive);
    this.recordingManagementService.updateCharacteristic(Characteristic.RecordingAudioActive, serialized.recordingAudioActive);

    this.operatingModeService.updateCharacteristic(Characteristic.EventSnapshotsActive, serialized.eventSnapshotsActive);
    this.operatingModeService.updateCharacteristic(Characteristic.PeriodicSnapshotsActive, serialized.periodicSnapshotsActive);

    this.operatingModeService.updateCharacteristic(Characteristic.HomeKitCameraActive, serialized.homeKitCameraActive);
    for (const service of this.sensorServices) {
      service.setCharacteristic(Characteristic.StatusActive, serialized.homeKitCameraActive);
    }

    try {
      if (this.selectedConfiguration) {
        this.delegate.updateRecordingConfiguration(this.selectedConfiguration.parsed);
      }
      if (serialized.recordingActive) {
        this.delegate.updateRecordingActive(serialized.recordingActive);
      }
    } catch (error) {
      console.error("Failed to properly initialize CameraRecordingDelegate from persistent storage: " + error.stack);
    }

    if (changedState) {
      this.stateChangeDelegate?.();
    }
  }

  /**
   * @private
   */
  setupStateChangeDelegate(delegate?: StateChangeDelegate): void {
    this.stateChangeDelegate = delegate;
  }

  destroy(): void {
    this.dataStreamManagement.destroy();
  }

  handleFactoryReset() {
    this.selectedConfiguration = undefined;
    this.recordingManagementService.updateCharacteristic(Characteristic.Active, false);
    this.recordingManagementService.updateCharacteristic(Characteristic.RecordingAudioActive, false);

    this.operatingModeService.updateCharacteristic(Characteristic.EventSnapshotsActive, true);
    this.operatingModeService.updateCharacteristic(Characteristic.PeriodicSnapshotsActive, true);

    this.operatingModeService.updateCharacteristic(Characteristic.HomeKitCameraActive, true);
    for (const service of this.sensorServices) {
      service.setCharacteristic(Characteristic.StatusActive, true);
    }

    try {
      // notifying the delegate about the updated state
      this.delegate.updateRecordingActive(false);
      this.delegate.updateRecordingConfiguration(undefined);
    } catch (error) {
      console.error("CameraRecordingDelegate failed to update state after handleFactoryReset: " + error.stack);
    }
  }
}


const enum CameraRecordingStreamEvents {
  /**
   * This event is fired when the recording stream is closed.
   * Either due to a normal exit (e.g. the HomeKit Controller acknowledging the stream)
   * or due to an erroneous exit (e.g. HDS connection getting closed).
   */
  CLOSED = "closed",
}

declare interface CameraRecordingStream {
  on(event: "closed", listener: () => void): this;

  emit(event: "closed"): boolean;
}

/**
 * A `CameraRecordingStream` represents an ongoing stream request for a HomeKit Secure Video recording.
 * A single camera can only support one ongoing recording at a time.
 */
class CameraRecordingStream extends EventEmitter implements DataStreamProtocolHandler {
  readonly connection: DataStreamConnection;
  readonly delegate: CameraRecordingDelegate;
  readonly hdsRequestId: number;
  readonly streamId: number;
  private closed: boolean = false;

  eventHandler?: Record<string, EventHandler> = {
    [Topics.CLOSE]: this.handleDataSendClose.bind(this),
    [Topics.ACK]: this.handleDataSendAck.bind(this),
  }
  requestHandler?: Record<string, RequestHandler> = undefined;

  private readonly closeListener: () => void;

  private generator?: AsyncGenerator<RecordingPacket>;
  private generatorTimeout?: NodeJS.Timeout;

  constructor(connection: DataStreamConnection, delegate: CameraRecordingDelegate, requestId: number, streamId: number) {
    super();
    this.connection = connection;
    this.delegate = delegate;
    this.hdsRequestId = requestId;
    this.streamId = streamId;

    this.connection.on(DataStreamConnectionEvent.CLOSED, this.closeListener = this.handleDataStreamConnectionClosed.bind(this));
    this.connection.addProtocolHandler(Protocols.DATA_SEND, this);
  }

  startStreaming() {
    // noinspection JSIgnoredPromiseFromCall
    this._startStreaming();
  }

  private async _startStreaming() {
    debug("[HDS %s] Sending DATA_SEND OPEN response for streamId %d", this.connection.remoteAddress, this.streamId);
    this.connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, this.hdsRequestId, HDSStatus.SUCCESS, {
      status: HDSStatus.SUCCESS,
    });

    // 256 KiB (1KiB to 900 KiB)
    const maxChunk = 0x40000;

    // The first buffer which we receive from the generator is always the `mediaInitialization` packet (mp4 `moov` box).
    let initialization = true;
    let dataSequenceNumber = 1;

    // tracks if the last received RecordingPacket was yielded with `isLast=true`.
    let lastFragmentWasMarkedLast = false;

    try {
      this.generator = this.delegate.handleRecordingStreamRequest(this.streamId);

      for await (const packet of this.generator) {
        if (this.closed) {
          console.error(`[HDS ${this.connection.remoteAddress}] Delegate yielded fragment after stream ${this.streamId} was already closed!`);
          break;
        }

        if (lastFragmentWasMarkedLast) {
          console.error(`[HDS ${this.connection.remoteAddress}] Delegate yielded fragment for stream ${this.streamId} after already signaling end of stream!`);
          break;
        }

        const fragment = packet.data;

        let offset = 0;
        let dataChunkSequenceNumber = 1;
        while (offset < fragment.length) {
          const data = fragment.slice(offset, offset + maxChunk);
          offset += data.length;

          // see https://github.com/Supereg/secure-video-specification#42-binary-data
          const event: DataSendDataEvent = {
            streamId: this.streamId,
            packets: [{
              data: data,
              metadata: {
                dataType: initialization ? PacketDataType.MEDIA_INITIALIZATION : PacketDataType.MEDIA_FRAGMENT,
                dataSequenceNumber: dataSequenceNumber,
                dataChunkSequenceNumber: dataChunkSequenceNumber,
                isLastDataChunk: offset >= fragment.length,
                dataTotalSize: dataChunkSequenceNumber == 1 ? fragment.length : undefined,
              },
            }],
            endOfStream: offset >= fragment.length ? Boolean(packet.isLast).valueOf() : undefined,
          };

          debug("[HDS %s] Sending DATA_SEND DATA for stream %d with metadata: %o and length %d; EoS: %s",
            this.connection.remoteAddress, this.streamId, event.packets[0].metadata, data.length, event.endOfStream);
          this.connection.sendEvent(Protocols.DATA_SEND, Topics.DATA, event);

          dataChunkSequenceNumber++;
          initialization = false;
        }

        lastFragmentWasMarkedLast = packet.isLast;

        if (packet.isLast) {
          break;
        }

        dataSequenceNumber++;
      }

      if (!lastFragmentWasMarkedLast && !this.closed) {
        // Delegate violates the contract. Exited normally on a non-closed stream without properly setting `isLast`.
        console.warn(`[HDS ${this.connection.remoteAddress}] Delegate finished streaming for ${this.streamId} without setting RecordingPacket.isLast. Can't notify Controller about endOfStream!`);
      }
    } catch (error) {
      if (this.closed) {
        console.warn(`[HDS ${this.connection.remoteAddress}] Encountered unexpected error on already closed recording stream ${this.streamId}: ${error.stack}`);
      } else {
        let closeReason = HDSProtocolSpecificErrorReason.UNEXPECTED_FAILURE;

        if (error instanceof HDSProtocolError) {
          closeReason = error.reason;
          debug("[HDS %s] Delegate signaled to close the recording stream %d", this.connection.remoteAddress, this.streamId);
        } else {
          console.error(`[HDS ${this.connection.remoteAddress}] Encountered unexpected error for recording stream ${this.streamId}: ${error.stack}`);
        }

        this.connection.sendEvent(Protocols.DATA_SEND, Topics.CLOSE, {
          streamId: this.streamId,
          reason: closeReason,
        });
      }
      return;
    } finally {
      this.generator = undefined;

      if (this.generatorTimeout) {
        clearTimeout(this.generatorTimeout);
      }
    }

    if (initialization) { // we never actually sent anything out there!
      console.warn(`[HDS ${this.connection.remoteAddress}] Delegate finished recording stream ${this.streamId} without sending anything out. Controller will CANCEL.`);
    }

    debug("[HDS %s] Finished DATA_SEND transmission for stream %d!", this.connection.remoteAddress, this.streamId);
  }

  private handleDataSendAck(message: Record<any, any>) {
    const streamId: any = message.streamId;
    const endOfStream: any = message.endOfStream;

    // The HomeKit Controller will send a DATA_SEND ACK if we set the `endOfStream` flag in the last packet
    // of our DATA_SEND DATA packet.
    // To my testing the session is then considered complete and the HomeKit controller will close the HDS Connection after 5 seconds.

    debug("[HDS %s] Received DATA_SEND ACK packet for streamId %s. Acknowledged %s.", this.connection.remoteAddress, streamId, endOfStream);

    this.handleClosed(() => this.delegate.acknowledgeStream?.(this.streamId));
  }

  private handleDataSendClose(message: Record<any, any>) {
    // see https://github.com/Supereg/secure-video-specification#43-close
    const streamId: number = message.streamId;
    const reason: HDSProtocolSpecificErrorReason = message.reason;

    if (streamId != this.streamId) {
      return;
    }

    debug("[HDS %s] Received DATA_SEND CLOSE for streamId %d with reason %s",
    // @ts-expect-error
      this.connection.remoteAddress, streamId, HDSProtocolSpecificErrorReason[reason]);

    this.handleClosed(() => this.delegate.closeRecordingStream(streamId, reason));
  }

  private handleDataStreamConnectionClosed() {
    debug("[HDS %s] The HDS connection of the stream %d closed.", this.connection.remoteAddress, this.streamId);

    this.handleClosed(() => this.delegate.closeRecordingStream(this.streamId, undefined));
  }

  private handleClosed(closure: () => void): void {
    this.closed = true;

    this.connection.removeProtocolHandler(Protocols.DATA_SEND, this);
    this.connection.removeListener(DataStreamConnectionEvent.CLOSED, this.closeListener);

    if (this.generator) {
      // when this variable is defined, the generator hasn't returned yet.
      // we start a timeout to uncover potential programming mistakes where we await forever and can't free resources.
      this.generatorTimeout = setTimeout(() => {
        console.error("[HDS %s] Recording download stream %d is still awaiting generator although stream was closed 10s ago!",
          this.connection.remoteAddress, this.streamId);
      }, 10000);
    }

    try {
      closure();
    } catch (error) {
      console.error(`[HDS ${this.connection.remoteAddress}] CameraRecordingDelegated failed to handle closing the stream ${this.streamId}: ${error.stack}`);
    }

    this.emit(CameraRecordingStreamEvents.CLOSED);
  }

  /**
   * This method can be used to close a recording session from the outside.
   * @param reason - The reason to close the stream with.
   */
  close(reason: HDSProtocolSpecificErrorReason): void {
    if (this.closed) {
      return;
    }

    debug("[HDS %s] Recording stream %d was closed manually with reason %s.",
      // @ts-expect-error
      this.connection.remoteAddress, this.streamId, HDSProtocolSpecificErrorReason[reason]);

    this.connection.sendEvent(Protocols.DATA_SEND, Topics.CLOSE, {
      streamId: this.streamId,
      reason: reason,
    });

    this.handleClosed(() => this.delegate.closeRecordingStream(this.streamId, reason));
  }
}
