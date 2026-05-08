import {
  CameraController,
  CameraControllerOptions,
  CameraRecordingDelegate,
  CameraStreamingDelegate,
  PrepareStreamCallback,
  SnapshotRequestCallback,
  StreamRequestCallback,
} from "../controller";
import {
  AudioBitrate,
  AudioRecordingCodecType,
  AudioRecordingSamplerate,
  AudioStreamingCodecType,
  AudioStreamingSamplerate,
  CameraRecordingConfiguration,
  CameraRecordingOptions,
  H264Level,
  H264Profile,
  MediaContainerType,
  PrepareStreamRequest,
  RecordingPacket,
  SnapshotRequest,
  StreamingRequest,
  VideoCodecType,
} from "../camera";
import { HDSProtocolSpecificErrorReason } from "../datastream";
import "../definitions";
import { HAPConnection } from "../util/eventedhttp";
import * as tlv from "../util/tlv";
import * as uuid from "../util/uuid";
import RTPProxy from "./RTPProxy";
import { CameraStreamingOptions, RTPStreamManagement, SRTPCryptoSuites } from "./RTPStreamManagement";

class MockDelegate implements CameraStreamingDelegate, CameraRecordingDelegate {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    throw Error("Unsupported!");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    throw Error("Unsupported!");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void {
    throw Error("Unsupported!");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *handleRecordingStreamRequest(streamId: number): AsyncGenerator<RecordingPacket> {
    yield { data: Buffer.alloc(64, 0), isLast: true };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  closeRecordingStream(streamId: number, reason: HDSProtocolSpecificErrorReason): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRecordingActive(active: boolean): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined): void {}
}

const baseStreamingOptions: CameraStreamingOptions = {
  supportedCryptoSuites: [SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
  video: {
    codec: {
      profiles: [H264Profile.BASELINE, H264Profile.MAIN, H264Profile.HIGH],
      levels: [H264Level.LEVEL3_1, H264Level.LEVEL3_2, H264Level.LEVEL4_0],
    },
    resolutions: [
      [1920, 1080, 30],
      [1280, 720, 30],
      [320, 240, 15],
    ],
  },
  audio: {
    twoWayAudio: true,
    codecs: [{
      type: AudioStreamingCodecType.AAC_ELD,
      samplerate: AudioStreamingSamplerate.KHZ_24,
    }],
  },
};

const baseRecordingOptions: CameraRecordingOptions = {
  prebufferLength: 4000,
  mediaContainerConfiguration: [{
    type: MediaContainerType.FRAGMENTED_MP4,
    fragmentLength: 8000,
  }],
  video: {
    type: VideoCodecType.H264,
    parameters: baseStreamingOptions.video.codec,
    resolutions: baseStreamingOptions.video.resolutions,
  },
  audio: {
    codecs: [{
      type: AudioRecordingCodecType.AAC_ELD,
      audioChannels: 1,
      bitrateMode: AudioBitrate.VARIABLE,
      samplerate: AudioRecordingSamplerate.KHZ_48,
    }],
  },
};

function buildControllerOptions(streamingOptions: CameraStreamingOptions): CameraControllerOptions {
  const delegate = new MockDelegate();
  return {
    cameraStreamCount: 2,
    delegate,
    streamingOptions,
    recording: {
      options: baseRecordingOptions,
      delegate,
    },
    sensors: { motion: true, occupancy: true },
  };
}

// matches the private const enums in RTPStreamManagement.ts
const SetupEndpointsTypes = {
  SESSION_ID: 0x01,
  CONTROLLER_ADDRESS: 0x03,
  VIDEO_SRTP_PARAMETERS: 0x04,
  AUDIO_SRTP_PARAMETERS: 0x05,
} as const;
const AddressTypes = {
  ADDRESS_VERSION: 0x01,
  ADDRESS: 0x02,
  VIDEO_RTP_PORT: 0x03,
  AUDIO_RTP_PORT: 0x04,
} as const;
const SRTPParametersTypes = {
  SRTP_CRYPTO_SUITE: 0x01,
  MASTER_KEY: 0x02,
  MASTER_SALT: 0x03,
} as const;

function buildSetupEndpointsTlv(): string {
  const addressTlv = tlv.encode(
    AddressTypes.ADDRESS_VERSION, 0x00, // IPV4
    AddressTypes.ADDRESS, "127.0.0.1",
    AddressTypes.VIDEO_RTP_PORT, tlv.writeUInt16(5000),
    AddressTypes.AUDIO_RTP_PORT, tlv.writeUInt16(5001),
  );
  const srtpTlv = tlv.encode(
    SRTPParametersTypes.SRTP_CRYPTO_SUITE, SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80,
    SRTPParametersTypes.MASTER_KEY, Buffer.alloc(16),
    SRTPParametersTypes.MASTER_SALT, Buffer.alloc(14),
  );
  const payload = tlv.encode(
    SetupEndpointsTypes.SESSION_ID, uuid.write("11111111-1111-1111-1111-111111111111"),
    SetupEndpointsTypes.CONTROLLER_ADDRESS, addressTlv,
    SetupEndpointsTypes.VIDEO_SRTP_PARAMETERS, srtpTlv,
    SetupEndpointsTypes.AUDIO_SRTP_PARAMETERS, srtpTlv,
  );
  return payload.toString("base64");
}

function buildMockConnection(): HAPConnection {
  return {
    localAddress: "127.0.0.1",
    getLocalAddress: jest.fn().mockReturnValue("127.0.0.1"),
    setMaxListeners: jest.fn(),
    getMaxListeners: jest.fn().mockReturnValue(10),
    on: jest.fn(),
    removeListener: jest.fn(),
  } as unknown as HAPConnection;
}

describe("RTPStreamManagement", () => {
  describe("handleSetupEndpoints proxy rejection (fix 0ce74c4e)", () => {
    let controller: CameraController;
    let setupSpy: jest.SpyInstance;

    beforeEach(() => {
      const proxyOptions: CameraStreamingOptions = {
        ...baseStreamingOptions,
        proxy: true,
      };
      controller = new CameraController(buildControllerOptions(proxyOptions));
      controller.constructServices();
      controller.configureServices();
    });

    afterEach(() => {
      setupSpy?.mockRestore();
      controller.handleFactoryReset();
    });

    test("should fail gracefully when RTPProxy.setup rejects", async () => {
      setupSpy = jest.spyOn(RTPProxy.prototype, "setup")
        .mockImplementation(() => Promise.reject(new Error("socket creation failed")));

      const rtp = controller.streamManagements[0] as RTPStreamManagement;
      const error = await new Promise<Error | undefined>((resolve) => {
        // @ts-expect-error: private method access
        rtp.handleSetupEndpoints(buildSetupEndpointsTlv(), (err) => {
          resolve(err as Error | undefined);
        }, buildMockConnection());
      });

      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe("socket creation failed");
    });

    test("should set setupEndpointsResponse to ERROR status when proxy setup rejects", async () => {
      setupSpy = jest.spyOn(RTPProxy.prototype, "setup")
        .mockImplementation(() => Promise.reject(new Error("bind failed")));

      const rtp = controller.streamManagements[0] as RTPStreamManagement;
      await new Promise<void>((resolve) => {
        // @ts-expect-error: private method access
        rtp.handleSetupEndpoints(buildSetupEndpointsTlv(), () => resolve(), buildMockConnection());
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (rtp as any).setupEndpointsResponse as string;
      const decoded = tlv.decode(Buffer.from(response, "base64"));
      // SetupEndpointsResponseTypes.STATUS = 0x02; SetupEndpointsStatus.ERROR = 0x02
      expect(decoded[0x02].readUInt8(0)).toBe(0x02);
    });
  });
});
