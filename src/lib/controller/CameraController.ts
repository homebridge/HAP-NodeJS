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
  RecordingManagementState,
  RecordingPacket,
  RTPStreamManagement,
  RTPStreamManagementState,
  SnapshotRequest,
  StreamingRequest,
} from "../camera";
import { Characteristic, CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback } from "../Characteristic";
import { DataStreamManagement, HDSProtocolSpecificErrorReason } from "../datastream";
import {
  CameraOperatingMode,
  CameraRecordingManagement,
  DataStreamTransportManagement,
  Doorbell,
  Microphone,
  MotionSensor,
  OccupancySensor,
  Speaker,
} from "../definitions";
import { HAPStatus } from "../HAPServer";
import { Service } from "../Service";
import { HapStatusError } from "../util/hapStatusError";
import { ControllerIdentifier, ControllerServiceMap, DefaultControllerType, SerializableController, StateChangeDelegate } from "./Controller";

const debug = createDebug("HAP-NodeJS:Camera:Controller");

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

  /**
   * When supplying this option, it will enable support for HomeKit Secure Video.
   * This will create the {@link Service.CameraRecordingManagement}, {@link Service.CameraOperatingMode}
   * and {@link Service.DataStreamTransportManagement} services.
   *
   * NOTE: The controller only initializes the required characteristics for the {@link Service.CameraOperatingMode}.
   *   You may add optional characteristics, if required, by accessing the service directly {@link CameraController.recordingManagement.operatingModeService}.
   */
  recording?: {
    /**
     * Options regarding Recordings (Secure Video)
     */
    options: CameraRecordingOptions,

    /**
      * Delegate which handles the audio/video recording data streaming on motion.
      */
    delegate: CameraRecordingDelegate,
  }

  /**
   * This config section configures optional sensors for the camera.
   * It e.g. may be used to set up a {@link EventTriggerOption.MOTION} trigger when configuring Secure Video.
   *
   * You may either specify and provide the desired {@link Service}s or specify their creation and maintenance using a `boolean` flag.
   * In this case the controller will create and maintain the service for you.
   * Otherwise, when you supply an already created instance of the {@link Service}, you are responsible yourself to manage the service
   * (e.g. creating, restoring, adding to the accessory, ...).
   *
   * The services can be accessed through the documented property after the call to {@link Accessory.configureController} has returned.
   */
  sensors?: {
    /**
     * Define if a {@link Service.MotionSensor} should be created/associated with the controller.
     *
     * You may access the created service via the {@link CameraController.motionService} property to configure listeners.
     *
     * ## HomeKit Secure Video:
     *
     * If supplied, this sensor will be used as a {@link EventTriggerOption.MOTION} trigger.
     * The characteristic {@link Characteristic.StatusActive} will be added, which is used to enable or disable the sensor.
     */
    motion?: Service | boolean;
    /**
     * Define if a {@link Service.OccupancySensor} should be created/associated with the controller.
     *
     * You may access the created service via the {@link CameraController.occupancyService} property to configure listeners.
     *
     * ## HomeKit Secure Video:
     *
     * The characteristic {@link Characteristic.StatusActive} will be added, which is used to enable or disable the sensor.
     */
    occupancy?: Service | boolean;
  }
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
 * - The camera will either reach the end of the recording (and signal this via {@link RecordingPacket.isLast}. Also see {@link acknowledgeStream})
 *   or it will continue to stream til the HomeKit Controller closes
 *   the stream {@link closeRecordingStream with reason {@link HDSProtocolSpecificErrorReason.NORMAL}}.
 * - The camera goes back into idle mode.
 */
export interface CameraRecordingDelegate {
  /**
   * A call to this method notifies the `CameraRecordingDelegate` about a change to the
   * `CameraRecordingManagement.Active` characteristic. This characteristic controls
   * if the camera should react to recording events.
   *
   * If recording is disabled the camera can stop maintaining its prebuffer.
   * If recording is enabled the camera should start recording into its prebuffer.
   *
   * A `CameraRecordingDelegate` should assume active to be `false` on startup.
   * HAP-NodeJS will persist the state of the `Active` characteristic across reboots
   * and will call {@link updateRecordingActive} accordingly on startup, if recording was previously enabled.
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
   *
   * On startup the delegate should assume `configuration = undefined`.
   * HAP-NodeJS will persist the state of both across reboots and will call
   * {@link updateRecordingConfiguration} on startup if there is a **selected configuration** present.
   *
   * NOTE: An update to the recording configuration might happen while there is still a running
   * recording stream. The camera MUST continue to use the previous configuration for the
   * currently running stream and only apply the updated configuration to the next stream.
   *
   * @param configuration - The {@link CameraRecordingConfiguration}. Reconfigure your recording pipeline accordingly.
   *  The parameter might be `undefined` when the selected configuration became invalid. This typically ony happens
   *  e.g. due to a factory reset (when all pairings are removed). Disable the recording pipeline in such a case
   *  even if recording is still enabled for the camera.
   */
  updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined): void;

  /**
   * This method is called to stream the next recording event.
   * It is guaranteed that there is only ever one ongoing recording stream request at a time.
   *
   * When this method is called return the currently ongoing (or next in case of a potentially queued)
   * recording via a `AsyncGenerator`. Every `yield` of the generator represents a complete recording `packet`.
   * The first packet MUST always be the {@link PacketDataType.MEDIA_INITIALIZATION} packet.
   * Any following packet will transport the actual mp4 fragments in {@link PacketDataType.MEDIA_FRAGMENT} packets,
   * starting with the content of the prebuffer. Every {@link PacketDataType.MEDIA_FRAGMENT} starts with a key frame
   * and must not be longer than the specified duration set via the {@link CameraRecordingConfiguration.mediaContainerConfiguration.fragmentLength}
   * **selected** by the HomeKit Controller in {@link updateRecordingConfiguration}.
   *
   * NOTE: You MUST respect the value of {@link Characteristic.RecordingAudioActive} characteristic of the {@link Service.CameraOperatingMode}
   *   service. When the characteristic is set to false you MUST NOT include audio in the mp4 fragments. You can access the characteristic via
   *   the {@link CameraController.recordingManagement.operatingModeService} property.
   *
   * You might throw an error in this method if encountering a non-recoverable state.
   * You may throw a {@link HDSProtocolError} to manually define the {@link HDSProtocolSpecificErrorReason} for the `DATA_SEND` `CLOSE` event.
   *
   * There are three ways an ongoing recording stream can be closed:
   * - Closed by the Accessory: There are no further fragments to transmit. The delegate MUST signal this by setting {@link RecordingPacket.isLast}
   *   to `true`. Once the HomeKit Controller receives this last fragment it will call {@link acknowledgeStream} to notify the accessory about
   *   the successful transmission.
   * - Closed by the HomeKit Controller (expectedly): After the event trigger has been reset, the accessory continues to stream fragments.
   *   At some point the HomeKit Controller will decide to shut down the stream by calling {@link closeRecordingStream} with a reason
   *   of {@link HDSProtocolSpecificErrorReason.NORMAL}.
   * - Closed by the HomeKit Controller (unexpectedly): A HomeKit Controller might at any point decide to close a recording stream
   *   if it encounters erroneous state. This is signaled by a call to {@link closeRecordingStream} with the respective reason.
   *
   * Once a close of stream is signaled, the `AsyncGenerator` function must return gracefully.
   *
   * For more information about `AsyncGenerator`s you might have a look at:
   * * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
   *
   * NOTE: HAP-NodeJS guarantees that this method is only called with a valid selected {@link CameraRecordingConfiguration}.
   *
   * NOTE: Don't rely on the streamId for unique identification. Two {@link DataStreamConnection}s might share the same identifier space.
   *
   * @param streamId - The streamId of the currently ongoing stream.
   */
  handleRecordingStreamRequest(streamId: number): AsyncGenerator<RecordingPacket>;

  /**
   * This method is called once the HomeKit Controller acknowledges the `endOfStream`.
   * A `endOfStream` is sent by the accessory by setting {@link RecordingPacket.isLast} to `true` in the last packet yielded
   * by the {@link handleRecordingStreamRequest} `AsyncGenerator`.
   *
   * @param streamId - The streamId of the acknowledged stream.
   */
  acknowledgeStream?(streamId: number): void;

  /**
   * This method is called to notify the delegate that a recording stream started via {@link handleRecordingStreamRequest} was closed.
   *
   * The method is also called if an ongoing recording stream is closed gracefully (using {@link HDSProtocolSpecificErrorReason.NORMAL}).
   * In either case, the delegate should stop supplying further fragments to the recording stream.
   * The `AsyncGenerator` function must return without yielding any further {@link RecordingPacket}s.
   * HAP-NodeJS won't send out any fragments from this point onwards.
   *
   * @param streamId - The streamId for which the close event was sent.
   * @param reason - The reason with which the stream was closed.
   *  NOTE: This method is also called in case of a closed connection. This is encoded by setting the `reason` to undefined.
   */
  closeRecordingStream(streamId: number, reason: HDSProtocolSpecificErrorReason | undefined): void;
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
  occupancyService?: OccupancySensor,

  // this ServiceMap is also used by the DoorbellController; there is no necessity to declare it,
  // but I think its good practice to reserve the namespace
  doorbell?: Doorbell;
}

interface CameraControllerState {
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
  };
  /**
   * Temporary storage for the sensor option.
   */
  private sensorOptions?: {
    motion?: Service | boolean;
    occupancy?: Service | boolean;
  };
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

  private microphoneMuted = false;
  private microphoneVolume = 100;
  private speakerMuted = false;
  private speakerVolume = 100;

  motionService?: MotionSensor;
  private motionServiceExternallySupplied = false;
  occupancyService?: OccupancySensor;
  private occupancyServiceExternallySupplied = false;

  constructor(options: CameraControllerOptions, legacyMode = false) {
    super();
    this.streamCount = Math.max(1, options.cameraStreamCount || 1);
    this.delegate = options.delegate;
    this.streamingOptions = options.streamingOptions;
    this.recording = options.recording;
    this.sensorOptions = options.sensors;

    this.legacyMode = legacyMode; // legacy mode will prevent from Microphone and Speaker services to get created to avoid collisions
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
  public forceStopStreamingSession(sessionId: SessionIdentifier): void {
    this.streamManagements.forEach(management => {
      if (management.sessionIdentifier === sessionId) {
        management.forceStop();
      }
    });
  }

  public static generateSynchronisationSource(): number {
    const ssrc = crypto.randomBytes(4); // range [-2.14748e+09 - 2.14748e+09]
    ssrc[0] = 0;
    return ssrc.readInt32BE(0);
  }

  // ----------------------------- MICROPHONE/SPEAKER API ------------------------------

  public setMicrophoneMuted(muted = true): void {
    if (!this.microphoneService) {
      return;
    }

    this.microphoneMuted = muted;
    this.microphoneService.updateCharacteristic(Characteristic.Mute, muted);
  }

  public setMicrophoneVolume(volume: number): void {
    if (!this.microphoneService) {
      return;
    }

    this.microphoneVolume = volume;
    this.microphoneService.updateCharacteristic(Characteristic.Volume, volume);
  }

  public setSpeakerMuted(muted = true): void {
    if (!this.speakerService) {
      return;
    }

    this.speakerMuted = muted;
    this.speakerService.updateCharacteristic(Characteristic.Mute, muted);
  }

  public setSpeakerVolume(volume: number): void {
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
      const rtp = new RTPStreamManagement(i, this.streamingOptions, this.delegate, undefined, this.rtpStreamManagementDisabledThroughOperatingMode.bind(this));
      this.streamManagements.push(rtp);
    }

    if (!this.legacyMode && this.streamingOptions.audio) {
      // In theory the Microphone Service is a necessity. In practice, it's not. lol.
      // So we just add it if the user wants to support audio
      this.microphoneService = new Service.Microphone("", "");
      this.microphoneService.setCharacteristic(Characteristic.Volume, this.microphoneVolume);

      if (this.streamingOptions.audio.twoWayAudio) {
        this.speakerService = new Service.Speaker("", "");
        this.speakerService.setCharacteristic(Characteristic.Volume, this.speakerVolume);
      }
    }

    if (this.recording) {
      this.recordingManagement = new RecordingManagement(this.recording.options, this.recording.delegate, this.retrieveEventTriggerOptions());
    }


    if (this.sensorOptions?.motion) {
      if (typeof this.sensorOptions.motion === "boolean") {
        this.motionService = new Service.MotionSensor("", "");
      } else {
        this.motionService = this.sensorOptions.motion;
        this.motionServiceExternallySupplied = true;
      }

      this.motionService.setCharacteristic(Characteristic.StatusActive, true);
      this.recordingManagement?.recordingManagementService.addLinkedService(this.motionService);
    }

    if (this.sensorOptions?.occupancy) {
      if (typeof this.sensorOptions.occupancy === "boolean") {
        this.occupancyService = new Service.OccupancySensor("", "");
      } else {
        this.occupancyService = this.sensorOptions.occupancy;
        this.occupancyServiceExternallySupplied = true;
      }

      this.occupancyService.setCharacteristic(Characteristic.StatusActive, true);
      this.recordingManagement?.recordingManagementService.addLinkedService(this.occupancyService);
    }


    const serviceMap: CameraControllerServiceMap = {
      microphone: this.microphoneService,
      speaker: this.speakerService,
      motionService: !this.motionServiceExternallySupplied ? this.motionService : undefined,
      occupancyService: !this.occupancyServiceExternallySupplied ? this.occupancyService : undefined,
    };

    if (this.recordingManagement) {
      serviceMap.cameraEventRecordingManagement = this.recordingManagement.recordingManagementService;
      serviceMap.cameraOperatingMode = this.recordingManagement.operatingModeService;
      serviceMap.dataStreamTransportManagement = this.recordingManagement.dataStreamManagement.getService();
    }

    this.streamManagements.forEach((management, index) => {
      serviceMap[CameraController.STREAM_MANAGEMENT + index] = management.getService();
    });

    this.recording = undefined;
    this.sensorOptions = undefined;

    return serviceMap;
  }

  /**
   * @private
   */
  initWithServices(serviceMap: CameraControllerServiceMap): void | CameraControllerServiceMap {
    const result = this._initWithServices(serviceMap);

    if (result.updated) { // serviceMap must only be returned if anything actually changed
      return result.serviceMap;
    }
  }

  protected _initWithServices(serviceMap: CameraControllerServiceMap): { serviceMap: CameraControllerServiceMap, updated: boolean } {
    let modifiedServiceMap = false;

    // eslint-disable-next-line no-constant-condition
    for (let i = 0; true; i++) {
      const streamManagementService = serviceMap[CameraController.STREAM_MANAGEMENT + i];

      if (i < this.streamCount) {
        const operatingModeClosure = this.rtpStreamManagementDisabledThroughOperatingMode.bind(this);

        if (streamManagementService) { // normal init
          this.streamManagements.push(new RTPStreamManagement(i, this.streamingOptions, this.delegate, streamManagementService, operatingModeClosure));
        } else { // stream count got bigger, we need to create a new service
          const management = new RTPStreamManagement(i, this.streamingOptions, this.delegate, undefined, operatingModeClosure);

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
        this.microphoneService = new Service.Microphone("", "");
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
        this.speakerService = new Service.Speaker("", "");
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
      const eventTriggers = this.retrieveEventTriggerOptions();

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
          },
        );
      } else {
        this.recordingManagement = new RecordingManagement(
          this.recording.options,
          this.recording.delegate,
          eventTriggers,
        );

        serviceMap.cameraEventRecordingManagement = this.recordingManagement.recordingManagementService;
        serviceMap.cameraOperatingMode = this.recordingManagement.operatingModeService;
        serviceMap.dataStreamTransportManagement = this.recordingManagement.dataStreamManagement.getService();
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
    }

    // MOTION SENSOR
    if (this.sensorOptions?.motion) {
      if (typeof this.sensorOptions.motion === "boolean") {
        if (serviceMap.motionService) {
          this.motionService = serviceMap.motionService;
        } else {
          // it could be the case that we previously had a manually supplied motion service
          // at this point we can't remove the iid from the list of linked services from the recording management!
          this.motionService = new Service.MotionSensor("", "");
        }
      } else {
        this.motionService = this.sensorOptions.motion;
        this.motionServiceExternallySupplied = true;

        if (serviceMap.motionService) { // motion service previously supplied as bool option
          this.recordingManagement?.recordingManagementService.removeLinkedService(serviceMap.motionService);
          delete serviceMap.motionService;
          modifiedServiceMap = true;
        }
      }

      this.motionService.setCharacteristic(Characteristic.StatusActive, true);
      this.recordingManagement?.recordingManagementService.addLinkedService(this.motionService);
    } else {
      if (serviceMap.motionService) {
        this.recordingManagement?.recordingManagementService.removeLinkedService(serviceMap.motionService);
        delete serviceMap.motionService;
        modifiedServiceMap = true;
      }
    }

    // OCCUPANCY SENSOR
    if (this.sensorOptions?.occupancy) {
      if (typeof this.sensorOptions.occupancy === "boolean") {
        if (serviceMap.occupancyService) {
          this.occupancyService = serviceMap.occupancyService;
        } else {
          // it could be the case that we previously had a manually supplied occupancy service
          // at this point we can't remove the iid from the list of linked services from the recording management!
          this.occupancyService = new Service.OccupancySensor("", "");
        }
      } else {
        this.occupancyService = this.sensorOptions.occupancy;
        this.occupancyServiceExternallySupplied = true;

        if (serviceMap.occupancyService) { // occupancy service previously supplied as bool option
          this.recordingManagement?.recordingManagementService.removeLinkedService(serviceMap.occupancyService);
          delete serviceMap.occupancyService;
          modifiedServiceMap = true;
        }
      }

      this.occupancyService.setCharacteristic(Characteristic.StatusActive, true);
      this.recordingManagement?.recordingManagementService.addLinkedService(this.occupancyService);
    } else {
      if (serviceMap.occupancyService) {
        this.recordingManagement?.recordingManagementService.removeLinkedService(serviceMap.occupancyService);
        delete serviceMap.occupancyService;
        modifiedServiceMap = true;
      }
    }

    if (this.migrateFromDoorbell(serviceMap)) {
      modifiedServiceMap = true;
    }

    this.recording = undefined;
    this.sensorOptions = undefined;

    return {
      serviceMap: serviceMap,
      updated: modifiedServiceMap,
    };
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
      return new Set();
    }

    const triggerOptions = new Set<EventTriggerOption>();

    if (this.recording.options.overrideEventTriggerOptions) {
      for (const option of this.recording.options.overrideEventTriggerOptions) {
        triggerOptions.add(option);
      }
    }

    if (this.sensorOptions?.motion) {
      triggerOptions.add(EventTriggerOption.MOTION);
    }

    // this method is overwritten by the `DoorbellController` to automatically configure EventTriggerOption.DOORBELL

    return triggerOptions;
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

    // make the sensor services available to the RecordingManagement.
    if (this.motionService) {
      this.recordingManagement?.sensorServices.push(this.motionService);
    }
    if (this.occupancyService) {
      this.recordingManagement?.sensorServices.push(this.occupancyService);
    }
  }

  private rtpStreamManagementDisabledThroughOperatingMode(): boolean {
    return this.recordingManagement
      ? !this.recordingManagement.operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value
      : false;
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
      if (this.recordingManagement) {
        this.recordingManagement.deserialize(serialized.recordingManagement);
      } else {
        // Active characteristic cannot be controlled if removing HSV, ensure they are all active!
        for (const streamManagement of this.streamManagements) {
          streamManagement.service.updateCharacteristic(Characteristic.Active, true);
        }

        this.stateChangeDelegate?.();
      }
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
    if (streamingDisabled) {
      debug("[%s] Rejecting snapshot as streaming is disabled.", accessoryName);
      return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }

    if (this.recordingManagement) {
      const operatingModeService = this.recordingManagement.operatingModeService;
      if (!operatingModeService.getCharacteristic(Characteristic.HomeKitCameraActive).value) {
        debug("[%s] Rejecting snapshot as HomeKit camera is disabled.", accessoryName);
        return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
      }

      const eventSnapshotsActive = operatingModeService
        .getCharacteristic(Characteristic.EventSnapshotsActive)
        .value;
      if (!eventSnapshotsActive) {
        if (reason == null) {
          debug("[%s] Rejecting snapshot as reason is required due to disabled event snapshots.", accessoryName);
          return Promise.reject(HAPStatus.INSUFFICIENT_PRIVILEGES);
        } else if (reason === ResourceRequestReason.EVENT) {
          debug("[%s] Rejecting snapshot as even snapshots are disabled.", accessoryName);
          return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
        }
      }

      const periodicSnapshotsActive = operatingModeService
        .getCharacteristic(Characteristic.PeriodicSnapshotsActive)
        .value;
      if (!periodicSnapshotsActive) {
        if (reason == null) {
          debug("[%s] Rejecting snapshot as reason is required due to disabled periodic snapshots.", accessoryName);
          return Promise.reject(HAPStatus.INSUFFICIENT_PRIVILEGES);
        } else if (reason === ResourceRequestReason.PERIODIC) {
          debug("[%s] Rejecting snapshot as periodic snapshots are disabled.", accessoryName);
          return Promise.reject(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
        }
      }
    }

    // now do the actual snapshot request.
    return new Promise((resolve, reject) => {
      // TODO test and make timeouts configurable!
      let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn(
          `[${accessoryName}] The image snapshot handler for the given accessory is slow to respond! See https://homebridge.io/w/JtMGR for more info.`,
        );

        timeout = setTimeout(() => {
          timeout = undefined;

          console.warn(
            `[${accessoryName}] The image snapshot handler for the given accessory didn't respond at all! See https://homebridge.io/w/JtMGR for more info.`,
          );

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
