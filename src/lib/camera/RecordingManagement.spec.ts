import { Characteristic } from "../Characteristic";
import { AudioBitrate } from "../controller";
import { MockDelegate, mockRecordingOptions } from "../controller/CameraController.spec";
import {
  AudioRecordingCodecType,
  AudioRecordingSamplerate,
  CameraRecordingConfiguration,
  EventTriggerOption,
  MediaContainerType,
  RecordingManagement,
} from "./RecordingManagement";
import { H264Level, H264Profile, VideoCodecType } from "./RTPStreamManagement";

describe("RecordingManagement", () => {
  test("handleSelectedCameraRecordingConfiguration", () => {
    const base64Input = "AR0BBKAPAAACCAEAAAAAAAAAAwsBAQACBgEEoA8AAAIkAQEAAhIBAQECAQIDBNAHAAAEBKAPAAADCwECsAQCAkAGAwEYAxQBAQACDwEBAQIBAAMBAwQEQAAAAA==";

    const management = new RecordingManagement(
      mockRecordingOptions,
      new MockDelegate(),
      new Set([EventTriggerOption.MOTION, EventTriggerOption.DOORBELL]),
    );

    // @ts-expect-error: private access
    management.handleSelectedCameraRecordingConfigurationWrite(base64Input);

    // @ts-expect-error: private access
    expect(management.handleSelectedCameraRecordingConfigurationRead())
      .toEqual(base64Input);

    // @ts-expect-error: private access
    const configuration = management.selectedConfiguration;
    expect(configuration).toBeDefined();
    expect(configuration!.base64).toEqual(base64Input);

    const expected: CameraRecordingConfiguration = {
      prebufferLength: 4000,
      eventTriggerTypes: [ EventTriggerOption.MOTION ],
      mediaContainerConfiguration: { type: MediaContainerType.FRAGMENTED_MP4, fragmentLength: 4000 },
      videoCodec: {
        type: VideoCodecType.H264,
        parameters: {
          profile: H264Profile.MAIN,
          level: H264Level.LEVEL4_0,
          bitRate: 2000,
          iFrameInterval: 4000,
        },
        resolution: [ 1200, 1600, 24 ],
      },
      audioCodec: {
        type: AudioRecordingCodecType.AAC_LC,
        audioChannels: 1,
        samplerate: AudioRecordingSamplerate.KHZ_32,
        bitrateMode: AudioBitrate.VARIABLE,
        bitrate: 64,
      },
    };
    expect(configuration!.parsed).toEqual(expected);
  });

  test("test supported configuration", () => {
    const management = new RecordingManagement(
      {
        prebufferLength: 8000,
        mediaContainerConfiguration: {
          type: MediaContainerType.FRAGMENTED_MP4,
          fragmentLength: 4000,
        },
        video: {
          type: VideoCodecType.H264,
          parameters: {
            profiles: [H264Profile.MAIN],
            levels: [H264Level.LEVEL3_1, H264Level.LEVEL4_0],
          },
          resolutions: [
            [1600, 1200, 24],
            [1440, 1080, 24],
            [1280, 960, 24],
            [1024, 768, 24],
            [1600, 1200, 15],
            [1440, 1080, 15],
            [1280, 960, 15],
            [1024, 768, 15],
            [1200, 1600, 24],
            [1080, 1440, 24],
            [960, 1280, 24],
            [768, 1024, 24],
            [1200, 1600, 15],
            [1080, 1440, 15],
            [960, 1280, 15],
            [768, 1024, 15],
          ],
        },
        audio: {
          codecs: [{
            type: AudioRecordingCodecType.AAC_LC,
            audioChannels: 1,
            bitrateMode: AudioBitrate.VARIABLE,
            samplerate: AudioRecordingSamplerate.KHZ_32,
          }],
        },
      },
      new MockDelegate(),
      new Set([EventTriggerOption.MOTION, EventTriggerOption.DOORBELL]),
    );

    const supportedRecording = management.recordingManagementService
      .getCharacteristic(Characteristic.SupportedCameraRecordingConfiguration).value;
    const supportedVideo = management.recordingManagementService
      .getCharacteristic(Characteristic.SupportedVideoRecordingConfiguration).value;
    const supportedAudio = management.recordingManagementService
      .getCharacteristic(Characteristic.SupportedAudioRecordingConfiguration).value;

    expect(supportedRecording).toEqual("AQRAHwAAAggDAAAAAAAAAAMLAQEAAgYBBKAPAAA=");
    expect(supportedVideo).toEqual("Af4BAQACCwEBAQIBAAAAAgECAwsBAkAGAgKwBAMBGAAAAwsBAqAFAgI4BAMBGAAAAwsBAgAFAgLAAwMBGAAAAwsBAgAEAgIAAwMBGAAAAwsBAk" +
      "AGAgKwBAMBDwAAAwsBAqAFAgI4BAMBDwAAAwsBAgAFAgLAAwMBDwAAAwsBAgAEAgIAAwMBDwAAAwsBArAEAgJABgMBGAAAAwsBAjgEAgKgBQMBGAAAAwsBAsADAgIABQMBGAAAAwsBAgADAgIABA" +
      "MBGAAAAwsBArAEAgJABgMBDwAAAwsBAjgEAgKgBQMBDwAAAwsBAsADAgIABQMBDwAAAwsBAgADAgIABAMBDw==");
    expect(supportedAudio).toEqual("AQ4BAQACCQEBAQIBAAMBAw==");
  });
});
