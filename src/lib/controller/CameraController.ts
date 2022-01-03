import crypto from "crypto";
import createDebug from "debug";
import { EventEmitter } from "events";
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
  RecordingManagementState, RecordingPacket,
  RTPStreamManagement,
  RTPStreamManagementState,
  SnapshotRequest,
  StreamingRequest,
} from "../camera";
import { Characteristic, CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback } from "../Characteristic";
import { HDSProtocolSpecificErrorReason, DataStreamManagement } from "../datastream";
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
   * As of the official HAP specification non SecureVideo cameras have a minimum required amount of 2 (but 1 is also fine).
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

export const enum ResourceRequestReason {
  /**
   * The reason describes periodic resource requests.
   * In the example of camera image snapshots those are the typical preview images every 10 seconds.
   */
  PERIODIC = 0,
  /**
   * The resource request is the result of some event.
   * In the example of camera image snapshots, requests are made due to e.g. a motion event or similar.
   */
  EVENT = 1
}

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
 * It is responsible for maintaining the prebuffer (see {@see CameraRecordingOptions.prebufferLength},
 * once recording was activated (see {@see updateRecordingActive}).
 *
 * Before recording is considered enabled two things must happen:
 * - Recording must be enabled by the user. Signaled through {@link updateRecordingActive}.
 * - Recording configurations must be selected by a HomeKit controller through {@link updateRecordingConfiguration}.
 *
 * A typical recording event scenario happens as follows:
 * - The camera is in idle mode, maintaining the prebuffer (the duration of the prebuffer depends on the selected {@link CameraRecordingConfiguration}).
 * - A recording event is triggered (e.g. motion or doorbell button press) and the camera signals it through
 *   the respective characteristics (e.g. {@link Characteristic.MotionDetected} or {@link Characteristic.ProgrammableSwitchEvent}).
 *   Further, the camera saves the content of the prebuffer and starts recording the video.
 *   The camera should continue to store the recording until it runs out of space.
 *   In any case the camera should preserve recordings which are nearest to the triggered event.
 *   A stored recording might be completely deleted if a stream request wasn't initiated for eight seconds.
 * - A HomeKit Controller will open a new recording session to download the next recording.
 *   This results in a call to {@link handleRecordingStreamRequest}.
 * - Once the recording event is finished the camera will reset the state accordingly
 *   (e.g. in the {@link Service.MotionSensor} or {@link Service.Doorbell} service).
 *   It will continue to send the remaining fragments of the currently ongoing recording stream request.
 * - The camera goes back into idle mode.
 */
export interface CameraRecordingDelegate { // TODO catch errors of all those calls!
  /**
   * A call to this method notifies the `CameraRecordingDelegate` about a change to the
   * `CameraRecordingManagement.Active` characteristic. This characteristic controls
   * if the camera should react to recording events.
   *
   * If recording is disabled the camera can stop maintaining its prebuffer.
   * If recording is enabled the camera should start recording into its prebuffer.
   *
   * A `CameraRecordingDelegate` should assume active to be `false` on first initialization.
   * HAP-NodeJS will persist the state of the `Active` characteristic across reboots
   * and will call {@link updateRecordingActive} accordingly, if recording was previously enabled.
   *
   * NOTE: HAP-NodeJS cannot guarantee that a {@link CameraRecordingConfiguration} is present
   * when recording is activated (e.g. the selected configuration might be erased due to changes
   * in the supplied {@link CameraRecordingOptions}, but the camera is still `active`; or we can't otherwise
   * influence the order which a HomeKit Controller might call those characteristics).
   * However, HAP-NodeJS guarantees that if there is a valid {@link CameraRecordingConfiguration},
   * {@link updateRecordingConfiguration} is called before {@link updateRecordingActive} (when enabling)
   * to avoid any unnecessary and potentially expensive reconfigurations.
   *
   * @param active - Specifies if recording is active or not.
   */
  updateRecordingActive(active: boolean): void;

  /**
   * A call to this method signals that the selected (by the HomeKit Controller)
   * recording configuration of the camera has changed.
   * The method is called if one of both or both values were changed.
   *
   * On startup the delegate should assume `configuration = undefined` and `audioActive = false`.
   * HAP-NodeJS will persist the state of both across reboots and will call
   * {@link updateRecordingConfiguration} if there is a **selected configuration** present.
   *
   * NOTE: An update to the recording configuration might happen while there is still a running
   * recording stream. The camera MUST continue to use the previous configuration for the
   * currently running stream and only apply the updated configuration to the next stream.
   *
   * @param configuration - The {@link CameraRecordingConfiguration}. Reconfigure your recording pipeline accordingly.
   *  The parameter might be `undefined` when the selected configuration became invalid. This typically ony happens
   *  e.g. due to a factory reset (when all pairings are removed). Disable the recording pipeline in such a case
   *  even if recording is still activated.
   * @param audioActive - Defines if the mp4 fragments include audio or not.
   *  TODO a bit weird that audioActive is marshalled into here!
   */
  updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined, audioActive: boolean): void;

  // TODO update documentation to the latest changes!

  /**
   * This method is called to stream the next recording event.
   * It is guaranteed that there is only ever one ongoing recording stream request at a time.
   * TODO depending on how slow yield is, it may overlap a bit with the last frame!
   *
   * TODO must try-catch yield in the current configuration!
   *
   * When this method is called return the currently ongoing (or next in case of a potentially queued)
   * recording via a `AsyncGenerator`. Every `yield` of the generator represents a complete recording `packet`.
   * The first packet MUST always be the {@link PacketDataType.MEDIA_INITIALIZATION} packet.
   * Any following packet will transport the actual mp4 fragments in {@link PacketDataType.MEDIA_FRAGMENT} packets,
   * starting with the content of the prebuffer. Every {@link PacketDataType.MEDIA_FRAGMENT} starts with a key frame
   * and must not be longer than the specified duration set via the {@link CameraRecordingConfiguration.mediaContainerConfiguration.fragmentLength}
   * **selected** by the HomeKit Controller in {@link updateRecordingConfiguration}.
   *
   * You might throw an error in this method if encountering a non-recoverable state.
   *
   * For more information about `AsyncGenerator`s you might have a look at:
   * * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
   *
   * TODO document yield throwing or closeRecrodingStream (immediate + if already completed)
   *   => you may rethrow the error!
   *
   * NOTE: HAP-NodeJS guarantees that this method is only called with a valid selected {@link CameraRecordingConfiguration}.
   *
   * @param streamId - The streamId of the currently ongoing stream.
   */
  handleRecordingStreamRequest(streamId: number): AsyncGenerator<RecordingPacket>; // TODO remove streamId as it may overlap if used with multiple controllers

  // TODO document
  acknowledgeStream?(streamId: number): void;

  /**
   * This method is called to notify the Delegate that a recording stream started via {@link handleRecordingStreamRequest}
   * was closed.
   *
   * The method is also called if an ongoing recording stream is closed gracefully (using {@link HDSProtocolSpecificErrorReason.NORMAL}).
   * In either case, the delegate should stop supplying further fragments to the recording stream.
   * HAP-NodeJS won't send out any fragments from this point onwards.
   *
   * TODO document yield throwing!
   *
   * @param streamId - The streamId for which the close event was sent.
   * @param reason - The reason with which the stream was closed.
   *  NOTE: This method is also called in case of a closed connection. This encoded by supplying `undefined` as the `reason`.
   */
  closeRecordingStream(streamId: number, reason?: HDSProtocolSpecificErrorReason): void; // TODO optional?
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
