import { Characteristic, CharacteristicEventTypes } from "../Characteristic"
import { AudioBitrate, CameraRecordingDelegate } from "../controller";
import { CameraRecordingManagement, SelectedCameraRecordingConfiguration } from "../definitions"
import { Service } from "../Service"
import { H264CodecParameters, H264Level, H264Profile, Resolution } from "./RTPStreamManagement"
import createDebug from 'debug';
import * as tlv from '../util/tlv';
import { VideoCodecType } from "."

const debug = createDebug('HAP-NodeJS:Camera:RecordingManagement');

export type CameraRecordingConfiguration = { // TODO weirdly used type?
  mediaContainerConfiguration: MediaContainerConfiguration & {
    prebufferLength: number,
  },

  videoCodec: {
    type: VideoCodecType;
    iFrameInterval: number,
    level: H264Level,
    profile: H264Profile,
    resolution: Resolution,
    bitrate: number,
  },

  audioCodec: AudioRecordingCodec & {
    bitrate: number,
    samplerate: AudioRecordingSamplerate,
  },
}

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
   * * {@link EventTriggerOption.MOTION} is enabled when a {@link MotionSensor} is configured.
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

  motionService?: boolean; // TODO maybe control existing motion service via?
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

export type MediaContainerConfiguration = {
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

export type VideoRecordingOptions = {
  // TODO support configuring H265?
  codec: H264CodecParameters,
  resolutions: Resolution[],
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
  bitrateMode?: AudioBitrate, // TODO any supporting musts?
  samplerate: AudioRecordingSamplerate[] | AudioRecordingSamplerate,
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
  SELECTED_GENERAL_CONFIGURATION = 0x01,
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

export class RecordingManagement {
  private delegate: CameraRecordingDelegate;
  private readonly service: CameraRecordingManagement;

  private readonly supportedCameraRecordingConfiguration: string;
  private readonly supportedVideoRecordingConfiguration: string;
  private readonly supportedAudioRecordingConfiguration: string;

  /**
   * 32 bit mask of enabled {@link EventTriggerOption}s.
   */
  private readonly eventTriggerOptions: number;

  constructor(options: CameraRecordingOptions, delegate: CameraRecordingDelegate, eventTriggerOptions: Set<EventTriggerOption>, service?: CameraRecordingManagement) {
    this.delegate = delegate;
    this.service = service || this.constructService();

    this.setupServiceHandlers();

    this.eventTriggerOptions = 0;
    for (const option of eventTriggerOptions) {
      this.eventTriggerOptions |= option; // OR
    }

    this.supportedCameraRecordingConfiguration = this._supportedCameraRecordingConfiguration(options);
    this.supportedVideoRecordingConfiguration = RecordingManagement._supportedVideoRecordingConfiguration(options.video);
    this.supportedAudioRecordingConfiguration = this._supportedAudioStreamConfiguration(options.audio);
  }

  getService(): CameraRecordingManagement {
    return this.service;
  }

  private constructService(): CameraRecordingManagement {
    const managementService = new Service.CameraRecordingManagement('', '');

    managementService.setCharacteristic(Characteristic.Active, true);

    managementService.getCharacteristic(Characteristic.SupportedCameraRecordingConfiguration)
      .on('get', callback => {
        callback(null, this.supportedCameraRecordingConfiguration);
      });
    managementService.getCharacteristic(Characteristic.SupportedVideoRecordingConfiguration)
      .on('get', callback => {
        callback(null, this.supportedVideoRecordingConfiguration);
      });
    managementService.getCharacteristic(Characteristic.SupportedAudioRecordingConfiguration)
      .on('get', callback => {
        callback(null, this.supportedAudioRecordingConfiguration);
      });
    return managementService;
  }

  private setupServiceHandlers() {
    this.service.setCharacteristic(Characteristic.SelectedCameraRecordingConfiguration, '');
  }

  // TODO unused?
  static parseSelectedConfiguration(selectedconfiguration: string): CameraRecordingConfiguration {
    const decoded = tlv.decode(Buffer.from(selectedconfiguration, 'base64'));
    const recording = tlv.decode(decoded[SelectedCameraRecordingConfigurationTypes.SELECTED_GENERAL_CONFIGURATION]);
    const video = tlv.decode(decoded[SelectedCameraRecordingConfigurationTypes.SELECTED_VIDEO_CONFIGURATION]);
    const audio = tlv.decode(decoded[SelectedCameraRecordingConfigurationTypes.SELECTED_AUDIO_CONFIGURATION]);

    const vcodec = video[VideoCodecConfigurationTypes.CODEC_TYPE][0];
    const vparameters = tlv.decode(video[VideoCodecConfigurationTypes.CODEC_PARAMETERS]);
    const vattributes = tlv.decode(video[VideoCodecConfigurationTypes.ATTRIBUTES]);

    const width = vattributes[VideoAttributesTypes.IMAGE_WIDTH].readInt16LE(0);
    const height = vattributes[VideoAttributesTypes.IMAGE_HEIGHT].readInt16LE(0);
    const framerate = vattributes[VideoAttributesTypes.FRAME_RATE][0];

    const profile = vparameters[VideoCodecParametersTypes.PROFILE_ID][0];
    const level = vparameters[VideoCodecParametersTypes.LEVEL][0];
    const videoBitrate = vparameters[VideoCodecParametersTypes.BITRATE].readInt32LE(0);
    const iFrameInterval = vparameters[VideoCodecParametersTypes.IFRAME_INTERVAL].readInt32LE(0);

    const prebufferLength = recording[SupportedCameraRecordingConfigurationTypes.PREBUFFER_LENGTH].readInt32LE(0);
    const mediaContainerConfiguration = tlv.decode(recording[SupportedCameraRecordingConfigurationTypes.MEDIA_CONTAINER_CONFIGURATIONS]);

    const containerType = mediaContainerConfiguration[MediaContainerConfigurationTypes.MEDIA_CONTAINER_TYPE][0];
    const mediaContainerParameters = tlv.decode(mediaContainerConfiguration[MediaContainerConfigurationTypes.MEDIA_CONTAINER_PARAMETERS]);

    const fragmentLength = mediaContainerParameters[MediaContainerParameterTypes.FRAGMENT_LENGTH].readInt32LE(0);

    const acodec = audio[AudioCodecConfigurationTypes.CODEC_TYPE][0];
    const audioParameters = tlv.decode(audio[AudioCodecConfigurationTypes.CODEC_PARAMETERS]);
    const audioChannels = audioParameters[AudioCodecParametersTypes.CHANNEL][0];
    const samplerate = audioParameters[AudioCodecParametersTypes.SAMPLE_RATE][0];
    const audioBitrateMode = audioParameters[AudioCodecParametersTypes.BIT_RATE][0];
    const audioBitrate = audioParameters[AudioCodecParametersTypes.MAX_AUDIO_BITRATE].readUInt32LE(0);

    return {
      mediaContainerConfiguration: {
        prebufferLength,
        type: containerType,
        fragmentLength,
      },
      videoCodec: {
        type: vcodec,
        bitrate: videoBitrate,
        level,
        profile,
        resolution: [width, height, framerate],
        iFrameInterval,
      },
      audioCodec: {
        audioChannels,
        type: acodec,
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

  private static _supportedVideoRecordingConfiguration(videoOptions: VideoRecordingOptions): string {
    if (!videoOptions.codec) {
      throw new Error('Video codec cannot be undefined');
    }
    if (!videoOptions.resolutions) {
      throw new Error('Video resolutions cannot be undefined');
    }

    let codecParameters = tlv.encode(
      VideoCodecParametersTypes.PROFILE_ID, videoOptions.codec.profiles,
      VideoCodecParametersTypes.LEVEL, videoOptions.codec.levels,
    );

    const videoStreamConfiguration = tlv.encode(
      VideoCodecConfigurationTypes.CODEC_TYPE, VideoCodecType.H264, // TODO videoOptions.codec.type,
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
}
