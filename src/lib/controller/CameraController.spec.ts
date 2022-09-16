import {
  CameraController,
  CameraControllerOptions,
  CameraRecordingDelegate,
  CameraStreamingDelegate,
  DoorbellController,
  PrepareStreamCallback,
  ResourceRequestReason,
  SnapshotRequestCallback,
  StreamRequestCallback,
} from ".";
import {
  AudioRecordingCodecType,
  AudioRecordingSamplerate,
  AudioStreamingCodecType,
  AudioStreamingSamplerate,
  CameraRecordingConfiguration,
  CameraRecordingOptions,
  CameraStreamingOptions,
  EventTriggerOption,
  H264Level,
  H264Profile,
  MediaContainerType,
  PrepareStreamRequest,
  RecordingPacket,
  SnapshotRequest,
  SRTPCryptoSuites,
  StreamingRequest,
  VideoCodecType,
} from "../camera";
import { Characteristic } from "../Characteristic";
import { HDSProtocolSpecificErrorReason } from "../datastream";
import "../definitions";
import { HAPStatus } from "../HAPServer";
import { AudioBitrate } from "./RemoteController";

const IMAGE = Buffer.alloc(64, 0);

const mockStreamingOptions: CameraStreamingOptions = {
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
  },
  audio: {
    twoWayAudio: true,
    codecs: [{
      type: AudioStreamingCodecType.AAC_ELD,
      samplerate: AudioStreamingSamplerate.KHZ_24,
    }],
  },
};

const mockRecordingOptions: CameraRecordingOptions = {
  prebufferLength: 4000,
  mediaContainerConfiguration: [{
    type: MediaContainerType.FRAGMENTED_MP4,
    fragmentLength: 8000,
  }],

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
    }],
  },
};

class MockDelegate implements CameraStreamingDelegate, CameraRecordingDelegate {
  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    callback(undefined, IMAGE);
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
  closeRecordingStream(streamId: number, reason: HDSProtocolSpecificErrorReason): void {
    // do nothing
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRecordingActive(active: boolean): void {
    // do nothing
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined): void {
    // do nothing
  }
}

function createOptions(
  recordingOptions: CameraRecordingOptions = mockRecordingOptions,
  streamingOptions: CameraStreamingOptions = mockStreamingOptions,
  cameraStreamCount = 2,
  delegate: CameraStreamingDelegate & CameraRecordingDelegate = new MockDelegate(),
): CameraControllerOptions {
  return {
    cameraStreamCount: cameraStreamCount,
    delegate: delegate,
    streamingOptions: streamingOptions,
    recording: {
      options: recordingOptions,
      delegate: delegate,
    },
    sensors: {
      motion: true,
      occupancy: true,
    },
  };
}

describe("CameraController", () => {
  let controller: CameraController;

  beforeEach(() => {
    controller = new CameraController(createOptions());

    // basic controller init
    controller.constructServices();
    controller.configureServices();
  });

  test("init", () => {
    expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value)
      .toBe(Characteristic.HomeKitCameraActive.ON);
    expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.PeriodicSnapshotsActive).value)
      .toBe(1);
    expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.EventSnapshotsActive).value)
      .toBe(1);

    expect(controller.recordingManagement?.recordingManagementService.getCharacteristic(Characteristic.RecordingAudioActive).value)
      .toBe(0);

    expect(controller.recordingManagement?.recordingManagementService.getCharacteristic(Characteristic.Active).value)
      .toBe(Characteristic.Active.INACTIVE);

    for (const streamManagement of controller.streamManagements) {
      expect(streamManagement.getService().getCharacteristic(Characteristic.Active).value)
        .toBe(Characteristic.Active.ACTIVE);
    }

    expect(controller.motionService?.testCharacteristic(Characteristic.StatusActive)).toBeTruthy();
    expect(controller.motionService!.getCharacteristic(Characteristic.StatusActive).value)
      .toEqual(true);

    expect(controller.occupancyService?.testCharacteristic(Characteristic.StatusActive)).toBeTruthy();
    expect(controller.occupancyService!.getCharacteristic(Characteristic.StatusActive).value)
      .toEqual(true);
  });

  describe("retrieveEventTriggerOptions", () => {
    test("with motion service", () => {
      // @ts-expect-error (private access)
      expect(controller.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION);
    });

    test("with motion service and doorbell", () => {
      const doorbell = new DoorbellController(createOptions());
      doorbell.constructServices();
      doorbell.configureServices();

      // @ts-expect-error (private access)
      expect(doorbell.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION | EventTriggerOption.DOORBELL);
    });

    test("with motion service and doorbell and override", () => {
      const options = mockRecordingOptions;
      options.overrideEventTriggerOptions = [EventTriggerOption.MOTION];
      const doorbell = new DoorbellController(createOptions(options));
      doorbell.constructServices();
      doorbell.configureServices();

      // @ts-expect-error (private access)
      expect(doorbell.recordingManagement?.eventTriggerOptions).toBe(EventTriggerOption.MOTION | EventTriggerOption.DOORBELL);
    });

    test("with motion service and doorbell specified as override", () => {
      const options = mockRecordingOptions;
      options.overrideEventTriggerOptions = [EventTriggerOption.DOORBELL];
      const camera = new CameraController(createOptions(options));
      camera.constructServices();
      camera.configureServices();

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
      const result = controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined);
      await expect(result).resolves.toEqual(IMAGE);
    });

    test("handleSnapshot considering PeriodicSnapshotsActive state", async () => {
      controller.recordingManagement?.operatingModeService.setCharacteristic(Characteristic.PeriodicSnapshotsActive, false);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined),
      ).rejects.toEqual(HAPStatus.INSUFFICIENT_PRIVILEGES);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.PERIODIC),
      ).rejects.toEqual(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.EVENT),
      ).resolves.toEqual(IMAGE);
    });

    test("handleSnapshot considering EventSnapshotsActive state", async () => {
      controller.recordingManagement?.operatingModeService.setCharacteristic(Characteristic.EventSnapshotsActive, false);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", undefined),
      ).rejects.toEqual(HAPStatus.INSUFFICIENT_PRIVILEGES);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.PERIODIC),
      ).resolves.toEqual(IMAGE);

      await expect(
        controller.handleSnapshotRequest(100, 100, "SomeAccessory", ResourceRequestReason.EVENT),
      ).rejects.toEqual(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    });

    test("handleSnapshot considering HomeKitCameraActive state", async () => {
      controller.recordingManagement?.operatingModeService.setCharacteristic(Characteristic.HomeKitCameraActive, false);

      for (const reason of [undefined, ResourceRequestReason.PERIODIC, ResourceRequestReason.EVENT]) {
        await expect(
          controller.handleSnapshotRequest(100, 100, "SomeAccessory", reason),
        ).rejects.toEqual(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
      }
    });

    test("handleSnapshot considering RTPStreamManagement.Active state", async () => {
      for (const management of controller.streamManagements) {
        management.service.setCharacteristic(Characteristic.Active, false);
      }

      for (const reason of [undefined, ResourceRequestReason.PERIODIC, ResourceRequestReason.EVENT]) {
        await expect(
          controller.handleSnapshotRequest(100, 100, "SomeAccessory", reason),
        ).rejects.toEqual(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
      }
    });
  });

  describe("serialization", () => {
    test("identity", () => {
      const serialized0 = controller.serialize()!;
      controller.deserialize(serialized0);
      const serialized1 = controller.serialize();

      expect(serialized0).toEqual(serialized1);
    });


    test("should restore existing configuration", () => {
      const selectedConfiguration = "AR0BBKAPAAACCAEAAAAAAAAAAwsBAQACBgEEoA8AAAIkAQEAAhIBAQICAQIDBNAHAAAEBKAPAAADC" +
        "wECgAcCAjgEAwEeAxQBAQECDwEBAQIBAAMBBQQEQAAAAA==";
      const data = JSON.parse(`{
        "type": "camera",
        "controllerData": {
          "data": {
            "streamManagements": [{
              "id": 1,
              "active": false
            }],
            "recordingManagement": {
              "configurationHash": {
                "algorithm": "sha256",
                "hash": "e1e3ae4966b9421850246b1842969d783b63796b97bfdccdc2937ea0472c6838"
              },
              "selectedConfiguration": "${selectedConfiguration}",
              "recordingActive": true,
              "recordingAudioActive": true,
              "eventSnapshotsActive": false,
              "homeKitCameraActive": false,
              "periodicSnapshotsActive": false
            }
          }
        }
      }`);

      controller.deserialize(data.controllerData.data);

      expect(controller.streamManagements[0].service.getCharacteristic(Characteristic.Active).value)
        .toBe(Characteristic.Active.ACTIVE);
      expect(controller.streamManagements[1].service.getCharacteristic(Characteristic.Active).value)
        .toBe(Characteristic.Active.INACTIVE);

      // @ts-expect-error (private access)
      expect(controller.recordingManagement!.selectedConfiguration)
        .toBeUndefined(); // the hash is from a different configuration, we expect to drop selected config when the supported configuration changes!

      expect(controller.recordingManagement?.recordingManagementService.getCharacteristic(Characteristic.Active).value)
        .toBe(Characteristic.Active.ACTIVE);
      expect(controller.recordingManagement?.recordingManagementService.getCharacteristic(Characteristic.RecordingAudioActive).value)
        .toBe(1);

      expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value)
        .toBe(Characteristic.HomeKitCameraActive.OFF);
      expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.PeriodicSnapshotsActive).value)
        .toBe(0);
      expect(controller.recordingManagement?.operatingModeService.getCharacteristic(Characteristic.EventSnapshotsActive).value)
        .toBe(0);
    });
  });

  describe("handleFactoryReset", () => {
    test("default configuration", () => {
      const serialized0 = controller.serialize();
      controller.handleFactoryReset();
      const serialized1 = controller.serialize();

      expect(serialized0).toEqual(serialized1);
    });
  });
});
