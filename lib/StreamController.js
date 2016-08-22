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

'use strict';

module.exports = {
  StreamController: StreamController
};

function StreamController(identifier) {
  this.identifier = identifier;
  this.streamStatus = StreamController.StreamingStatus.AVAILABLE;
  this.supportedRTPConfiguration = this._supportedRTPConfiguration();
  this.supportedVideoStreamConfiguration = this._supportedVideoStreamConfiguration();
  this.supportedAudioStreamConfiguration = this._supportedAudioStreamConfiguration();

  this.selectedConfiguration = null;
  this.sessionIdentifier = null;

  this._createService();
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
  ATTRIBUTES: 0x03
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
      debug('Select Configuration: ', value);
      self.selectedConfiguration = value;

      var data = Buffer.from(value, 'base64');
      var objects = tlv.decode(data);
      debug(inspect(objects, false, null));

      // TODO: Start/stop stream
      // TODO: Update streaming status

      callback();
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
  
  this.setupResponse = this._generateSetupResponse(this.sessionIdentifier, videoSRTPPayload, audioSRTPPayload, targetVideoPort, targetAudioPort);
  callback();
}

StreamController.prototype._generateSetupResponse = function(identifier, videoSRTP, audioSRTP, targetVideoPort, targetAudioPort) {
  // TODO: Properly setup SRTP Video/Audio ports

  var videoPort = new Buffer(2);
  videoPort.writeUInt16LE(targetVideoPort, 0);
  var audioPort = new Buffer(2);
  audioPort.writeUInt16LE(targetAudioPort, 0);

  var addressTLV = tlv.encode(
    StreamController.SetupAddressInfo.ADDRESS_VER, 0,
    StreamController.SetupAddressInfo.ADDRESS, Buffer.from('10.0.1.106'), //TODO: get current ip
    StreamController.SetupAddressInfo.VIDEO_RTP_PORT, videoPort,
    StreamController.SetupAddressInfo.AUDIO_RTP_PORT, audioPort
  );

  // TODO: properly get SSRC
  var videoSSRC = new Buffer(4);
  videoSSRC.writeUInt32LE(0, 0);
  var audioSSRC = new Buffer(4);
  audioSSRC.writeUInt32LE(0, 0);

  var responseTLV = tlv.encode(
    StreamController.SetupTypes.SESSION_ID, identifier,
    StreamController.SetupTypes.STATUS, StreamController.SetupStatus.SUCCESS,
    StreamController.SetupTypes.ADDRESS, addressTLV,
    StreamController.SetupTypes.VIDEO_SRTP_PARAM, videoSRTP,
    StreamController.SetupTypes.AUDIO_SRTP_PARAM, audioSRTP,
    StreamController.SetupTypes.VIDEO_SSRC, videoSSRC,
    StreamController.SetupTypes.AUDIO_SSRC, audioSSRC
  );

  return responseTLV.toString('base64');
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
  imageWidth.writeUInt16LE(1280, 0);
  var imageHeight = new Buffer(2);
  imageHeight.writeUInt16LE(720, 0);
  var frameRate = new Buffer(1);
  frameRate.writeUInt8(30);

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
  // TODO: proper audio configuration
  var audioParamTLV = tlv.encode(
    0x01, 0x01,
    0x02, 0x00,
    0x03, 0x02
  );

  var audioConfiguration = tlv.encode(
    0x01, 0x03,
    0x02, audioParamTLV
  );

  return tlv.encode(
    0x01, audioConfiguration,
    0x02, 0x01
  ).toString('base64');
}