import {
  CameraController,
  CameraRecordingDelegate,
  CameraStreamingDelegate,
  PrepareStreamCallback,
  SnapshotRequestCallback,
  StreamRequestCallback,
} from ".";
import { ResourceRequestReason } from "../../internal-types";
import {
  AudioRecordingCodecType,
  AudioRecordingSamplerate,
  CameraRecordingOptions,
  CameraStreamingOptions,
  H264Level,
  H264Profile,
  PrepareStreamRequest,
  SnapshotRequest,
  SRTPCryptoSuites,
  StreamingRequest,
} from "../camera";
import { Characteristic } from "../Characteristic";
import { DataStreamConnection } from "../datastream";
import "../definitions";
import { HomeKitCameraActive } from "../definitions";
import { HAPStatus } from "../HAPServer";
import { AudioBitrate } from "./RemoteController";

let IMAGE = Buffer.alloc(64, 0);

let mockStreamingOptions: CameraStreamingOptions = {
  supportedCryptoSuites: [SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
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
      [320, 240, 15],
      [320, 180, 30],
    ],
  }
}

let mockRecordingOptions: CameraRecordingOptions = {
  prebufferLength: 4000,
  eventTriggerOptions: 0x01, // TODO right?
  mediaContainerConfigurations: [{
    type: 0, // TODO right?
    fragmentLength: 8000,
  }],

  video: mockStreamingOptions.video,
  audio: {
    codecs: [{
      type: AudioRecordingCodecType.AAC_ELD,
      audioChannels: 1,
      bitrateMode: AudioBitrate.VARIABLE,
      samplerate: AudioRecordingSamplerate.KHZ_48,
    }]
  }
}

class MockDelegate implements CameraStreamingDelegate, CameraRecordingDelegate {
  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    callback(undefined, IMAGE)
  }

  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    callback()
  }

  prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void {
    callback() // TODO response
  }

  handleFragmentsRequests(connection: DataStreamConnection): AsyncGenerator<Buffer> {
    return this.yieldRecordingFragment();
  }

  async* yieldRecordingFragment() {
    yield Buffer.alloc(64, 0);
  }
}

describe("CameraController", () => {
  let controller: CameraController

  beforeEach(() => {
    let delegate = new MockDelegate();

    controller = new CameraController({
      cameraStreamCount: 1,
      delegate: delegate,
      streamingOptions: mockStreamingOptions,
      recording: {
        options: mockRecordingOptions,
        delegate: delegate,
      }
    });

    // basic controller init
    controller.constructServices();
    controller.configureServices();
  });

  test("init", () => {
    expect(controller.cameraOperatingModeService?.getCharacteristic(Characteristic.HomeKitCameraActive).value)
      .toBe(Characteristic.HomeKitCameraActive.ON);

    expect(controller.recordingManagement?.getService().getCharacteristic(Characteristic.Active).value)
      .toBe(Characteristic.Active.ACTIVE);

    for (const streamManagement of controller.streamManagements) {
      expect(streamManagement.getService().getCharacteristic(Characteristic.Active).value)
        .toBe(Characteristic.Active.ACTIVE);
    }
  })

  describe("handleSnapshotRequest", () => {
    beforeEach(() => {
      controller.cameraOperatingModeService
        ?.setCharacteristic(Characteristic.PeriodicSnapshotsActive, true);
    });

    test("simple handleSnapshotRequest", async () => {
      let result = controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined);
      await expect(result).resolves.toEqual(IMAGE);
    });

    test("handleSnapshot considering PeriodicSnapshotsActive state", async () => {
      controller.cameraOperatingModeService?.setCharacteristic(Characteristic.PeriodicSnapshotsActive, false);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined)
      ).rejects.toEqual(HAPStatus.INSUFFICIENT_PRIVILEGES);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.PERIODIC)
      ).rejects.toEqual(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.EVENT)
      ).resolves.toEqual(IMAGE)
    });

    test("handleSnapshot considering EventSnapshotsActive state", async () => {
      controller.cameraOperatingModeService?.setCharacteristic(Characteristic.EventSnapshotsActive, false);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined)
      ).rejects.toEqual(HAPStatus.INSUFFICIENT_PRIVILEGES);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.PERIODIC)
      ).resolves.toEqual(IMAGE)

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.EVENT)
      ).rejects.toEqual(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    });
  });
});
