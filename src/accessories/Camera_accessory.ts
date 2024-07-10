import assert from "assert";
import { ChildProcess, spawn } from "child_process";
import { once } from "events";
import { AddressInfo, createServer, Server, Socket } from "net";
import {
  Accessory,
  AudioBitrate,
  AudioRecordingCodecType,
  AudioRecordingSamplerate,
  CameraController,
  CameraRecordingConfiguration,
  CameraRecordingDelegate,
  CameraStreamingDelegate,
  Categories,
  Characteristic,
  H264Level,
  H264Profile,
  HDSProtocolSpecificErrorReason,
  MediaContainerType,
  PrepareStreamCallback,
  PrepareStreamRequest,
  PrepareStreamResponse,
  RecordingPacket,
  Service,
  SnapshotRequest,
  SnapshotRequestCallback,
  SRTPCryptoSuites,
  StreamingRequest,
  StreamRequestCallback,
  StreamRequestTypes,
  StreamSessionIdentifier,
  uuid,
  VideoCodecType,
  VideoInfo,
} from "..";

interface MP4Atom {
  header: Buffer;
  length: number;
  type: string;
  data: Buffer;
}

const cameraUUID = uuid.generate("hap-nodejs:accessories:ip-camera");
const camera = exports.accessory = new Accessory("IPCamera", cameraUUID);

// @ts-expect-error: Core/BridgeCore API
camera.username = "9F:B2:46:0C:40:DB";
// @ts-expect-error: Core/BridgeCore API
camera.pincode = "948-23-459";
camera.category = Categories.IP_CAMERA;

type SessionInfo = {
  address: string, // address of the HAP controller

  videoPort: number, // port of the controller
  localVideoPort: number,
  videoCryptoSuite: SRTPCryptoSuites, // should be saved if multiple suites are supported
  videoSRTP: Buffer, // key and salt concatenated
  videoSSRC: number, // rtp synchronisation source

  /* Won't be saved as audio is not supported by this example
  audioPort: number,
  audioCryptoSuite: SRTPCryptoSuites,
  audioSRTP: Buffer,
  audioSSRC: number,
   */
}

type OngoingSession = {
  localVideoPort: number,
  process: ChildProcess,
}

const FFMPEGH264ProfileNames = [
  "baseline",
  "main",
  "high",
];
const FFMPEGH264LevelNames = [
  "3.1",
  "3.2",
  "4.0",
];

const ports = new Set<number>();

function getPort(): number {
  for (let i = 5011;; i++) {
    if (!ports.has(i)) {
      ports.add(i);
      return i;
    }
  }
}

class ExampleCamera implements CameraStreamingDelegate, CameraRecordingDelegate {
  private ffmpegDebugOutput = false;

  controller?: CameraController;

  // keep track of sessions
  pendingSessions: Record<string, SessionInfo> = {};
  ongoingSessions: Record<string, OngoingSession> = {};

  // minimal secure video properties.
  configuration?: CameraRecordingConfiguration;
  handlingStreamingRequest = false;
  server?: MP4StreamingServer;

  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    const ffmpegCommand = `-f lavfi -i testsrc=s=${request.width}x${request.height} -vframes 1 -f mjpeg -`;
    const ffmpeg = spawn("ffmpeg", ffmpegCommand.split(" "), { env: process.env });

    const snapshotBuffers: Buffer[] = [];

    ffmpeg.stdout.on("data", data => snapshotBuffers.push(data));
    ffmpeg.stderr.on("data", data => {
      if (this.ffmpegDebugOutput) {
        console.log("SNAPSHOT: " + String(data));
      }
    });

    ffmpeg.on("exit", (code, signal) => {
      if (signal) {
        console.log("Snapshot process was killed with signal: " + signal);
        callback(new Error("killed with signal " + signal));
      } else if (code === 0) {
        console.log(`Successfully captured snapshot at ${request.width}x${request.height}`);
        callback(undefined, Buffer.concat(snapshotBuffers));
      } else {
        console.log("Snapshot process exited with code " + code);
        callback(new Error("Snapshot process exited with code " + code));
      }
    });
  }

  // called when iOS request rtp setup
  prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void {
    const sessionId: StreamSessionIdentifier = request.sessionID;
    const targetAddress = request.targetAddress;

    const video = request.video;

    const videoCryptoSuite = video.srtpCryptoSuite; // could be used to support multiple crypto suite (or support no suite for debugging)
    const videoSrtpKey = video.srtp_key;
    const videoSrtpSalt = video.srtp_salt;

    const videoSSRC = CameraController.generateSynchronisationSource();

    const localPort = getPort();

    const sessionInfo: SessionInfo = {
      address: targetAddress,

      videoPort: video.port,
      localVideoPort: localPort,
      videoCryptoSuite: videoCryptoSuite,
      videoSRTP: Buffer.concat([videoSrtpKey, videoSrtpSalt]),
      videoSSRC: videoSSRC,
    };

    const response: PrepareStreamResponse = {
      video: {
        port: localPort,
        ssrc: videoSSRC,

        srtp_key: videoSrtpKey,
        srtp_salt: videoSrtpSalt,
      },
      // audio is omitted as we do not support audio in this example
    };

    this.pendingSessions[sessionId] = sessionInfo;
    callback(undefined, response);
  }

  // called when iOS device asks stream to start/stop/reconfigure
  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    const sessionId = request.sessionID;

    switch (request.type) {
    case StreamRequestTypes.START: {
      const sessionInfo = this.pendingSessions[sessionId];

      const video: VideoInfo = request.video;

      const profile = FFMPEGH264ProfileNames[video.profile];
      const level = FFMPEGH264LevelNames[video.level];
      const width = video.width;
      const height = video.height;
      const fps = video.fps;

      const payloadType = video.pt;
      const maxBitrate = video.max_bit_rate;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rtcpInterval = video.rtcp_interval; // usually 0.5
      const mtu = video.mtu; // maximum transmission unit

      const address = sessionInfo.address;
      const videoPort = sessionInfo.videoPort;
      const localVideoPort = sessionInfo.localVideoPort;
      const ssrc = sessionInfo.videoSSRC;
      const cryptoSuite = sessionInfo.videoCryptoSuite;
      const videoSRTP = sessionInfo.videoSRTP.toString("base64");

      console.log(`Starting video stream (${width}x${height}, ${fps} fps, ${maxBitrate} kbps, ${mtu} mtu)...`);

      let videoffmpegCommand = `-re -f lavfi -i testsrc=s=${width}x${height}:r=${fps} -map 0:0 ` +
        `-c:v h264 -pix_fmt yuv420p -r ${fps} -an -sn -dn -b:v ${maxBitrate}k ` +
        `-profile:v ${profile} -level:v ${level} ` +
        `-payload_type ${payloadType} -ssrc ${ssrc} -f rtp `;

      if (cryptoSuite !== SRTPCryptoSuites.NONE) {
        let suite: string;
        switch (cryptoSuite) {
        case SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80: // actually ffmpeg just supports AES_CM_128_HMAC_SHA1_80
          suite = "AES_CM_128_HMAC_SHA1_80";
          break;
        case SRTPCryptoSuites.AES_CM_256_HMAC_SHA1_80:
          suite = "AES_CM_256_HMAC_SHA1_80";
          break;
        }

        videoffmpegCommand += `-srtp_out_suite ${suite} -srtp_out_params ${videoSRTP} s`;
      }

      videoffmpegCommand += `rtp://${address}:${videoPort}?rtcpport=${videoPort}&localrtcpport=${localVideoPort}&pkt_size=${mtu}`;

      if (this.ffmpegDebugOutput) {
        console.log("FFMPEG command: ffmpeg " + videoffmpegCommand);
      }

      const ffmpegVideo = spawn("ffmpeg", videoffmpegCommand.split(" "), { env: process.env });

      let started = false;
      ffmpegVideo.stderr.on("data", (data: Buffer) => {
        console.log(data.toString("utf8"));
        if (!started) {
          started = true;
          console.log("FFMPEG: received first frame");

          callback(); // do not forget to execute callback once set up
        }

        if (this.ffmpegDebugOutput) {
          console.log("VIDEO: " + String(data));
        }
      });
      ffmpegVideo.on("error", error => {
        console.log("[Video] Failed to start video stream: " + error.message);
        callback(new Error("ffmpeg process creation failed!"));
      });
      ffmpegVideo.on("exit", (code, signal) => {
        const message = "[Video] ffmpeg exited with code: " + code + " and signal: " + signal;

        if (code == null || code === 255) {
          console.log(message + " (Video stream stopped!)");
        } else {
          console.log(message + " (error)");

          if (!started) {
            callback(new Error(message));
          } else {
            this.controller!.forceStopStreamingSession(sessionId);
          }
        }
      });

      this.ongoingSessions[sessionId] = {
        localVideoPort: localVideoPort,
        process: ffmpegVideo,
      };
      delete this.pendingSessions[sessionId];

      break;
    }
    case StreamRequestTypes.RECONFIGURE:
      // not supported by this example
      console.log("Received (unsupported) request to reconfigure to: " + JSON.stringify(request.video));
      callback();
      break;
    case StreamRequestTypes.STOP: {
      const ongoingSession = this.ongoingSessions[sessionId];
      if (!ongoingSession) {
        callback();
        break;
      }

      ports.delete(ongoingSession.localVideoPort);

      try {
        ongoingSession.process.kill("SIGKILL");
      } catch (e) {
        console.log("Error occurred terminating the video process!");
        console.log(e);
      }

      delete this.ongoingSessions[sessionId];

      console.log("Stopped streaming session!");
      callback();
      break;
    }
    }
  }

  updateRecordingActive(active: boolean): void {
    // we haven't implemented a prebuffer
    console.log("Recording active set to " + active);
  }

  updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined): void {
    this.configuration = configuration;
    console.log(configuration);
  }

  /**
   * This is a very minimal, very experimental example on how to implement fmp4 streaming with a
   * CameraController supporting HomeKit Secure Video.
   *
   * An ideal implementation would diverge from this in the following ways:
   * * It would implement a prebuffer and respect the recording `active` characteristic for that.
   * * It would start to immediately record after a trigger event occurred and not just
   *   when the HomeKit Controller requests it (see the documentation of `CameraRecordingDelegate`).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *handleRecordingStreamRequest(streamId: number): AsyncGenerator<RecordingPacket> {
    assert(!!this.configuration);

    /**
     * With this flag you can control how the generator reacts to a reset to the motion trigger.
     * If set to true, the generator will send a proper endOfStream if the motion stops.
     * If set to false, the generator will run till the HomeKit Controller closes the stream.
     *
     * Note: In a real implementation you would most likely introduce a bit of a delay.
     */
    const STOP_AFTER_MOTION_STOP = false;

    this.handlingStreamingRequest = true;

    assert(this.configuration.videoCodec.type === VideoCodecType.H264);

    const profile = this.configuration.videoCodec.parameters.profile === H264Profile.HIGH ? "high"
      : this.configuration.videoCodec.parameters.profile === H264Profile.MAIN ? "main" : "baseline";

    const level = this.configuration.videoCodec.parameters.level === H264Level.LEVEL4_0 ? "4.0"
      : this.configuration.videoCodec.parameters.level === H264Level.LEVEL3_2 ? "3.2" : "3.1";

    const videoArgs: Array<string> = [
      "-an",
      "-sn",
      "-dn",
      "-codec:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",

      "-profile:v", profile,
      "-level:v", level,
      "-b:v", `${this.configuration.videoCodec.parameters.bitRate}k`,
      "-force_key_frames", `expr:eq(t,n_forced*${this.configuration.videoCodec.parameters.iFrameInterval / 1000})`,
      "-r", this.configuration.videoCodec.resolution[2].toString(),
    ];

    let samplerate: string;
    switch (this.configuration.audioCodec.samplerate) {
    case AudioRecordingSamplerate.KHZ_8:
      samplerate = "8";
      break;
    case AudioRecordingSamplerate.KHZ_16:
      samplerate = "16";
      break;
    case AudioRecordingSamplerate.KHZ_24:
      samplerate = "24";
      break;
    case AudioRecordingSamplerate.KHZ_32:
      samplerate = "32";
      break;
    case AudioRecordingSamplerate.KHZ_44_1:
      samplerate = "44.1";
      break;
    case AudioRecordingSamplerate.KHZ_48:
      samplerate = "48";
      break;
    default:
      throw new Error("Unsupported audio samplerate: " + this.configuration.audioCodec.samplerate);
    }

    const audioArgs: Array<string> = this.controller?.recordingManagement?.recordingManagementService.getCharacteristic(Characteristic.RecordingAudioActive)
      ? [
        "-acodec", "libfdk_aac",
        ...(this.configuration.audioCodec.type === AudioRecordingCodecType.AAC_LC ?
          ["-profile:a", "aac_low"] :
          ["-profile:a", "aac_eld"]),
        "-ar", `${samplerate}k`,
        "-b:a", `${this.configuration.audioCodec.bitrate}k`,
        "-ac", `${this.configuration.audioCodec.audioChannels}`,
      ]
      : [];

    this.server = new MP4StreamingServer(
      "ffmpeg",
      `-f lavfi -i \
      testsrc=s=${this.configuration.videoCodec.resolution[0]}x${this.configuration.videoCodec.resolution[1]}:r=${this.configuration.videoCodec.resolution[2]}`
        .split(/ /g),
      audioArgs,
      videoArgs,
    );

    await this.server.start();
    if (!this.server || this.server.destroyed) {
      return; // early exit
    }

    const pending: Array<Buffer> = [];

    try {
      for await (const box of this.server.generator()) {
        pending.push(box.header, box.data);

        const motionDetected = camera.getService(Service.MotionSensor)?.getCharacteristic(Characteristic.MotionDetected).value;

        console.log("mp4 box type " + box.type + " and length " + box.length);
        if (box.type === "moov" || box.type === "mdat") {
          const fragment = Buffer.concat(pending);
          pending.splice(0, pending.length);

          const isLast = STOP_AFTER_MOTION_STOP && !motionDetected;

          yield {
            data: fragment,
            isLast: isLast,
          };

          if (isLast) {
            console.log("Ending session due to motion stopped!");
            break;
          }
        }
      }
    } catch (error) {
      if (!error.message.startsWith("FFMPEG")) { // cheap way of identifying our own emitted errors
        console.error("Encountered unexpected error on generator " + error.stack);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  closeRecordingStream(streamId: number, reason?: HDSProtocolSpecificErrorReason): void {
    if (this.server) {
      this.server.destroy();
      this.server = undefined;
    }
    this.handlingStreamingRequest = false;
  }

  acknowledgeStream(streamId: number): void {
    this.closeRecordingStream(streamId);
  }
}

class MP4StreamingServer {
  readonly server: Server;

  /**
   * This can be configured to output ffmpeg debug output!
   */
  readonly debugMode: boolean = false;

  readonly ffmpegPath: string;
  readonly args: string[];

  socket?: Socket;
  childProcess?: ChildProcess;
  destroyed = false;

  connectPromise: Promise<void>;
  connectResolve?: () => void;

  constructor(ffmpegPath: string, ffmpegInput: Array<string>, audioOutputArgs: Array<string>, videoOutputArgs: Array<string>) {
    this.connectPromise = new Promise(resolve => this.connectResolve = resolve);

    this.server = createServer(this.handleConnection.bind(this));
    this.ffmpegPath = ffmpegPath;
    this.args = [];

    this.args.push(...ffmpegInput);

    this.args.push(...audioOutputArgs);

    this.args.push("-f", "mp4");
    this.args.push(...videoOutputArgs);
    this.args.push("-fflags",
      "+genpts",
      "-reset_timestamps",
      "1");
    this.args.push(
      "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    );
  }

  async start() {
    const promise = once(this.server, "listening");
    this.server.listen(); // listen on random port
    await promise;

    if (this.destroyed) {
      return;
    }

    const port = (this.server.address() as AddressInfo).port;
    this.args.push("tcp://127.0.0.1:" + port);

    console.log(this.ffmpegPath + " " + this.args.join(" "));

    this.childProcess = spawn(this.ffmpegPath, this.args, { env: process.env, stdio: this.debugMode? "pipe": "ignore" });
    if (!this.childProcess) {
      console.error("ChildProcess is undefined directly after the init!");
    }
    if(this.debugMode) {
      this.childProcess.stdout.on("data", data => console.log(data.toString()));
      this.childProcess.stderr.on("data", data => console.log(data.toString()));
    }
  }

  destroy() {
    this.socket?.destroy();
    this.childProcess?.kill();

    this.socket = undefined;
    this.childProcess = undefined;
    this.destroyed = true;
  }

  handleConnection(socket: Socket): void {
    this.server.close(); // don't accept any further clients
    this.socket = socket;
    this.connectResolve?.();
  }

  /**
   * Generator for `MP4Atom`s.
   * Throws error to signal EOF when socket is closed.
   */
  async* generator(): AsyncGenerator<MP4Atom> {
    await this.connectPromise;

    if (!this.socket || !this.childProcess) {
      console.log("Socket undefined " + !!this.socket + " childProcess undefined " + !!this.childProcess);
      throw new Error("Unexpected state!");
    }

    while (true) {
      const header = await this.read(8);
      const length = header.readInt32BE(0) - 8;
      const type = header.slice(4).toString();
      const data = await this.read(length);

      yield {
        header: header,
        length: length,
        type: type,
        data: data,
      };
    }
  }

  async read(length: number): Promise<Buffer> {
    if (!this.socket) {
      throw Error("FFMPEG tried reading from closed socket!");
    }

    if (!length) {
      return Buffer.alloc(0);
    }

    const value = this.socket.read(length);
    if (value) {
      return value;
    }

    return new Promise((resolve, reject) => {
      const readHandler = () => {
        const value = this.socket!.read(length);
        if (value) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          cleanup();
          resolve(value);
        }
      };

      const endHandler = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        cleanup();
        reject(new Error(`FFMPEG socket closed during read for ${length} bytes!`));
      };

      const cleanup = () => {
        this.socket?.removeListener("readable", readHandler);
        this.socket?.removeListener("close", endHandler);
      };

      if (!this.socket) {
        throw new Error("FFMPEG socket is closed now!");
      }

      this.socket.on("readable", readHandler);
      this.socket.on("close", endHandler);
    });
  }
}

const streamDelegate = new ExampleCamera();

const cameraController = new CameraController({
  cameraStreamCount: 2, // HomeKit requires at least 2 streams, but 1 is also just fine
  delegate: streamDelegate,

  streamingOptions: {
    // srtp: true, // legacy option which will just enable AES_CM_128_HMAC_SHA1_80 (can still be used though)

    // NONE is not supported by iOS just there for testing with Wireshark for example
    supportedCryptoSuites: [SRTPCryptoSuites.NONE, SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
    video: {
      codec: {
        profiles: [H264Profile.BASELINE, H264Profile.MAIN, H264Profile.HIGH],
        levels: [H264Level.LEVEL3_1, H264Level.LEVEL3_2, H264Level.LEVEL4_0],
      },
      resolutions: [
        [1920, 1080, 30], // width, height, framerate
        [1280, 960, 30],
        [1280, 720, 30],
        [1024, 768, 30],
        [640, 480, 30],
        [640, 360, 30],
        [480, 360, 30],
        [480, 270, 30],
        [320, 240, 30],
        [320, 240, 15], // Apple Watch requires this configuration (Apple Watch also seems to required OPUS @16K)
        [320, 180, 30],
      ],
    },
    /* audio option is omitted, as it is not supported in this example; HAP-NodeJS will fake an appropriate audio codec
        audio: {
            comfort_noise: false, // optional, default false
            codecs: [
                {
                    type: AudioStreamingCodecType.OPUS,
                    audioChannels: 1, // optional, default 1
                    samplerate: [AudioStreamingSamplerate.KHZ_16, AudioStreamingSamplerate.KHZ_24], // 16 and 24 must be present for AAC-ELD or OPUS
                },
            ],
        },
        // */
  },
  recording: {
    options: {
      prebufferLength: 4000,
      mediaContainerConfiguration: {
        type: MediaContainerType.FRAGMENTED_MP4,
        fragmentLength: 4000,
      },
      video: {
        type: VideoCodecType.H264,
        parameters: {
          profiles: [H264Profile.HIGH],
          levels: [H264Level.LEVEL4_0],
        },
        resolutions: [
          [320, 180, 30],
          [320, 240, 15],
          [320, 240, 30],
          [480, 270, 30],
          [480, 360, 30],
          [640, 360, 30],
          [640, 480, 30],
          [1280, 720, 30],
          [1280, 960, 30],
          [1920, 1080, 30],
          [1600, 1200, 30],
        ],
      },
      audio: {
        codecs: {
          type: AudioRecordingCodecType.AAC_ELD,
          audioChannels: 1,
          samplerate: AudioRecordingSamplerate.KHZ_48,
          bitrateMode: AudioBitrate.VARIABLE,
        },
      },
    },

    delegate: streamDelegate,
  },

  sensors: {
    motion: true,
    occupancy: true,
  },
});
streamDelegate.controller = cameraController;

camera.configureController(cameraController);

// a service to trigger the motion sensor!
camera.addService(Service.Switch, "MOTION TRIGGER")
  .getCharacteristic(Characteristic.On)
  .onSet(value => {
    camera.getService(Service.MotionSensor)
      ?.updateCharacteristic(Characteristic.MotionDetected, value);
  });
