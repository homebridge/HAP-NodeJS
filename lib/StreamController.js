var debug = require('debug')('StreamController');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var clone = require('./util/clone').clone;
var uuid = require('./util/uuid');
var tlv = require("./util/tlv");
var Service = require('./Service').Service;
var Characteristic = require('./Characteristic').Characteristic;
var HomeKitTypes = require('./gen/HomeKitTypes');

var inspect = require('util').inspect;

var RTSPClient = require('./camera/RTSPClient');
var RTPProxy = require('./camera/RTPProxy');
var crypto = require('crypto');
var ip = require('ip');

'use strict';

module.exports = {
  StreamController: StreamController
};

function StreamController(identifier, uri, width, height, fps) {
  let self = this;

  self.identifier = identifier;
  self.selectedConfiguration = null;
  self.sessionIdentifier = null;
  self.streamStatus = StreamController.StreamingStatus.BUSY;
  self.videoOnly = false;

  self.width = width;
  self.height = height;
  self.fps = fps;

  self.rtspClient = new RTSPClient(uri);

  self.rtspClient.on('sdp', function() {
    self.supportedRTPConfiguration = self._supportedRTPConfiguration();
    self.supportedVideoStreamConfiguration = self._supportedVideoStreamConfiguration();
    self.supportedAudioStreamConfiguration = self._supportedAudioStreamConfiguration();

    self._updateStreamStatus(StreamController.StreamingStatus.AVAILABLE);
  });

  self.rtspClient.on('error', function(err) {
    console.log(err);
  });

  self._createService();
}

StreamController.SetupTypes = {
  SESSION_ID: 0x01,
  STATUS: 0x02,
  ADDRESS: 0x03,
  VIDEO_SRTP_PARAM: 0x04,
  AUDIO_SRTP_PARAM: 0x05,
  VIDEO_SSRC: 0x06,
  AUDIO_SSRC: 0x07
}

StreamController.SetupStatus = {
  SUCCESS: 0x00,
  BUSY: 0x01,
  ERROR: 0x02
}

StreamController.SetupAddressVer = {
  IPV4: 0x00,
  IPV6: 0x01
}

StreamController.SetupAddressInfo = {
  ADDRESS_VER: 0x01,
  ADDRESS: 0x02,
  VIDEO_RTP_PORT: 0x03,
  AUDIO_RTP_PORT: 0x04
}

StreamController.SetupSRTP_PARAM = {
  CRYPTO: 0x01,
  MASTER_KEY: 0x02,
  MASTER_SALT: 0x03
}

StreamController.StreamingStatus = {
  AVAILABLE: 0x00,
  STREAMING: 0x01,
  BUSY: 0x02
}

StreamController.RTPConfigTypes = {
  CRYPTO: 0x02
}

StreamController.SRTPCryptoSuites = {
  AES_CM_128_HMAC_SHA1_80: 0x00,
  AES_CM_256_HMAC_SHA1_80: 0x01,
  NONE: 0x02
}

StreamController.VideoTypes = {
  CODEC: 0x01,
  CODEC_PARAM: 0x02,
  ATTRIBUTES: 0x03,
  RTP_PARAM: 0x04
}

StreamController.VideoCodecTypes = {
  H264: 0x00
}

StreamController.VideoCodecParamTypes = {
  PROFILE_ID: 0x01,
  LEVEL: 0x02,
  PACKETIZATION_MODE: 0x03,
  CVO_ENABLED: 0x04,
  CVO_ID: 0x05
}

StreamController.VideoCodecParamCVOTypes = {
  UNSUPPORTED: 0x01,
  SUPPORTED: 0x02
}

StreamController.VideoCodecParamProfileIDTypes = {
  BASELINE: 0x00,
  MAIN: 0x01,
  HIGH: 0x02
}

StreamController.VideoCodecParamLevelTypes = {
  TYPE3_1: 0x00,
  TYPE3_2: 0x01,
  TYPE4_0: 0x02
}

StreamController.VideoCodecParamPacketizationModeTypes = {
  NON_INTERLEAVED: 0x00
}

StreamController.VideoAttributesTypes = {
  IMAGE_WIDTH: 0x01,
  IMAGE_HEIGHT: 0x02,
  FRAME_RATE: 0x03
}

StreamController.SelectedStreamConfigurationTypes = {
  SESSION: 0x01,
  VIDEO: 0x02,
  AUDIO: 0x03
}

StreamController.RTPParamTypes = {
  PAYLOAD_TYPE: 0x01,
  SYNCHRONIZATION_SOURCE: 0x02,
  MAX_BIT_RATE: 0x03,
  RTCP_SEND_INTERVAL: 0x04,
  MAX_MTU: 0x05,
  COMFORT_NOISE_PAYLOAD_TYPE: 0x06
}

StreamController.AudioTypes = {
  CODEC: 0x01,
  CODEC_PARAM: 0x02,
  RTP_PARAM: 0x03,
  COMFORT_NOISE: 0x04
}

StreamController.AudioCodecTypes = {
  PCMU: 0x00,
  PCMA: 0x01,
  AACELD: 0x02,
  OPUS: 0x03
}

StreamController.AudioCodecParamTypes = {
  CHANNEL: 0x01,
  BIT_RATE: 0x02,
  SAMPLE_RATE: 0x03,
  PACKET_TIME: 0x04
}

StreamController.AudioCodecParamBitRateTypes = {
  VARIABLE: 0x00,
  CONSTANT: 0x01
}

StreamController.AudioCodecParamSampleRateTypes = {
  KHZ_8: 0x00,
  KHZ_16: 0x01,
  KHZ_24: 0x02
}


// Private

StreamController.prototype._createService = function() {
  var self = this;
  var managementService = new Service.CameraRTPStreamManagement(undefined, this.identifier.toString());

  managementService
    .getCharacteristic(Characteristic.StreamingStatus)
    .on('get', function(callback) {
      var data = tlv.encode( 0x01, self.streamStatus );
      callback(null, data.toString('base64'));
    });

  managementService
    .getCharacteristic(Characteristic.SupportedRTPConfiguration)
    .on('get', function(callback) {
      callback(null, self.supportedRTPConfiguration);
    });

  managementService
    .getCharacteristic(Characteristic.SupportedVideoStreamConfiguration)
    .on('get', function(callback) {
      callback(null, self.supportedVideoStreamConfiguration);
    });

  managementService
    .getCharacteristic(Characteristic.SupportedAudioStreamConfiguration)
    .on('get', function(callback) {
      callback(null, self.supportedAudioStreamConfiguration);
    });

  managementService
    .getCharacteristic(Characteristic.SelectedStreamConfiguration)
    .on('get', function(callback) {
      debug('Read SelectedStreamConfiguration');
      callback(null, self.selectedConfiguration);
    })
    .on('set',function(value, callback) {
      debug('Write SelectedStreamConfiguration');
      self._handleSelectedStreamConfigurationWrite(value, callback);
    });

  managementService
    .getCharacteristic(Characteristic.SetupEndpoints)
    .on('get', function(callback) {
      self._handleSetupRead(callback);
    })
    .on('set', function(value, callback) {
      self._handleSetupWrite(value, callback);
    });

  this.service = managementService;
}

StreamController.prototype._updateStreamStatus = function(status) {
  var self = this;

  self.streamStatus = status;

  var managementService = new Service.CameraRTPStreamManagement(undefined, self.identifier.toString());
  managementService
    .getCharacteristic(Characteristic.StreamingStatus)
    .setValue(tlv.encode( 0x01, self.streamStatus ).toString('base64'));
}

StreamController.prototype._handleSelectedStreamConfigurationWrite = function(value, callback) {
  var self = this;
  self.selectedConfiguration = value;

  var data = Buffer.from(value, 'base64');
  var objects = tlv.decode(data);

  var session;
  var video;
  var audio;

  debug(inspect(objects, false, null));

  if(objects[StreamController.SelectedStreamConfigurationTypes.SESSION]) {
    session = tlv.decode(objects[StreamController.SelectedStreamConfigurationTypes.SESSION]);
    debug(inspect(session, false, null));
  }

  let videoPT = null;
  let audioPT = null;

  if(objects[StreamController.SelectedStreamConfigurationTypes.VIDEO]) {
    video = tlv.decode(objects[StreamController.SelectedStreamConfigurationTypes.VIDEO]);
    var codec = video[StreamController.VideoTypes.CODEC];
    var videoCodecParamsTLV = tlv.decode(video[StreamController.VideoTypes.CODEC_PARAM]);
    var videoAttrTLV = tlv.decode(video[StreamController.VideoTypes.ATTRIBUTES]);
    var videoRTPParamsTLV = tlv.decode(video[StreamController.VideoTypes.RTP_PARAM]);

    console.log('codec:');
    debug(inspect(codec, false, null));
    console.log('codec params:');
    debug(inspect(videoCodecParamsTLV, false, null));
    console.log('attr:');
    debug(inspect(videoAttrTLV, false, null));
    console.log('rtp params:');
    debug(inspect(videoRTPParamsTLV, false, null));

    var ssrc = videoRTPParamsTLV[StreamController.RTPParamTypes.SYNCHRONIZATION_SOURCE].readUInt32LE(0);
    console.log('ssrc:', ssrc);

    videoPT = videoRTPParamsTLV[StreamController.RTPParamTypes.PAYLOAD_TYPE].readUInt8(0);
  }

  if(objects[StreamController.SelectedStreamConfigurationTypes.AUDIO]) {
    audio = tlv.decode(objects[StreamController.SelectedStreamConfigurationTypes.AUDIO]);

    var codec = audio[StreamController.AudioTypes.CODEC];
    var audioCodecParamsTLV = tlv.decode(audio[StreamController.AudioTypes.CODEC_PARAM]);
    var audioRTPParamsTLV = tlv.decode(audio[StreamController.AudioTypes.RTP_PARAM]);
    var comfortNoise = tlv.decode(audio[StreamController.AudioTypes.COMFORT_NOISE]);

    console.log('audio codec:');
    debug(inspect(codec, false, null));
    console.log('audio codec params:');
    debug(inspect(audioCodecParamsTLV, false, null));
    console.log('audio rtp params:');
    debug(inspect(audioRTPParamsTLV, false, null));
    console.log('comfort noise:');
    debug(inspect(comfortNoise, false, null));

    audioPT = audioRTPParamsTLV[StreamController.RTPParamTypes.PAYLOAD_TYPE].readUInt8(0);
  }

  if(!videoPT && !audioPT) {
    self.rtspClient.teardown();
    self._updateStreamStatus(StreamController.StreamingStatus.AVAILABLE);
  } else {
    console.log("ports", self.targetVideoPort, self.targetAudioPort);

    console.log("pt", videoPT, audioPT);
    self.videoProxy.setOutgoingPayloadType(videoPT);
    self.audioProxy.setOutgoingPayloadType(audioPT);

    self.rtspClient.play();
    self._updateStreamStatus(StreamController.StreamingStatus.STREAMING);
  }

  callback();
}

StreamController.prototype._handleSetupWrite = function(value, callback) {
  var data = Buffer.from(value, 'base64');
  var objects = tlv.decode(data);

  // Identifier
  this.sessionIdentifier = objects[StreamController.SetupTypes.SESSION_ID];

  // Address
  var targetAddressPayload = objects[StreamController.SetupTypes.ADDRESS];
  var processedAddressInfo = tlv.decode(targetAddressPayload);
  var isIPv6 = processedAddressInfo[StreamController.SetupAddressInfo.ADDRESS_VER][0];
  var targetAddress = processedAddressInfo[StreamController.SetupAddressInfo.ADDRESS].toString('utf8');
  var targetVideoPort = processedAddressInfo[StreamController.SetupAddressInfo.VIDEO_RTP_PORT].readUInt16LE(0);
  var targetAudioPort = processedAddressInfo[StreamController.SetupAddressInfo.AUDIO_RTP_PORT].readUInt16LE(0);

  // Video SRTP Params
  var videoSRTPPayload = objects[StreamController.SetupTypes.VIDEO_SRTP_PARAM];
  var processedVideoInfo = tlv.decode(videoSRTPPayload);
  var videoCryptoSuite = processedVideoInfo[StreamController.SetupSRTP_PARAM.CRYPTO][0];
  var videoMasterKey = processedVideoInfo[StreamController.SetupSRTP_PARAM.MASTER_KEY];
  var videoMasterSalt = processedVideoInfo[StreamController.SetupSRTP_PARAM.MASTER_SALT];

  // Audio SRTP Params
  var audioSRTPPayload = objects[StreamController.SetupTypes.AUDIO_SRTP_PARAM];
  var processedAudioInfo = tlv.decode(audioSRTPPayload);
  var audioCryptoSuite = processedAudioInfo[StreamController.SetupSRTP_PARAM.CRYPTO][0];
  var audioMasterKey = processedAudioInfo[StreamController.SetupSRTP_PARAM.MASTER_KEY];
  var audioMasterSalt = processedAudioInfo[StreamController.SetupSRTP_PARAM.MASTER_SALT];

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

  this.targetVideoPort = targetVideoPort;
  this.targetAudioPort = targetAudioPort;
  this._generateSetupResponse(this.sessionIdentifier, videoSRTPPayload, audioSRTPPayload, targetAddress, targetVideoPort, targetAudioPort, callback);
}

StreamController.prototype._generateSetupResponse = function(identifier, videoSRTP, audioSRTP, targetAddress, targetVideoPort, targetAudioPort, callback) {
  // TODO: Properly setup SRTP Video/Audio ports
  var self = this;

  var videoSSRCNumber = crypto.randomBytes(4).readUInt32LE(0);
  var audioSSRCNumber = crypto.randomBytes(4).readUInt32LE(0);

  self.videoProxy = new RTPProxy({
    outgoingAddress: targetAddress,
    outgoingPort: targetVideoPort,
    incomingPayloadType: self.rtspClient.video.payload,
    outgoingSSRC: videoSSRCNumber,
    disabled: false
  });

  self.audioProxy = new RTPProxy({
    outgoingAddress: targetAddress,
    outgoingPort: targetAudioPort,
    incomingPayloadType: self.rtspClient.audio.payload,
    outgoingSSRC: audioSSRCNumber,
    disabled: self.videoOnly
  });

  var videoProxyPromise = self.videoProxy.setup();
  var audioProxyPromise = self.audioProxy.setup();

  Promise.all([self.videoProxy.setup(), self.audioProxy.setup()]).then(function() {
    self.rtspClient.setup(self.rtspClient.video.uri, self.videoProxy.incomingRTPPort(), self.videoProxy.incomingRTCPPort()).then(function(video) {
      self.rtspClient.setup(self.rtspClient.audio.uri, self.audioProxy.incomingRTPPort(), self.audioProxy.incomingRTCPPort()).then(function(audio) {
        self.videoProxy.setServerAddress(video.source);
        self.videoProxy.setServerRTPPort(video.rtpPort);
        self.videoProxy.setServerRTCPPort(video.rtcpPort);
        console.log('video', video.source, video.rtpPort, video.rtcpPort);

        self.audioProxy.setServerAddress(audio.source);
        self.audioProxy.setServerRTPPort(audio.rtpPort);
        self.audioProxy.setServerRTCPPort(audio.rtcpPort);
        console.log('audio', audio.source, audio.rtpPort, audio.rtcpPort);

        console.log('video-local', self.videoProxy.outgoingLocalPort());
        console.log('audio-local', self.audioProxy.outgoingLocalPort());

        var videoPort = new Buffer(2);
        videoPort.writeUInt16LE(self.videoProxy.outgoingLocalPort(), 0);

        var audioPort = new Buffer(2);
        audioPort.writeUInt16LE(self.audioProxy.outgoingLocalPort(), 0);

        var addressTLV = tlv.encode(
          StreamController.SetupAddressInfo.ADDRESS_VER, 0,
          StreamController.SetupAddressInfo.ADDRESS, Buffer.from(ip.address()),
          StreamController.SetupAddressInfo.VIDEO_RTP_PORT, videoPort,
          StreamController.SetupAddressInfo.AUDIO_RTP_PORT, audioPort
        );

        // TODO: properly get SSRC
        var videoSSRC = new Buffer(4);
        videoSSRC.writeUInt32LE(videoSSRCNumber, 0);
        var audioSSRC = new Buffer(4);
        audioSSRC.writeUInt32LE(audioSSRCNumber, 0);

        var responseTLV = tlv.encode(
          StreamController.SetupTypes.SESSION_ID, identifier,
          StreamController.SetupTypes.STATUS, StreamController.SetupStatus.SUCCESS,
          StreamController.SetupTypes.ADDRESS, addressTLV,
          StreamController.SetupTypes.VIDEO_SRTP_PARAM, videoSRTP,
          StreamController.SetupTypes.AUDIO_SRTP_PARAM, audioSRTP,
          StreamController.SetupTypes.VIDEO_SSRC, videoSSRC,
          StreamController.SetupTypes.AUDIO_SSRC, audioSSRC
        );

        self.setupResponse = responseTLV.toString('base64');
        callback();
      });
    });
  });
}

StreamController.prototype._handleSetupRead = function(callback) {
  debug('Setup Read');
  callback(null, this.setupResponse);
}

StreamController.prototype._supportedRTPConfiguration = function() {
  return tlv.encode(
            StreamController.RTPConfigTypes.CRYPTO, StreamController.SRTPCryptoSuites.NONE
         ).toString('base64');
}

StreamController.prototype._supportedVideoStreamConfiguration = function() {
  var self = this;

  var videoCodecParamsTLV = tlv.encode(
    StreamController.VideoCodecParamTypes.PROFILE_ID, StreamController.VideoCodecParamProfileIDTypes.BASELINE,
    StreamController.VideoCodecParamTypes.PROFILE_ID, StreamController.VideoCodecParamProfileIDTypes.MAIN,
    StreamController.VideoCodecParamTypes.PROFILE_ID, StreamController.VideoCodecParamProfileIDTypes.HIGH,
    StreamController.VideoCodecParamTypes.LEVEL, StreamController.VideoCodecParamLevelTypes.TYPE3_1,
    StreamController.VideoCodecParamTypes.LEVEL, StreamController.VideoCodecParamLevelTypes.TYPE3_2,
    StreamController.VideoCodecParamTypes.LEVEL, StreamController.VideoCodecParamLevelTypes.TYPE4_0,
    StreamController.VideoCodecParamTypes.PACKETIZATION_MODE, StreamController.VideoCodecParamPacketizationModeTypes.NON_INTERLEAVED
  );

  var imageWidth = new Buffer(2);
  imageWidth.writeUInt16LE(self.width, 0);
  var imageHeight = new Buffer(2);
  imageHeight.writeUInt16LE(self.height, 0);
  var frameRate = new Buffer(1);
  frameRate.writeUInt8(self.fps);

  var videoAttrTLV = tlv.encode(
    StreamController.VideoAttributesTypes.IMAGE_WIDTH, imageWidth,
    StreamController.VideoAttributesTypes.IMAGE_HEIGHT, imageHeight,
    StreamController.VideoAttributesTypes.FRAME_RATE, frameRate
  );

  var configurationTLV = tlv.encode(
    StreamController.VideoTypes.CODEC, StreamController.VideoCodecTypes.H264,
    StreamController.VideoTypes.CODEC_PARAM, videoCodecParamsTLV,
    StreamController.VideoTypes.ATTRIBUTES, videoAttrTLV
  );

  return tlv.encode(
    0x01, configurationTLV
  ).toString('base64');
}

StreamController.prototype._supportedAudioStreamConfiguration = function() {
  // Only AACELD and OPUS are accepted by iOS currently, and we need to give it something it will accept
  // for it to start the video stream.

  var self = this;

  var codec = StreamController.AudioCodecTypes.PCMU;
  var bitrate = StreamController.AudioCodecParamBitRateTypes.CONSTANT;
  if(self.rtspClient.audio.codec == 'PCMA') {
    codec = StreamController.AudioCodecTypes.PCMA;
  } else if(self.rtspClient.audio.codec == 'opus') {
    codec = StreamController.AudioCodecTypes.OPUS;
    bitrate = StreamController.AudioCodecParamBitRateTypes.VARIABLE;
  } else if(self.rtspClient.audio.codec == 'AAC-eld') {
    codec = StreamController.AudioCodecTypes.AACELD;
    bitrate = StreamController.AudioCodecParamBitRateTypes.VARIABLE;
  }

  // If we're not one of the supported codecs
  if(codec != StreamController.AudioCodecTypes.AACELD && codec != StreamController.AudioCodecTypes.OPUS) {
    codec = StreamController.AudioCodecTypes.OPUS;
    bitrate = StreamController.AudioCodecParamBitRateTypes.VARIABLE;
    self.videoOnly = true;
  }

  var audioParamTLV = tlv.encode(
    StreamController.AudioCodecParamTypes.CHANNEL, 1,
    StreamController.AudioCodecParamTypes.BIT_RATE, bitrate,
    StreamController.AudioCodecParamTypes.SAMPLE_RATE, StreamController.AudioCodecParamSampleRateTypes.KHZ_24
  );


  var audioConfiguration = tlv.encode(
    StreamController.AudioTypes.CODEC, codec,
    StreamController.AudioTypes.CODEC_PARAM, audioParamTLV
  );

  return tlv.encode(
    0x01, audioConfiguration,
    0x02, 0x01
  ).toString('base64');
}