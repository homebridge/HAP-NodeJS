import {
  CameraController,
  CameraControllerOptions,
  CameraRecordingDelegate,
  CameraStreamingDelegate,
  DoorbellController,
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
  EventTriggerOption,
  H264Level,
  H264Profile,
  MediaContainerType,
  PrepareStreamRequest,
  SnapshotRequest,
  SRTPCryptoSuites,
  StreamingRequest,
  VideoCodecType,
} from "../camera";
import { Characteristic } from "../Characteristic";
import { DataSendCloseReason } from "../datastream";
import "../definitions";
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
  mediaContainerConfiguration: [{
    type: MediaContainerType.FRAGMENTED_MP4,
    fragmentLength: 8000,
  }],

  motionService: true,

  video: {
    type: VideoCodecType.H264,
    parameters: mockStreamingOptions.video.codec,
    resolutions: mockStreamingOptions.video.resolutions,
  },
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

  async *handleRecordingStreamRequest(streamId: number): AsyncGenerator<Buffer> {
    yield Buffer.alloc(64, 0);
  }

  closeRecordingStream(streamId: number, reason: DataSendCloseReason): void {
  }
}

function createOptions(
  recordingOptions: CameraRecordingOptions = mockRecordingOptions,
  streamingOptions: CameraStreamingOptions = mockStreamingOptions,
  cameraStreamCount: number = 1,
  delegate: CameraStreamingDelegate & CameraRecordingDelegate = new MockDelegate(),
): CameraControllerOptions {
  return {
    cameraStreamCount: 1,
    delegate: delegate,
    streamingOptions: streamingOptions,
    recording: {
      options: recordingOptions,
      delegate: delegate,
    }
  }
}

describe("CameraController", () => {
  let controller: CameraController

  beforeEach(() => {
    controller = new CameraController(createOptions());

    // basic controller init
    controller.constructServices();
    controller.configureServices();
  });

  test("init", () => {
    expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value)
      .toBe(Characteristic.HomeKitCameraActive.ON);

    expect(controller.recordingManagement?.recordingManagementService.getCharacteristic(Characteristic.Active).value)
      .toBe(Characteristic.Active.INACTIVE);

    // TODO test the other active characteristics!

    for (const streamManagement of controller.streamManagements) {
      expect(streamManagement.getService().getCharacteristic(Characteristic.Active).value)
        .toBe(Characteristic.Active.ACTIVE);
    }
  });

  describe("retrieveEventTriggerOptions", () => {
    test("with motion service", () => {
      // @ts-expect-error (private access)
      expect(controller.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION);
    });

    test("with motion service and doorbell", () => {
      let doorbell = new DoorbellController(createOptions());
      doorbell.constructServices();
      doorbell.configureServices();

      // @ts-expect-error (private access)
      expect(doorbell.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION | EventTriggerOption.DOORBELL);
    });

    test("with motion service and doorbell and override", () => {
      let options = mockRecordingOptions;
      options.overrideEventTriggerOptions = [EventTriggerOption.MOTION];
      let doorbell = new DoorbellController(createOptions(options));
      doorbell.constructServices();
      doorbell.configureServices();

      // @ts-expect-error (private access)
      expect(doorbell.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION | EventTriggerOption.DOORBELL);
    });

    test("with motion service and doorbell specified as override", () => {
      let options = mockRecordingOptions;
      options.overrideEventTriggerOptions = [EventTriggerOption.DOORBELL];
      let camera = new CameraController(createOptions(options))
      camera.constructServices()
      camera.configureServices()

      // @ts-expect-error (private access)
      expect(camera.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION | EventTriggerOption.DOORBELL);
    });
  });

  describe("handleSnapshotRequest", () => {
    beforeEach(() => {
      controller.recordingManagement?.operatingModeService
        .setCharacteristic(Characteristic.PeriodicSnapshotsActive, true);
    });

    test("simple handleSnapshotRequest", async () => {
      let result = controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined);
      await expect(result).resolves.toEqual(IMAGE);
    });

    test("handleSnapshot considering PeriodicSnapshotsActive state", async () => {
      controller.recordingManagement?.operatingModeService.setCharacteristic(Characteristic.PeriodicSnapshotsActive, false);

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
      controller.recordingManagement?.operatingModeService.setCharacteristic(Characteristic.EventSnapshotsActive, false);

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
