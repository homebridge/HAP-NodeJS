import crypto from 'crypto';
import fs from 'fs';
import ip from 'ip';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

import { Service } from './Service';
import {
  PreparedStreamRequestCallback,
  PreparedStreamResponse,
  PrepareStreamRequest, StreamController,
  StreamControllerOptions,
  StreamRequest,
  StreamRequestTypes
} from "./StreamController";
import * as uuid from './util/uuid';
import { Address, NodeCallback, SessionIdentifier } from '../types';

export type SnapshotRequest = {
  height: number;
  width: number;
}

export type SessionInfo = {
  address: string;
  audio_port: number;
  audio_srtp: Buffer;
  audio_ssrc: number;
  video_port: number;
  video_srtp: Buffer;
  video_ssrc: number;
}

export class Camera {
  services: Service[] = [];
  streamControllers: StreamController[] = [];
  pendingSessions: Record<string, SessionInfo> = {};
  ongoingSessions: Record<string, ChildProcessWithoutNullStreams> = {};

  constructor() {

    const options: StreamControllerOptions = {
      proxy: false, // Requires RTP/RTCP MUX Proxy
      disable_audio_proxy: false, // If proxy = true, you can opt out audio proxy via this
      srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
      video: {
        resolutions: [
          [1920, 1080, 30], // Width, Height, framerate
          [320, 240, 15], // Apple Watch requires this configuration
          [1280, 960, 30],
          [1280, 720, 30],
          [1024, 768, 30],
          [640, 480, 30],
          [640, 360, 30],
          [480, 360, 30],
          [480, 270, 30],
          [320, 240, 30],
          [320, 180, 30],
        ],
        codec: {
          profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
          levels: [0, 1, 2] // Enum, please refer StreamController.VideoCodecParamLevelTypes
        }
      },
      audio: {
        comfort_noise: false,
        codecs: [
          {
            type: "OPUS", // Audio Codec
            samplerate: 24 // 8, 16, 24 KHz
          },
          {
            type: "AAC-eld",
            samplerate: 16
          }
        ]
      }
    }

    this.createCameraControlService();
    this.createSecureVideoService();
    this._createStreamControllers(2, options);
  }

  handleSnapshotRequest = (request: SnapshotRequest, callback: NodeCallback<Buffer>) => {
    // Image request: {width: number, height: number}
    // Please override this and invoke callback(error, image buffer) when the snapshot is ready

    var snapshot = fs.readFileSync(__dirname + '/res/snapshot.jpg');
    callback(undefined, snapshot);
  }

  handleCloseConnection = (connectionID: string) => {
    this.streamControllers.forEach(function(controller) {
      controller.handleCloseConnection(connectionID);
    });
  }

  prepareStream = (request: PrepareStreamRequest, callback: PreparedStreamRequestCallback) => {
    // Invoked when iOS device requires stream

    const sessionInfo: Partial<SessionInfo> = {};

    const sessionID: SessionIdentifier = request["sessionID"];
    const targetAddress = request["targetAddress"];

    sessionInfo["address"] = targetAddress;

    var response: Partial<PreparedStreamResponse> = {};

    let videoInfo = request["video"];
    if (videoInfo) {
      let targetPort = videoInfo["port"];
      let srtp_key = videoInfo["srtp_key"];
      let srtp_salt = videoInfo["srtp_salt"];

      // SSRC is a 32 bit integer that is unique per stream
      let ssrcSource = crypto.randomBytes(4);
      ssrcSource[0] = 0;
      let ssrc = ssrcSource.readInt32BE(0);

      let videoResp = {
        port: targetPort,
        ssrc: ssrc,
        srtp_key: srtp_key,
        srtp_salt: srtp_salt
      };

      response["video"] = videoResp;

      sessionInfo["video_port"] = targetPort;
      sessionInfo["video_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
      sessionInfo["video_ssrc"] = ssrc;
    }

    let audioInfo = request["audio"];
    if (audioInfo) {
      let targetPort = audioInfo["port"];
      let srtp_key = audioInfo["srtp_key"];
      let srtp_salt = audioInfo["srtp_salt"];

      // SSRC is a 32 bit integer that is unique per stream
      let ssrcSource = crypto.randomBytes(4);
      ssrcSource[0] = 0;
      let ssrc = ssrcSource.readInt32BE(0);

      let audioResp = {
        port: targetPort,
        ssrc: ssrc,
        srtp_key: srtp_key,
        srtp_salt: srtp_salt
      };

      response["audio"] = audioResp;

      sessionInfo["audio_port"] = targetPort;
      sessionInfo["audio_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
      sessionInfo["audio_ssrc"] = ssrc;
    }

    let currentAddress = ip.address();
    var addressResp: Partial<Address> = {
      address: currentAddress
    };

    if (ip.isV4Format(currentAddress)) {
      addressResp["type"] = "v4";
    } else {
      addressResp["type"] = "v6";
    }

    response["address"] = addressResp as Address;
    this.pendingSessions[uuid.unparse(sessionID)] = sessionInfo as SessionInfo;

    callback(response as PreparedStreamResponse);
  }

  handleStreamRequest = (request: StreamRequest) => {
    // Invoked when iOS device asks stream to start/stop/reconfigure
    var sessionID = request["sessionID"];
    var requestType = request["type"];
    if (sessionID) {
      let sessionIdentifier = uuid.unparse(sessionID);

      if (requestType == StreamRequestTypes.START) {
        var sessionInfo = this.pendingSessions[sessionIdentifier];
        if (sessionInfo) {
          var width = 1280;
          var height = 720;
          var fps = 30;
          var bitrate = 300;

          let videoInfo = request["video"];
          if (videoInfo) {
            width = videoInfo["width"];
            height = videoInfo["height"];

            let expectedFPS = videoInfo["fps"];
            if (expectedFPS < fps) {
              fps = expectedFPS;
            }

            bitrate = videoInfo["max_bit_rate"];
          }

          let targetAddress = sessionInfo["address"];
          let targetVideoPort = sessionInfo["video_port"];
          let videoKey = sessionInfo["video_srtp"];
          let videoSsrc = sessionInfo["video_ssrc"];

          let ffmpegCommand = '-re -f avfoundation -r 29.970000 -i 0:0 -threads 0 -vcodec libx264 -an -pix_fmt yuv420p -r '+ fps +' -f rawvideo -tune zerolatency -vf scale='+ width +':'+ height +' -b:v '+ bitrate +'k -bufsize '+ bitrate +'k -payload_type 99 -ssrc '+ videoSsrc +' -f rtp -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params '+videoKey.toString('base64')+' srtp://'+targetAddress+':'+targetVideoPort+'?rtcpport='+targetVideoPort+'&localrtcpport='+targetVideoPort+'&pkt_size=1378';
          this.ongoingSessions[sessionIdentifier] = spawn('ffmpeg', ffmpegCommand.split(' '), { env: process.env });
        }

        delete this.pendingSessions[sessionIdentifier];
      } else if (requestType == StreamRequestTypes.STOP) {
        var ffmpegProcess = this.ongoingSessions[sessionIdentifier];
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL');
        }

        delete this.ongoingSessions[sessionIdentifier];
      }
    }
  }

  createCameraControlService = () => {
    var controlService = new Service.CameraControl('', '');

    // Developer can add control characteristics like rotation, night vision at here.

    this.services.push(controlService);
  }

  createSecureVideoService = () => {
    var myCameraOperatingMode = new Service.CameraOperatingMode('','');
    this.services.push(myCameraOperatingMode);

    var myCameraEventRecordingManagement = new Service.CameraEventRecordingManagement('','');
    this.services.push(myCameraEventRecordingManagement);
  }

// Private
  _createStreamControllers = (maxStreams: number, options: StreamControllerOptions) => {

    for (let i = 0; i < maxStreams; i++) {
      const streamController = new StreamController(i, options, this);

      this.services.push(streamController.service!);
      this.streamControllers.push(streamController);
    }
  }
}
