import crypto from 'crypto';

import ip from 'ip';
import createDebug from 'debug';

import * as tlv from './util/tlv';
import { Service } from './Service';
import {
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback
} from './Characteristic';
import RTPProxy from './camera/RTPProxy';
import { EventEmitter } from './EventEmitter';
import { Camera } from './Camera';
import {
  Address,
  AudioInfo, CharacteristicValue,
  NodeCallback,
  Nullable,
  SessionIdentifier,
  Source,
  StreamAudioParams,
  StreamVideoParams,
  VideoInfo,
  VoidCallback,
} from '../types';

const debug = createDebug('StreamController');

export enum SetupTypes {
  SESSION_ID = 0x01,
  STATUS = 0x02,
  ADDRESS = 0x03,
  VIDEO_SRTP_PARAM = 0x04,
  AUDIO_SRTP_PARAM = 0x05,
  VIDEO_SSRC = 0x06,
  AUDIO_SSRC = 0x07
}

export enum SetupStatus {
  SUCCESS = 0x00,
  BUSY = 0x01,
  ERROR = 0x02
}

export enum SetupAddressVer {
  IPV4 = 0x00,
  IPV6 = 0x01
}

export enum SetupAddressInfo {
  ADDRESS_VER = 0x01,
  ADDRESS = 0x02,
  VIDEO_RTP_PORT = 0x03,
  AUDIO_RTP_PORT = 0x04
}

export enum SetupSRTP_PARAM {
  CRYPTO = 0x01,
  MASTER_KEY = 0x02,
  MASTER_SALT = 0x03
}

export enum StreamingStatus {
  AVAILABLE = 0x00,
  STREAMING = 0x01,
  BUSY = 0x02
}

export enum RTPConfigTypes {
  CRYPTO = 0x02
}

export enum SRTPCryptoSuites {
  AES_CM_128_HMAC_SHA1_80 = 0x00,
  AES_CM_256_HMAC_SHA1_80 = 0x01,
  NONE = 0x02
}

export enum VideoTypes {
  CODEC = 0x01,
  CODEC_PARAM = 0x02,
  ATTRIBUTES = 0x03,
  RTP_PARAM = 0x04
}

export enum VideoCodecTypes {
  H264 = 0x00
}

export enum VideoCodecParamTypes {
  PROFILE_ID = 0x01,
  LEVEL = 0x02,
  PACKETIZATION_MODE = 0x03,
  CVO_ENABLED = 0x04,
  CVO_ID = 0x05
}

export enum VideoCodecParamCVOTypes {
  UNSUPPORTED = 0x01,
  SUPPORTED = 0x02
}

export enum VideoCodecParamProfileIDTypes {
  BASELINE = 0x00,
  MAIN = 0x01,
  HIGH = 0x02
}

export enum VideoCodecParamLevelTypes {
  TYPE3_1 = 0x00,
  TYPE3_2 = 0x01,
  TYPE4_0 = 0x02
}

export enum VideoCodecParamPacketizationModeTypes {
  NON_INTERLEAVED = 0x00
}

export enum VideoAttributesTypes {
  IMAGE_WIDTH = 0x01,
  IMAGE_HEIGHT = 0x02,
  FRAME_RATE = 0x03
}

export enum SelectedStreamConfigurationTypes {
  SESSION = 0x01,
  VIDEO = 0x02,
  AUDIO = 0x03
}

export enum RTPParamTypes {
  PAYLOAD_TYPE = 0x01,
  SYNCHRONIZATION_SOURCE = 0x02,
  MAX_BIT_RATE = 0x03,
  RTCP_SEND_INTERVAL = 0x04,
  MAX_MTU = 0x05,
  COMFORT_NOISE_PAYLOAD_TYPE = 0x06
}

export enum AudioTypes {
  CODEC = 0x01,
  CODEC_PARAM = 0x02,
  RTP_PARAM = 0x03,
  COMFORT_NOISE = 0x04
}

export enum AudioCodecTypes {
  PCMU = 0x00,
  PCMA = 0x01,
  AACELD = 0x02,
  OPUS = 0x03
}

export enum AudioCodecParamTypes {
  CHANNEL = 0x01,
  BIT_RATE = 0x02,
  SAMPLE_RATE = 0x03,
  PACKET_TIME = 0x04
}

export enum AudioCodecParamBitRateTypes {
  VARIABLE = 0x00,
  CONSTANT = 0x01
}

export enum AudioCodecParamSampleRateTypes {
  KHZ_8 = 0x00,
  KHZ_16 = 0x01,
  KHZ_24 = 0x02
}

export type StreamControllerOptions = {
  proxy: boolean;
  disable_audio_proxy: boolean;
  srtp: boolean;
  audio: StreamAudioParams;
  video: StreamVideoParams;
}

export type HandleSetupReadCallback = NodeCallback<string | undefined>;
export type HandleSetupWriteCallback = () => any;
export type HandleStartStreamCallback = VoidCallback;

export enum StreamRequestTypes {
  RECONFIGURE = 'reconfigure',
  START = 'start',
  STOP = 'stop',
}

export type StreamRequest = {
  sessionID: SessionIdentifier;
  type: StreamRequestTypes;
  video?: VideoInfo;
  audio?: AudioInfo;
}

export type StartStreamRequest = {
  sessionID: SessionIdentifier;
  type: StreamRequestTypes.START;
  audio: AudioInfo;
  video: VideoInfo;
}

export type ReconfigureStreamRequest = {
  sessionID: SessionIdentifier;
  type: StreamRequestTypes.RECONFIGURE;
  audio: AudioInfo;
  video: VideoInfo;
}

export type StopStreamRequest = {
  sessionID: SessionIdentifier;
  type: StreamRequestTypes.STOP;
}

export type PrepareStreamRequest = {
  sessionID: SessionIdentifier;
  targetAddress: string;
  audio: Source;
  video: Source;
}

export type PreparedStreamRequestCallback = (response: PreparedStreamResponse) => void;

export type SourceResponse = {
  ssrc: number;
  proxy_pt: string;
  proxy_server_address: string;
  proxy_server_rtp: number;
  proxy_server_rtcp: number;
}
export type PreparedStreamResponse = {
  address: Address;
  audio: Source & Partial<SourceResponse>;
  video: Source & Partial<SourceResponse>;
}

export class StreamController {

  static SetupTypes = SetupTypes;
  static SetupStatus = SetupStatus;
  static SetupAddressVer = SetupAddressVer;
  static SetupAddressInfo = SetupAddressInfo;
  static SetupSRTP_PARAM = SetupSRTP_PARAM;
  static StreamingStatus = StreamingStatus;
  static RTPConfigTypes = RTPConfigTypes;
  static SRTPCryptoSuites = SRTPCryptoSuites;
  static VideoTypes = VideoTypes;
  static VideoCodecTypes = VideoCodecTypes;
  static VideoCodecParamTypes = VideoCodecParamTypes;
  static VideoCodecParamCVOTypes = VideoCodecParamCVOTypes;
  static VideoCodecParamProfileIDTypes = VideoCodecParamProfileIDTypes;
  static VideoCodecParamLevelTypes = VideoCodecParamLevelTypes;
  static VideoCodecParamPacketizationModeTypes = VideoCodecParamPacketizationModeTypes;
  static VideoAttributesTypes = VideoAttributesTypes;
  static SelectedStreamConfigurationTypes = SelectedStreamConfigurationTypes;
  static RTPParamTypes = RTPParamTypes;
  static AudioTypes = AudioTypes;
  static AudioCodecTypes = AudioCodecTypes;
  static AudioCodecParamTypes = AudioCodecParamTypes;
  static AudioCodecParamBitRateTypes = AudioCodecParamBitRateTypes;
  static AudioCodecParamSampleRateTypes = AudioCodecParamSampleRateTypes;

  requireProxy: boolean;
  disableAudioProxy: boolean;
  supportSRTP: boolean;
  supportedRTPConfiguration: string;
  supportedVideoStreamConfiguration: string;
  supportedAudioStreamConfiguration: string;
  selectedConfiguration: null;
  sessionIdentifier: Nullable<SessionIdentifier>;
  streamStatus: StreamingStatus;
  videoOnly: boolean;
  connectionID?: string;

  service?: Service;
  setupResponse?: string;

  audioProxy: any;
  videoProxy: any;

  constructor(
    public identifier: any,
    public options: StreamControllerOptions,
    public cameraSource?: Camera
  ) {
    if (identifier === undefined) {
      throw new Error('Identifier cannot be undefined');
    }

    if (!options) {
      throw new Error('Options cannot be undefined');
    }

    if (!cameraSource) {
      throw new Error('CameraSource cannot be undefined');
    }

    this.identifier = identifier;
    this.cameraSource = cameraSource;

    this.requireProxy = options["proxy"] || false;
    this.disableAudioProxy = options["disable_audio_proxy"] || false;

    this.supportSRTP = options["srtp"] || false;

    this.supportedRTPConfiguration = this._supportedRTPConfiguration(this.supportSRTP);

    let videoParams = options["video"];
    if (!videoParams) {
      throw new Error('Video parameters cannot be undefined in options');
    }

    this.supportedVideoStreamConfiguration = this._supportedVideoStreamConfiguration(videoParams);

    let audioParams = options["audio"];
    if (!audioParams) {
      throw new Error('Audio parameters cannot be undefined in options');
    }

    this.supportedAudioStreamConfiguration = this._supportedAudioStreamConfiguration(audioParams);

    this.selectedConfiguration = null;
    this.sessionIdentifier = null;
    this.streamStatus = StreamingStatus.AVAILABLE;
    this.videoOnly = false;

    this._createService();
  }

  forceStop = () => {
    this.connectionID = undefined;
    this._handleStopStream(undefined, true);
  }

  handleCloseConnection = (connectionID: string) => {
    if (this.connectionID && this.connectionID == connectionID) {
      this.connectionID = undefined;
      this._handleStopStream();
    }
  }

// Private
  _createService = () => {
    var managementService = new Service.CameraRTPStreamManagement('', this.identifier.toString());

    managementService
      .getCharacteristic(Characteristic.StreamingStatus)!
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        var data = tlv.encode( 0x01, this.streamStatus );
        callback(null, data.toString('base64'));
      }).getValue();

    managementService
      .getCharacteristic(Characteristic.SupportedRTPConfiguration)!
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, this.supportedRTPConfiguration);
      }).getValue();

    managementService
      .getCharacteristic(Characteristic.SupportedVideoStreamConfiguration)!
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, this.supportedVideoStreamConfiguration);
      }).getValue();

    managementService
      .getCharacteristic(Characteristic.SupportedAudioStreamConfiguration)!
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, this.supportedAudioStreamConfiguration);
      }).getValue();

    managementService
      .getCharacteristic(Characteristic.SelectedRTPStreamConfiguration)!
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        debug('Read SelectedStreamConfiguration');
        callback(null, this.selectedConfiguration);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context?: any, connectionID?: string) => {
        debug('Write SelectedStreamConfiguration');
        this._handleSelectedStreamConfigurationWrite(value, callback, connectionID!);
      });

    managementService
      .getCharacteristic(Characteristic.SetupEndpoints)!
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this._handleSetupRead(callback);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this._handleSetupWrite(value, callback);
      });

    this.service = managementService;
  }

  _handleSelectedStreamConfigurationWrite = (value: any, callback: any, connectionID: string) => {
    this.selectedConfiguration = value;

    var data = Buffer.from(value, 'base64');
    var objects = tlv.decode(data);

    var session;

    if(objects[SelectedStreamConfigurationTypes.SESSION]) {
      session = tlv.decode(objects[SelectedStreamConfigurationTypes.SESSION]);
      this.sessionIdentifier = session[0x01];

      let requestType = session[0x02][0];
      if (requestType == 1) {
        if (this.connectionID && this.connectionID != connectionID) {
          debug("Received start stream request from a different connection.");
        } else {
          this.connectionID = connectionID;
        }

        this._handleStartStream(objects, session, false, callback);
      } else if (requestType == 0) {
        if (this.connectionID && this.connectionID != connectionID) {
          debug("Received stop stream request from a different connection.")
        } else {
          this.connectionID = undefined;
        }

        this._handleStopStream(callback);
      } else if (requestType == 4) {
        this._handleStartStream(objects, session, true, callback);
      } else {
        debug("Unhandled request type: ", requestType);
        callback();
      }
    } else {
      debug("Unexpected request for Selected Stream Configuration");
      callback();
    }
  }

  _handleStartStream = (objects: Record<number, Buffer>, session: any, reconfigure: boolean = false, callback: HandleStartStreamCallback) => {

    var request: Partial<StartStreamRequest | ReconfigureStreamRequest> = {
      sessionID: this.sessionIdentifier!,
      type: !reconfigure ? StreamRequestTypes.START : StreamRequestTypes.RECONFIGURE
    };

    let videoPT = null;
    let audioPT = null;

    if(objects[SelectedStreamConfigurationTypes.VIDEO]) {
      var videoInfo: Partial<VideoInfo> = {};

      var video = tlv.decode(objects[SelectedStreamConfigurationTypes.VIDEO]);
      var codec = video[VideoTypes.CODEC];

      if (video[VideoTypes.CODEC_PARAM]) {
        var videoCodecParamsTLV = tlv.decode(video[VideoTypes.CODEC_PARAM]);
        videoInfo["profile"] = videoCodecParamsTLV[VideoCodecParamTypes.PROFILE_ID].readUInt8(0);
        videoInfo["level"] = videoCodecParamsTLV[VideoCodecParamTypes.LEVEL].readUInt8(0);
      }

      if (video[VideoTypes.ATTRIBUTES]) {
        var videoAttrTLV = tlv.decode(video[VideoTypes.ATTRIBUTES]);

        videoInfo["width"] = videoAttrTLV[VideoAttributesTypes.IMAGE_WIDTH].readUInt16LE(0);
        videoInfo["height"] = videoAttrTLV[VideoAttributesTypes.IMAGE_HEIGHT].readUInt16LE(0);
        videoInfo["fps"] = videoAttrTLV[VideoAttributesTypes.FRAME_RATE].readUInt8(0);
      }

      if (video[VideoTypes.RTP_PARAM]) {
        var videoRTPParamsTLV = tlv.decode(video[VideoTypes.RTP_PARAM]);

        if (videoRTPParamsTLV[RTPParamTypes.SYNCHRONIZATION_SOURCE]) {
          videoInfo["ssrc"] = videoRTPParamsTLV[RTPParamTypes.SYNCHRONIZATION_SOURCE].readUInt32LE(0);
        }

        if (videoRTPParamsTLV[RTPParamTypes.PAYLOAD_TYPE]) {
          videoPT = videoRTPParamsTLV[RTPParamTypes.PAYLOAD_TYPE].readUInt8(0);
          videoInfo["pt"] = videoPT;
        }

        if (videoRTPParamsTLV[RTPParamTypes.MAX_BIT_RATE]) {
          videoInfo["max_bit_rate"] = videoRTPParamsTLV[RTPParamTypes.MAX_BIT_RATE].readUInt16LE(0);
        }

        if (videoRTPParamsTLV[RTPParamTypes.RTCP_SEND_INTERVAL]) {
          videoInfo["rtcp_interval"] = videoRTPParamsTLV[RTPParamTypes.RTCP_SEND_INTERVAL].readUInt32LE(0);
        }

        if (videoRTPParamsTLV[RTPParamTypes.MAX_MTU]) {
          videoInfo["mtu"] = videoRTPParamsTLV[RTPParamTypes.MAX_MTU].readUInt16LE(0);
        }
      }

      request["video"] = videoInfo as VideoInfo;
    }

    if(objects[SelectedStreamConfigurationTypes.AUDIO]) {
      var audioInfo: Partial<AudioInfo> = {};

      var audio = tlv.decode(objects[SelectedStreamConfigurationTypes.AUDIO]);

      var codec = audio[AudioTypes.CODEC];
      var audioCodecParamsTLV = tlv.decode(audio[AudioTypes.CODEC_PARAM]);
      var audioRTPParamsTLV = tlv.decode(audio[AudioTypes.RTP_PARAM]);
      var comfortNoise = tlv.decode(audio[AudioTypes.COMFORT_NOISE]);

      let audioCodec = codec.readUInt8(0);
      if (audioCodec !== undefined) {
        if (audioCodec == AudioCodecTypes.OPUS) {
          audioInfo["codec"] = "OPUS";
        } else if (audioCodec == AudioCodecTypes.AACELD) {
          audioInfo["codec"] = "AAC-eld";
        } else {
          debug("Unexpected audio codec: %s", audioCodec);
          audioInfo["codec"] = audioCodec;
        }
      }

      audioInfo["channel"] = audioCodecParamsTLV[AudioCodecParamTypes.CHANNEL].readUInt8(0);
      audioInfo["bit_rate"] = audioCodecParamsTLV[AudioCodecParamTypes.BIT_RATE].readUInt8(0);

      let sample_rate_enum = audioCodecParamsTLV[AudioCodecParamTypes.SAMPLE_RATE].readUInt8(0);
      if (sample_rate_enum !== undefined) {
        if (sample_rate_enum == AudioCodecParamSampleRateTypes.KHZ_8) {
          audioInfo["sample_rate"] = 8;
        } else if (sample_rate_enum == AudioCodecParamSampleRateTypes.KHZ_16) {
          audioInfo["sample_rate"] = 16;
        } else if (sample_rate_enum == AudioCodecParamSampleRateTypes.KHZ_24) {
          audioInfo["sample_rate"] = 24;
        } else {
          debug("Unexpected audio sample rate: %s", sample_rate_enum);
        }
      }

      audioInfo["packet_time"] = audioCodecParamsTLV[AudioCodecParamTypes.PACKET_TIME].readUInt8(0);

      var ssrc = audioRTPParamsTLV[RTPParamTypes.SYNCHRONIZATION_SOURCE].readUInt32LE(0);
      audioPT = audioRTPParamsTLV[RTPParamTypes.PAYLOAD_TYPE].readUInt8(0);

      audioInfo["pt"] = audioPT;
      audioInfo["ssrc"] = ssrc;
      audioInfo["max_bit_rate"] = audioRTPParamsTLV[RTPParamTypes.MAX_BIT_RATE].readUInt16LE(0);
      audioInfo["rtcp_interval"] = audioRTPParamsTLV[RTPParamTypes.RTCP_SEND_INTERVAL].readUInt32LE(0);
      audioInfo["comfort_pt"] = audioRTPParamsTLV[RTPParamTypes.COMFORT_NOISE_PAYLOAD_TYPE].readUInt8(0);

      request["audio"] = audioInfo as AudioInfo;
    }

    if (!reconfigure && this.requireProxy) {
      this.videoProxy.setOutgoingPayloadType(videoPT);
      if (!this.disableAudioProxy) {
        this.audioProxy.setOutgoingPayloadType(audioPT);
      }
    }

    this.cameraSource && this.cameraSource.handleStreamRequest(request as StreamRequest);

    this._updateStreamStatus(StreamingStatus.STREAMING);
    callback();
  }

  _handleStopStream = (callback?: VoidCallback, silent: boolean = false) => {

    let request: Partial<StopStreamRequest> = {
      "sessionID": this.sessionIdentifier!,
      "type": StreamRequestTypes.STOP,
    };

    if (!silent) {
      this.cameraSource && this.cameraSource.handleStreamRequest(request as StopStreamRequest);
    }

    if (this.requireProxy) {
      this.videoProxy.destroy();
      if (!this.disableAudioProxy) {
        this.audioProxy.destroy();
      }

      this.videoProxy = undefined;
      this.audioProxy = undefined;
    }

    this._updateStreamStatus(StreamingStatus.AVAILABLE);

    if (callback) {
      callback();
    }
  }

  _handleSetupWrite = (value: CharacteristicValue, callback: HandleSetupWriteCallback) => {

    var data = Buffer.from(`${value}`, 'base64');
    var objects = tlv.decode(data) as any;

    this.sessionIdentifier = objects[SetupTypes.SESSION_ID];

    // Address
    var targetAddressPayload = objects[SetupTypes.ADDRESS];
    var processedAddressInfo = tlv.decode(targetAddressPayload) as any;
    var isIPv6 = processedAddressInfo[SetupAddressInfo.ADDRESS_VER][0];
    var targetAddress = processedAddressInfo[SetupAddressInfo.ADDRESS].toString('utf8');
    var targetVideoPort = processedAddressInfo[SetupAddressInfo.VIDEO_RTP_PORT].readUInt16LE(0);
    var targetAudioPort = processedAddressInfo[SetupAddressInfo.AUDIO_RTP_PORT].readUInt16LE(0);

    // Video SRTP Params
    var videoSRTPPayload = objects[SetupTypes.VIDEO_SRTP_PARAM];
    var processedVideoInfo = tlv.decode(videoSRTPPayload) as any;
    var videoCryptoSuite = processedVideoInfo[SetupSRTP_PARAM.CRYPTO][0];
    var videoMasterKey = processedVideoInfo[SetupSRTP_PARAM.MASTER_KEY];
    var videoMasterSalt = processedVideoInfo[SetupSRTP_PARAM.MASTER_SALT];

    // Audio SRTP Params
    var audioSRTPPayload = objects[SetupTypes.AUDIO_SRTP_PARAM];
    var processedAudioInfo = tlv.decode(audioSRTPPayload) as any;
    var audioCryptoSuite = processedAudioInfo[SetupSRTP_PARAM.CRYPTO][0];
    var audioMasterKey = processedAudioInfo[SetupSRTP_PARAM.MASTER_KEY];
    var audioMasterSalt = processedAudioInfo[SetupSRTP_PARAM.MASTER_SALT];

    debug(
      '\nSession: ', this.sessionIdentifier,
      '\nControllerAddress: ', targetAddress,
      '\nVideoPort: ', targetVideoPort,
      '\nAudioPort: ', targetAudioPort,
      '\nVideo Crypto: ', videoCryptoSuite,
      '\nVideo Master Key: ', videoMasterKey,
      '\nVideo Master Salt: ', videoMasterSalt,
      '\nAudio Crypto: ', audioCryptoSuite,
      '\nAudio Master Key: ', audioMasterKey,
      '\nAudio Master Salt: ', audioMasterSalt
    );

    var request: Partial<PrepareStreamRequest> = {
      "sessionID": this.sessionIdentifier!,
    };

    var videoInfo: Partial<Source> = {};

    var audioInfo: Partial<Source> = {};

    if (this.supportSRTP) {
      videoInfo["srtp_key"] = videoMasterKey;
      videoInfo["srtp_salt"] = videoMasterSalt;

      audioInfo["srtp_key"] = audioMasterKey;
      audioInfo["srtp_salt"] = audioMasterSalt;
    }

    if (!this.requireProxy) {
      request["targetAddress"] = targetAddress;

      videoInfo["port"] = targetVideoPort;
      audioInfo["port"] = targetAudioPort;

      request["video"] = videoInfo as Source;
      request["audio"] = audioInfo as Source;

      this.cameraSource && this.cameraSource.prepareStream(request as PrepareStreamRequest, (response: PreparedStreamResponse) => {
        this._generateSetupResponse(this.sessionIdentifier!, response, callback);
      });
    } else {
      request["targetAddress"] = ip.address();
      var promises = [];

      var videoSSRCNumber = crypto.randomBytes(4).readUInt32LE(0);
      this.videoProxy = new RTPProxy({
        outgoingAddress: targetAddress,
        outgoingPort: targetVideoPort,
        outgoingSSRC: videoSSRCNumber,
        disabled: false
      });

      promises.push(this.videoProxy.setup());

      if (!this.disableAudioProxy) {
        var audioSSRCNumber = crypto.randomBytes(4).readUInt32LE(0);

        this.audioProxy = new RTPProxy({
          outgoingAddress: targetAddress,
          outgoingPort: targetAudioPort,
          outgoingSSRC: audioSSRCNumber,
          disabled: this.videoOnly
        });

        promises.push(this.audioProxy.setup());
      } else {
        audioInfo["port"] = targetAudioPort;
        audioInfo["targetAddress"] = targetAddress;
      }

      Promise.all(promises).then(() => {
        videoInfo["proxy_rtp"] = this.videoProxy.incomingRTPPort();
        videoInfo["proxy_rtcp"] = this.videoProxy.incomingRTCPPort();

        if (!this.disableAudioProxy) {
          audioInfo["proxy_rtp"] = this.audioProxy.incomingRTPPort();
          audioInfo["proxy_rtcp"] = this.audioProxy.incomingRTCPPort();
        }

        request["video"] = videoInfo as Source;
        request["audio"] = audioInfo as Source;

        this.cameraSource && this.cameraSource.prepareStream(request as PrepareStreamRequest, (response: PreparedStreamResponse) => {
          this._generateSetupResponse(this.sessionIdentifier!, response, callback);
        });
      });
    }
  }

  _generateSetupResponse = (identifier: SessionIdentifier, response: PreparedStreamResponse, callback: VoidCallback) => {

    let ipVer = 0;
    let ipAddress = null;
    const videoPort = Buffer.alloc(2);
    const audioPort = Buffer.alloc(2);

    const videoSSRC = Buffer.alloc(4);
    const audioSSRC = Buffer.alloc(4);

    let videoSRTP = Buffer.from([0x01, 0x01, 0x02, 0x02, 0x00, 0x03, 0x00]);
    let audioSRTP = Buffer.from([0x01, 0x01, 0x02, 0x02, 0x00, 0x03, 0x00]);

    if (this.requireProxy) {
      let currentAddress = ip.address();

      ipVer = 1;

      if (ip.isV4Format(currentAddress)) {
        ipVer = 0;
      }

      ipAddress = Buffer.from(currentAddress);
      videoPort.writeUInt16LE(this.videoProxy.outgoingLocalPort(), 0);

      if (!this.disableAudioProxy) {
        audioPort.writeUInt16LE(this.audioProxy.outgoingLocalPort(), 0);
      }

      let videoInfo = response["video"];

      let video_pt = videoInfo["proxy_pt"];
      let video_serverAddr = videoInfo["proxy_server_address"];
      let video_serverRTP = videoInfo["proxy_server_rtp"];
      let video_serverRTCP = videoInfo["proxy_server_rtcp"];

      this.videoProxy.setIncomingPayloadType(video_pt);
      this.videoProxy.setServerAddress(video_serverAddr);
      this.videoProxy.setServerRTPPort(video_serverRTP);
      this.videoProxy.setServerRTCPPort(video_serverRTCP);

      videoSSRC.writeUInt32LE(this.videoProxy.outgoingSSRC, 0);

      let audioInfo = response["audio"];

      if (!this.disableAudioProxy) {
        let audio_pt = audioInfo["proxy_pt"];
        let audio_serverAddr = audioInfo["proxy_server_address"];
        let audio_serverRTP = audioInfo["proxy_server_rtp"];
        let audio_serverRTCP = audioInfo["proxy_server_rtcp"];

        this.audioProxy.setIncomingPayloadType(audio_pt);
        this.audioProxy.setServerAddress(audio_serverAddr);
        this.audioProxy.setServerRTPPort(audio_serverRTP);
        this.audioProxy.setServerRTCPPort(audio_serverRTCP);

        audioSSRC.writeUInt32LE(this.audioProxy.outgoingSSRC, 0);
      } else {
        audioPort.writeUInt16LE(audioInfo["port"], 0);
        audioSSRC.writeUInt32LE(audioInfo["ssrc"]!, 0);
      }

    } else {
      let addressInfo = response["address"];

      if (addressInfo["type"] == "v6") {
        ipVer = 1;
      } else {
        ipVer = 0;
      }

      ipAddress = addressInfo["address"];

      let videoInfo = response["video"];
      videoPort.writeUInt16LE(videoInfo["port"], 0);
      videoSSRC.writeUInt32LE(videoInfo["ssrc"]!, 0);

      let audioInfo = response["audio"];
      audioPort.writeUInt16LE(audioInfo["port"], 0);
      audioSSRC.writeUInt32LE(audioInfo["ssrc"]!, 0);

      if (this.supportSRTP) {
        let videoKey = videoInfo["srtp_key"];
        let videoSalt = videoInfo["srtp_salt"];

        let audioKey = audioInfo["srtp_key"];
        let audioSalt = audioInfo["srtp_salt"];

        videoSRTP = tlv.encode(
          SetupSRTP_PARAM.CRYPTO, SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80,
          SetupSRTP_PARAM.MASTER_KEY, videoKey,
          SetupSRTP_PARAM.MASTER_SALT, videoSalt
        );

        audioSRTP = tlv.encode(
          SetupSRTP_PARAM.CRYPTO, SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80,
          SetupSRTP_PARAM.MASTER_KEY, audioKey,
          SetupSRTP_PARAM.MASTER_SALT, audioSalt
        );
      }
    }

    var addressTLV = tlv.encode(
      SetupAddressInfo.ADDRESS_VER, ipVer,
      SetupAddressInfo.ADDRESS, ipAddress,
      SetupAddressInfo.VIDEO_RTP_PORT, videoPort,
      SetupAddressInfo.AUDIO_RTP_PORT, audioPort
    );

    var responseTLV = tlv.encode(
      SetupTypes.SESSION_ID, identifier,
      SetupTypes.STATUS, SetupStatus.SUCCESS,
      SetupTypes.ADDRESS, addressTLV,
      SetupTypes.VIDEO_SRTP_PARAM, videoSRTP,
      SetupTypes.AUDIO_SRTP_PARAM, audioSRTP,
      SetupTypes.VIDEO_SSRC, videoSSRC,
      SetupTypes.AUDIO_SSRC, audioSSRC
    );

    this.setupResponse = responseTLV.toString('base64');
    callback();
  }

  _updateStreamStatus = (status: number) => {

    this.streamStatus = status;

    this.service && this.service
      .getCharacteristic(Characteristic.StreamingStatus)!
      .setValue(tlv.encode( 0x01, this.streamStatus ).toString('base64'));
  }

  _handleSetupRead = (callback: HandleSetupReadCallback) => {
    debug('Setup Read');
    callback(null, this.setupResponse);
  }

  _supportedRTPConfiguration = (supportSRTP: boolean) => {
    var cryptoSuite = SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80;

    if (!supportSRTP) {
      cryptoSuite = SRTPCryptoSuites.NONE;
      debug("Client claims it doesn't support SRTP. The stream may stops working with future iOS releases.");
    }

    return tlv.encode(
      RTPConfigTypes.CRYPTO, cryptoSuite
    ).toString('base64');
  }

  _supportedVideoStreamConfiguration = (videoParams: StreamVideoParams) => {

    let codec = videoParams["codec"];
    if (!codec) {
      throw new Error('Video codec cannot be undefined');
    }

    var videoCodecParamsTLV = tlv.encode(
      VideoCodecParamTypes.PACKETIZATION_MODE, VideoCodecParamPacketizationModeTypes.NON_INTERLEAVED
    );

    let profiles = codec["profiles"];
    profiles.forEach(function(value) {
      let tlvBuffer = tlv.encode(VideoCodecParamTypes.PROFILE_ID, value);
      videoCodecParamsTLV = Buffer.concat([videoCodecParamsTLV, tlvBuffer]);
    });

    let levels = codec["levels"];
    levels.forEach(function(value) {
      let tlvBuffer = tlv.encode(VideoCodecParamTypes.LEVEL, value);
      videoCodecParamsTLV = Buffer.concat([videoCodecParamsTLV, tlvBuffer]);
    });

    let resolutions = videoParams["resolutions"];
    if (!resolutions) {
      throw new Error('Video resolutions cannot be undefined');
    }

    var videoAttrsTLV = Buffer.alloc(0);
    resolutions.forEach(function(resolution) {
      if (resolution.length != 3) {
        throw new Error('Unexpected video resolution');
      }

      var imageWidth = Buffer.alloc(2);
      imageWidth.writeUInt16LE(resolution[0], 0);
      var imageHeight = Buffer.alloc(2);
      imageHeight.writeUInt16LE(resolution[1], 0);
      var frameRate = Buffer.alloc(1);
      frameRate.writeUInt8(resolution[2], 0);

      var videoAttrTLV = tlv.encode(
        VideoAttributesTypes.IMAGE_WIDTH, imageWidth,
        VideoAttributesTypes.IMAGE_HEIGHT, imageHeight,
        VideoAttributesTypes.FRAME_RATE, frameRate
      );
      var videoAttrBuffer = tlv.encode(VideoTypes.ATTRIBUTES, videoAttrTLV);
      videoAttrsTLV = Buffer.concat([videoAttrsTLV, videoAttrBuffer]);
    });

    var configurationTLV = tlv.encode(
      VideoTypes.CODEC, VideoCodecTypes.H264,
      VideoTypes.CODEC_PARAM, videoCodecParamsTLV
    );

    return tlv.encode(
      0x01, Buffer.concat([configurationTLV, videoAttrsTLV])
    ).toString('base64');
  }

  _supportedAudioStreamConfiguration = (audioParams: StreamAudioParams) => {
    // Only AACELD and OPUS are accepted by iOS currently, and we need to give it something it will accept
    // for it to start the video stream.

    var comfortNoiseValue = 0x00;

    if (audioParams["comfort_noise"] === true) {
      comfortNoiseValue = 0x01;
    }

    let codecs = audioParams["codecs"];
    if (!codecs) {
      throw new Error('Audio codecs cannot be undefined');
    }

    var audioConfigurationsBuffer = Buffer.alloc(0);
    var hasSupportedCodec = false;

    codecs.forEach(function(codecParam){
      var codec = AudioCodecTypes.OPUS;
      var bitrate = AudioCodecParamBitRateTypes.CONSTANT;
      var samplerate = AudioCodecParamSampleRateTypes.KHZ_24;

      let param_type = codecParam["type"];
      let param_samplerate = codecParam["samplerate"];

      if (param_type == 'OPUS') {
        hasSupportedCodec = true;
        bitrate = AudioCodecParamBitRateTypes.VARIABLE;
      } else if (param_type == "AAC-eld") {
        hasSupportedCodec = true;
        codec = AudioCodecTypes.AACELD;
        bitrate = AudioCodecParamBitRateTypes.VARIABLE;
      } else {
        debug("Unsupported codec: ", param_type);
        return;
      }

      if (param_samplerate == 8) {
        samplerate = AudioCodecParamSampleRateTypes.KHZ_8;
      } else if (param_samplerate == 16) {
        samplerate = AudioCodecParamSampleRateTypes.KHZ_16;
      } else if (param_samplerate == 24) {
        samplerate = AudioCodecParamSampleRateTypes.KHZ_24;
      } else {
        debug("Unsupported sample rate: ", param_samplerate);
        return;
      }

      var audioParamTLV = tlv.encode(
        AudioCodecParamTypes.CHANNEL, 1,
        AudioCodecParamTypes.BIT_RATE, bitrate,
        AudioCodecParamTypes.SAMPLE_RATE, samplerate
      );

      var audioConfiguration = tlv.encode(
        AudioTypes.CODEC, codec,
        AudioTypes.CODEC_PARAM, audioParamTLV
      );

      audioConfigurationsBuffer = Buffer.concat([audioConfigurationsBuffer, tlv.encode(0x01, audioConfiguration)]);
    });

    // If we're not one of the supported codecs
    if(!hasSupportedCodec) {
      debug("Client doesn't support any audio codec that HomeKit supports.");

      var codec = AudioCodecTypes.OPUS;
      var bitrate = AudioCodecParamBitRateTypes.VARIABLE;
      var samplerate = AudioCodecParamSampleRateTypes.KHZ_24;

      var audioParamTLV = tlv.encode(
        AudioCodecParamTypes.CHANNEL, 1,
        AudioCodecParamTypes.BIT_RATE, bitrate,
        AudioCodecParamTypes.SAMPLE_RATE, AudioCodecParamSampleRateTypes.KHZ_24
      );


      var audioConfiguration = tlv.encode(
        AudioTypes.CODEC, codec,
        AudioTypes.CODEC_PARAM, audioParamTLV
      );

      audioConfigurationsBuffer = tlv.encode(0x01, audioConfiguration);

      this.videoOnly = true;
    }

    return Buffer.concat([audioConfigurationsBuffer, tlv.encode(0x02, comfortNoiseValue)]).toString('base64');
  }
}

