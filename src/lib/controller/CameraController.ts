import crypto from "crypto";
import createDebug from "debug";
import { EventEmitter } from "events";
import { ResourceRequestReason } from "../../internal-types";
import { CharacteristicValue, SessionIdentifier } from "../../types";
import {
  CameraRecordingConfiguration,
  CameraRecordingOptions,
  CameraStreamingOptions,
  EventTriggerOption,
  LegacyCameraSourceAdapter,
  PrepareStreamRequest,
  PrepareStreamResponse,
  RecordingManagement,
  RecordingManagementState,
  RTPStreamManagement,
  RTPStreamManagementState,
  SnapshotRequest,
  StreamingRequest,
} from "../camera";
import { Characteristic, CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback } from "../Characteristic";
import { DataSendCloseReason, DataStreamManagement } from "../datastream";
import {
  CameraOperatingMode,
  CameraRecordingManagement,
  DataStreamTransportManagement,
  Doorbell,
  Microphone,
  MotionSensor,
  Speaker,
} from "../definitions";
import { HAPStatus } from "../HAPServer";
import { Service } from "../Service";
import { HapStatusError } from "../util/hapStatusError";
import { ControllerIdentifier, ControllerServiceMap, DefaultControllerType, SerializableController, StateChangeDelegate } from "./Controller";

const debug = createDebug("HAP-NodeJS:Camera:Controller")

export interface CameraControllerOptions {
  /**
   * Amount of parallel camera streams the accessory is capable of running.
   * As of the official HAP specification non Secure Video cameras have a minimum required amount of 2 (but 1 is also fine).
   * Secure Video cameras just expose 1 stream.
   *
   * Default value: 1
   */
  cameraStreamCount?: number,

  /**
   * Delegate which handles the actual RTP/RTCP video/audio streaming and Snapshot requests.
   */
  delegate: CameraStreamingDelegate,

  /**
   * Options regarding video/audio streaming
   */
  streamingOptions: CameraStreamingOptions,

  recording?: {
    /**
     * Options regarding Recordings (Secure Video)
     */
    options: CameraRecordingOptions, // TODO motion service shouldn't be a recording option

    /**
      * Delegate which handles the audio/video recording data streaming on motion.
      */
    delegate: CameraRecordingDelegate,
  }

  // TODO motion and occupancy sensor?
}

export type SnapshotRequestCallback = (error?: Error | HAPStatus, buffer?: Buffer) => void;
export type PrepareStreamCallback = (error?: Error, response?: PrepareStreamResponse) => void;
export type StreamRequestCallback = (error?: Error) => void;

export interface CameraStreamingDelegate {

  /**
   * This method is called when a HomeKit controller requests a snapshot image for the given camera.
   * The handler must respect the desired image height and width given in the {@link SnapshotRequest}.
   * The returned Buffer (via the callback) must be encoded in jpeg.
   *
   * HAP-NodeJS will complain about slow running handlers after 5 seconds and terminate the request after 15 seconds.
   *
   * @param request - Request containing image size.
   * @param callback - Callback supplied with the resulting Buffer
   */
  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void;

  prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void;
  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void;

}

/**
 * A `CameraRecordingDelegate` is responsible for handling recordings of a HomeKit Secure Video camera.
 *
 * It is responsible for maintaining the prebuffer (see {@see CameraRecordingOptions.prebufferLength}.
 * Once
 */
export interface CameraRecordingDelegate {
  // TODO signal active (MUST be called after updateRecordingConfiguration and before when disabling)!!

  /**
   * TODO consider non active by default!
   * always called AFTEr update recording configuration(?) TODO would be a great guarantee to make
   */
  updateRecordingActive(active: boolean): void;

  // TODO maybe reintroduce the configuration stuff! (todo, init recording info from storage!!!)
  // TODO if configuration change occurs while recording is still in progress,
  //  active recording stream must continue to use the previous configuration
  updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined, audioActive: boolean): void;

  /**
   * HomeKit requests to receive the video (and audio, if enabled) recordings of
   * the current ongoing motion (or doorbell) event.
   * The first fragment must always be the "mediaInitialization" fragment.
   * All subsequent fragments are "mediaFragment"s.
   * Each "mediaFragment" must start with a key frame and must not be longer than the
   * specified duration set via the "fragmentLength" (which was SELECTED by the HomeKit Home Hub).
   *
   * @returns AsyncIterator of Readables representing each fragment.
   */
  // handleFragmentsRequests(connection: DataStreamConnection): AsyncGenerator<Buffer>;

  /*
  /**
    * This method is called when the camera recording configuration is set or changed
    * by HomeKit.
    * The handler must respect the desired audio and video configuration during
    * subsequenct calls to handleFragmentRequests.
    * @param configuration
    *
  prepareRecording?(configuration: CameraRecordingConfiguration): void;
   */

  handleRecordingStreamRequest(streamId: number): AsyncGenerator<Buffer>; // TODO is the connection necessary?

  // TODO method to signal that thing was closed (also for normal close)!
  closeRecordingStream(streamId: number, reason: DataSendCloseReason): void; // TODO rename the type before heavy usage!
}

/**
 * @private
 */
export interface CameraControllerServiceMap extends ControllerServiceMap {
  // "streamManagement%d": CameraRTPStreamManagement, // format to map all stream management services; indexed by zero

  microphone?: Microphone,
  speaker?: Speaker,

  cameraEventRecordingManagement?: CameraRecordingManagement,
  cameraOperatingMode?: CameraOperatingMode,
  dataStreamTransportManagement?: DataStreamTransportManagement,

  motionService?: MotionSensor,

  // this ServiceMap is also used by the DoorbellController; there is no necessity to declare it,
  // but I think its good practice to reserve the namespace
  doorbell?: Doorbell;
}

interface CameraControllerState {
  // TODO document indexes
  streamManagements: RTPStreamManagementState[];
  recordingManagement?: RecordingManagementState;
}

export const enum CameraControllerEvents {
  /**
   *  Emitted when the mute state or the volume changed. The Apple Home App typically does not set those values
   *  except the mute state. When you adjust the volume in the Camera view it will reset the muted state if it was set previously.
   *  The value of volume has nothing to do with the volume slider in the Camera view of the Home app.
   */
  MICROPHONE_PROPERTIES_CHANGED = "microphone-change",
  /**
   * Emitted when the mute state or the volume changed. The Apple Home App typically does not set those values
   * except the mute state. When you unmute the device microphone it will reset the mute state if it was set previously.
   */
  SPEAKER_PROPERTIES_CHANGED = "speaker-change",
}

export declare interface CameraController {
  on(event: "microphone-change", listener: (muted: boolean, volume: number) => void): this;
  on(event: "speaker-change", listener: (muted: boolean, volume: number) => void): this;

  emit(event: "microphone-change", muted: boolean, volume: number): boolean;
  emit(event: "speaker-change", muted: boolean, volume: number): boolean;
}

/**
 * Everything needed to expose a HomeKit Camera.
 */
export class CameraController extends EventEmitter implements SerializableController<CameraControllerServiceMap, CameraControllerState> {
  private static readonly STREAM_MANAGEMENT = "streamManagement"; // key to index all RTPStreamManagement services

  private stateChangeDelegate?: StateChangeDelegate;

  private readonly streamCount: number;
  private readonly delegate: CameraStreamingDelegate;
  private readonly streamingOptions: CameraStreamingOptions;
  /**
   * **Temporary** storage for {@link CameraRecordingOptions} and {@link CameraRecordingDelegate}.
   * This property is reset to `undefined` after the CameraController was fully initialized.
   * You can still access those values via the {@link CameraController.recordingManagement}.
   */
  private recording?: {
    options: CameraRecordingOptions,
    delegate: CameraRecordingDelegate,
  }
  private readonly legacyMode: boolean = false;

  /**
   * @private
   */
  streamManagements: RTPStreamManagement[] = [];
  /**
   * The {@link RecordingManagement} which is responsible for handling HomeKit Secure Video.
   * This property is only present if recording was configured.
   */
  recordingManagement?: RecordingManagement;

  private microphoneService?: Microphone;
  private speakerService?: Speaker;

  private microphoneMuted: boolean = false;
  private microphoneVolume: number = 100;
  private speakerMuted: boolean = false;
  private speakerVolume: number = 100;

  // TODO move the motion sensor?
  motionService?: MotionSensor;

  constructor(options: CameraControllerOptions, legacyMode: boolean = false) {
    super();
    this.streamCount = Math.max(1, options.cameraStreamCount || 1);
    this.delegate = options.delegate;
    this.streamingOptions = options.streamingOptions;
    this.recording = options.recording;

    this.legacyMode = legacyMode; // legacy mode will prent from Microphone and Speaker services to get created to avoid collisions
  }

  /**
   * @private
   */
  controllerId(): ControllerIdentifier {
    return DefaultControllerType.CAMERA;
  }

  // ----------------------------------- STREAM API ------------------------------------

  /**
   * Call this method if you want to forcefully suspend an ongoing streaming session.
   * This would be adequate if the rtp server or media encoding encountered an unexpected error.
   *
   * @param sessionId {SessionIdentifier} - id of the current ongoing streaming session
   */
  public forceStopStreamingSession(sessionId: SessionIdentifier) {
    this.streamManagements.forEach(management => {
      if (management.sessionIdentifier === sessionId) {
        management.forceStop();
      }
    });
  }

  public static generateSynchronisationSource() {
    const ssrc = crypto.randomBytes(4); // range [-2.14748e+09 - 2.14748e+09]
    ssrc[0] = 0;
    return ssrc.readInt32BE(0);
  }

  // ----------------------------- MICROPHONE/SPEAKER API ------------------------------

  public setMicrophoneMuted(muted: boolean = true) {
    if (!this.microphoneService) {
      return;
    }

    this.microphoneMuted = muted;
    this.microphoneService.updateCharacteristic(Characteristic.Mute, muted);
  }

  public setMicrophoneVolume(volume: number) {
    if (!this.microphoneService) {
      return;
    }

    this.microphoneVolume = volume;
    this.microphoneService.updateCharacteristic(Characteristic.Volume, volume);
  }

  public setSpeakerMuted(muted: boolean = true) {
    if (!this.speakerService) {
      return;
    }

    this.speakerMuted = muted;
    this.speakerService.updateCharacteristic(Characteristic.Mute, muted);
  }

  public setSpeakerVolume(volume: number) {
    if (!this.speakerService) {
      return;
    }

    this.speakerVolume = volume;
    this.speakerService.updateCharacteristic(Characteristic.Volume, volume);
  }

  private emitMicrophoneChange() {
    this.emit(CameraControllerEvents.MICROPHONE_PROPERTIES_CHANGED, this.microphoneMuted, this.microphoneVolume);
  }

  private emitSpeakerChange() {
    this.emit(CameraControllerEvents.SPEAKER_PROPERTIES_CHANGED, this.speakerMuted, this.speakerVolume);
  }

  // -----------------------------------------------------------------------------------

  /**
   * @private
   */
  constructServices(): CameraControllerServiceMap {
    for (let i = 0; i < this.streamCount; i++) {
      const rtp = new RTPStreamManagement(i, this.streamingOptions, this.delegate);
      this.streamManagements.push(rtp);
    }

    if (!this.legacyMode && this.streamingOptions.audio) {
      // In theory the Microphone Service is a necessity. In practice, it's not. lol.
      // So we just add it if the user wants to support audio
      this.microphoneService = new Service.Microphone('', '');
      this.microphoneService.setCharacteristic(Characteristic.Volume, this.microphoneVolume);

      if (this.streamingOptions.audio.twoWayAudio) {
        this.speakerService = new Service.Speaker('', '');
        this.speakerService.setCharacteristic(Characteristic.Volume, this.speakerVolume);
      }
    }

    if (this.recording) {
      this.recordingManagement = new RecordingManagement(this.recording.options, this.recording.delegate, this.retrieveEventTriggerOptions());

      if (this.recording.options.motionService) {
        this.motionService = new MotionSensor('', '');
        this.motionService.setCharacteristic(Characteristic.Active, 1);

        this.recordingManagement.getServices().recordingManagement.addLinkedService(this.motionService);
      }
    }


    const serviceMap: CameraControllerServiceMap = {
      microphone: this.microphoneService,
      speaker: this.speakerService,
      motionService: this.motionService,
    };

    if (this.recordingManagement) {
      const services = this.recordingManagement.getServices();
      serviceMap.cameraEventRecordingManagement = services.recordingManagement;
      serviceMap.cameraOperatingMode = services.operatingMode;
      serviceMap.dataStreamTransportManagement = services.dataStreamManagement.getService();
    }

    this.streamManagements.forEach((management, index) => {
      serviceMap[CameraController.STREAM_MANAGEMENT + index] = management.getService();
    });

    this.recording = undefined;

    return serviceMap;
  }

  /**
   * @private
   */
  initWithServices(serviceMap: CameraControllerServiceMap): void | CameraControllerServiceMap {
    let modifiedServiceMap = false;

    for (let i = 0; true; i++) {
      let streamManagementService = serviceMap[CameraController.STREAM_MANAGEMENT + i];

      if (i < this.streamCount) {
        if (streamManagementService) { // normal init
          this.streamManagements.push(new RTPStreamManagement(i, this.streamingOptions, this.delegate, streamManagementService));
        } else { // stream count got bigger, we need to create a new service
          const management = new RTPStreamManagement(i, this.streamingOptions, this.delegate);

          this.streamManagements.push(management);
          serviceMap[CameraController.STREAM_MANAGEMENT + i] = management.getService();

          modifiedServiceMap = true;
        }
      } else {
        if (streamManagementService) { // stream count got reduced, we need to remove old service
          delete serviceMap[CameraController.STREAM_MANAGEMENT + i];
          modifiedServiceMap = true;
        } else {
          break; // we finished counting, and we got no saved service; we are finished
        }
      }
    }

    // MICROPHONE
    if (!this.legacyMode && this.streamingOptions.audio) { // microphone should be present
      if (serviceMap.microphone) {
        this.microphoneService = serviceMap.microphone;
      } else {
        // microphone wasn't created yet => create a new one
        this.microphoneService = new Service.Microphone('', '');
        this.microphoneService.setCharacteristic(Characteristic.Volume, this.microphoneVolume);

        serviceMap.microphone = this.microphoneService;
        modifiedServiceMap = true;
      }
    } else if (serviceMap.microphone) { // microphone service supplied, though settings seemed to have changed
      // we need to remove it
      delete serviceMap.microphone;
      modifiedServiceMap = true;
    }

    // SPEAKER
    if (!this.legacyMode && this.streamingOptions.audio?.twoWayAudio) { // speaker should be present
      if (serviceMap.speaker) {
        this.speakerService = serviceMap.speaker;
      } else {
        // speaker wasn't created yet => create a new one
        this.speakerService = new Service.Speaker('', '');
        this.speakerService.setCharacteristic(Characteristic.Volume, this.speakerVolume);

        serviceMap.speaker = this.speakerService;
        modifiedServiceMap = true;
      }
    } else if (serviceMap.speaker) { // speaker service supplied, though settings seemed to have changed
      // we need to remove it
      delete serviceMap.speaker;
      modifiedServiceMap = true;
    }

    // RECORDING
    if (this.recording) {
      let eventTriggers = this.retrieveEventTriggerOptions();

      // RECORDING MANAGEMENT
      if (serviceMap.cameraEventRecordingManagement && serviceMap.cameraOperatingMode && serviceMap.dataStreamTransportManagement) {
        this.recordingManagement = new RecordingManagement(
          this.recording.options,
          this.recording.delegate,
          eventTriggers,
          {
            recordingManagement: serviceMap.cameraEventRecordingManagement,
            operatingMode: serviceMap.cameraOperatingMode,
            dataStreamManagement: new DataStreamManagement(serviceMap.dataStreamTransportManagement),
          }
        );
      } else {
        this.recordingManagement = new RecordingManagement(
          this.recording.options,
          this.recording.delegate,
          eventTriggers
        );

        let services = this.recordingManagement.getServices();
        serviceMap.cameraEventRecordingManagement = services.recordingManagement;
        serviceMap.cameraOperatingMode = services.operatingMode;
        serviceMap.dataStreamTransportManagement = services.dataStreamManagement.getService();
        modifiedServiceMap = true;
      }

      // MOTION SERVICE
      if (this.recording.options.motionService && !serviceMap.motionService) {
        this.motionService = new Service.MotionSensor('', '');
        serviceMap.motionService = this.motionService
        modifiedServiceMap = true;
      } else if (!this.recording.options.motionService && serviceMap.motionService) {
        delete serviceMap.motionService;
        modifiedServiceMap = true;
      }
    } else {
      if (serviceMap.cameraEventRecordingManagement) {
        delete serviceMap.cameraEventRecordingManagement;
        modifiedServiceMap = true;
      }
      if (serviceMap.cameraOperatingMode) {
        delete serviceMap.cameraOperatingMode;
        modifiedServiceMap = true;
      }
      if (serviceMap.dataStreamTransportManagement) {
        delete serviceMap.dataStreamTransportManagement;
        modifiedServiceMap = true;
      }
      if (serviceMap.motionService) {
        delete serviceMap.motionService;
        modifiedServiceMap = true;
      }
    }

    if (this.migrateFromDoorbell(serviceMap)) {
      modifiedServiceMap = true;
    }

    this.recording = undefined;

    if (modifiedServiceMap) { // serviceMap must only be returned if anything actually changed
      return serviceMap;
    }
  }

  // overwritten in DoorbellController (to avoid cyclic dependencies, I hate typescript for that)
  protected migrateFromDoorbell(serviceMap: ControllerServiceMap): boolean {
    if (serviceMap.doorbell) { // See NOTICE in DoorbellController
      delete serviceMap.doorbell;
      return true;
    }

    return false;
  }

  protected retrieveEventTriggerOptions(): Set<EventTriggerOption> {
    if (!this.recording) {
      return new Set()
    }

    const triggerOptions = new Set<EventTriggerOption>();

    if (this.recording.options.overrideEventTriggerOptions) {
      for (const option of this.recording.options.overrideEventTriggerOptions) {
        triggerOptions.add(option);
      }
    }

    // TODO revise heuristic, once we have revised the situation around passing motion sensors
    if (this.recording.options.motionService) {
      triggerOptions.add(EventTriggerOption.MOTION);
    }

    // this method is overwritten by the `DoorbellController` to automatically configure EventTriggerOption.DOORBELL

    return triggerOptions
  }

  /**
   * @private
   */
  configureServices(): void {
    if (this.microphoneService) {
      this.microphoneService.getCharacteristic(Characteristic.Mute)!
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          callback(undefined, this.microphoneMuted);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.microphoneMuted = value as boolean;
          callback();
          this.emitMicrophoneChange();
        });
      this.microphoneService.getCharacteristic(Characteristic.Volume)!
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          callback(undefined, this.microphoneVolume);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.microphoneVolume = value as number;
          callback();
          this.emitMicrophoneChange();
        });
    }

    if (this.speakerService) {
      this.speakerService.getCharacteristic(Characteristic.Mute)!
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          callback(undefined, this.speakerMuted);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.speakerMuted = value as boolean;
          callback();
          this.emitSpeakerChange();
        });
      this.speakerService.getCharacteristic(Characteristic.Volume)!
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          callback(undefined, this.speakerVolume);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.speakerVolume = value as number;
          callback();
          this.emitSpeakerChange();
        });
    }
  }

  /**
   * @private
   */
  handleControllerRemoved(): void {
    this.handleFactoryReset();

    for (const management of this.streamManagements) {
      management.destroy();
    }
    this.streamManagements.splice(0, this.streamManagements.length);

    this.microphoneService = undefined;
    this.speakerService = undefined;

    this.recordingManagement?.destroy();
    this.recordingManagement = undefined;

    this.removeAllListeners();
  }

  /**
   * @private
   */
  handleFactoryReset(): void {
    this.streamManagements.forEach(management => management.handleFactoryReset());
    this.recordingManagement?.handleFactoryReset();

    this.microphoneMuted = false;
    this.microphoneVolume = 100;
    this.speakerMuted = false;
    this.speakerVolume = 100;
  }

  /**
   * @private
   */
  serialize(): CameraControllerState | undefined {
    const streamManagementStates: RTPStreamManagementState[] = [];

    for (const management of this.streamManagements) {
      const serializedState = management.serialize();
      if (serializedState) {
        streamManagementStates.push(serializedState);
      }
    }

    return {
      streamManagements: streamManagementStates,
      recordingManagement: this.recordingManagement?.serialize(),
    };
  }

  /**
   * @private
   */
  deserialize(serialized: CameraControllerState): void {
    for (const streamManagementState of serialized.streamManagements) {
      const streamManagement = this.streamManagements[streamManagementState.id];
      if (streamManagement) {
        streamManagement.deserialize(streamManagementState);
      }
    }

    if (serialized.recordingManagement) {
      this.recordingManagement?.deserialize(serialized.recordingManagement);
    }
  }

  /**
   * @private
   */
  setupStateChangeDelegate(delegate?: StateChangeDelegate): void {
    this.stateChangeDelegate = delegate;

    for (const streamManagement of this.streamManagements) {
      streamManagement.setupStateChangeDelegate(delegate);
    }

    this.recordingManagement?.setupStateChangeDelegate(delegate);
  }

  /**
   * @private
   */
  handleSnapshotRequest(height: number, width: number, accessoryName?: string, reason?: ResourceRequestReason): Promise<Buffer> {
    // first step is to verify that the reason is applicable to our current policy
    const streamingDisabled = this.streamManagements
      .map(management => !management.getService().getCharacteristic(Characteristic.Active).value)
      .reduce((previousValue, currentValue) => previousValue && currentValue);
    if (streamingDisabled) { // TODO test case!
      return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }

    if (this.recordingManagement) { // TODO log rejections!
      let operatingModeService = this.recordingManagement.operatingModeService
      if (!operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value) { // TODO test case
        return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
      }

      let eventSnapshotsActive = operatingModeService
        .getCharacteristic(Characteristic.EventSnapshotsActive)
        .value
      if (!eventSnapshotsActive) {
        if (reason == null) {
          return Promise.reject(HAPStatus.INSUFFICIENT_PRIVILEGES);
        } else if (reason == ResourceRequestReason.EVENT) {
          return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
        }
      }

      let periodicSnapshotsActive = operatingModeService
        .getCharacteristic(Characteristic.PeriodicSnapshotsActive)
        .value
      if (!periodicSnapshotsActive) {
        if (reason == null) {
          return Promise.reject(HAPStatus.INSUFFICIENT_PRIVILEGES);
        } else if (reason == ResourceRequestReason.PERIODIC) {
          return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
        }
      }
    }

    // now do the actual snapshot request.
    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn(`[${accessoryName}] The image snapshot handler for the given accessory is slow to respond! See https://git.io/JtMGR for more info.`);

        timeout = setTimeout(() => {
          timeout = undefined;

          console.warn(`[${accessoryName}] The image snapshot handler for the given accessory didn't respond at all! See https://git.io/JtMGR for more info.`);

          reject(HAPStatus.OPERATION_TIMED_OUT);
        }, 17000);
        timeout.unref();
      }, 5000);
      timeout.unref();

      try {
        this.delegate.handleSnapshotRequest({
          height: height,
          width: width,
          reason: reason,
        }, (error, buffer) => {
          if (!timeout) {
            return;
          } else {
            clearTimeout(timeout);
            timeout = undefined;
          }

          if (error) {
            if (typeof error === "number") {
              reject(error);
            } else {
              debug("[%s] Error getting snapshot: %s", accessoryName, error.stack);
              reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
            }
            return;
          }

          if (!buffer || buffer.length === 0) {
            console.warn(`[${accessoryName}] Snapshot request handler provided empty image buffer!`);
            reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
          } else {
            resolve(buffer);
          }
        });
      } catch (error) {
        if (!timeout) {
          return;
        } else {
          clearTimeout(timeout);
          timeout = undefined;
        }

        console.warn(`[${accessoryName}] Unhandled error thrown inside snapshot request handler: ${error.stack}`);
        reject(error instanceof HapStatusError ? error.hapStatus : HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    });
  }

  /**
   * @private
   */
  handleCloseConnection(sessionID: SessionIdentifier): void {
    if (this.delegate instanceof LegacyCameraSourceAdapter) {
      this.delegate.forwardCloseConnection(sessionID);
    }
  }

}
