import {Controller, ControllerServiceMap, ControllerType, DefaultControllerType} from "./Controller";
import {
    CameraStreamingOptions,
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    LegacyCameraSourceAdapter,
    PrepareStreamResponse,
    PrepareStreamRequest,
    RTPStreamManagement,
    Service, SnapshotRequest,
    StreamingRequest
} from "../..";
import {NodeCallback, SessionIdentifier} from "../../types";
import {Doorbell, Microphone, Speaker} from "../gen/HomeKit";
import {EventEmitter} from "../EventEmitter";
import crypto from 'crypto';

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
    /**
     * Options regarding Recordings (Secure Video)
     */
    // recordingOptions: CameraRecordingOptions, // soon
}

export type SnapshotRequestCallback = (error?: Error, buffer?: Buffer) => void;
export type PrepareStreamCallback = (error?: Error, response?: PrepareStreamResponse) => void;
export type StreamRequestCallback = (error?: Error) => void;

export interface CameraStreamingDelegate {

    handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void;

    prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void;
    handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void;

}

export interface CameraControllerServiceMap extends ControllerServiceMap {
    // "streamManagement%d": CameraRTPStreamManagement, // format to map all stream management services; indexed by zero

    microphone?: Microphone,
    speaker?: Speaker,

    // cameraOperatingMode: CameraOperatingMode, // soon
    // cameraEventRecordingManagement: CameraEventRecordingManagement // soon

    // this ServiceMap is also used by the DoorbellController; there is no necessity to declare it, but i think its good practice to reserve the namespace
    doorbell?: Doorbell;
}

export const enum CameraControllerEvents {
    MICROPHONE_PROPERTIES_CHANGED = "microphone-change",
    SPEAKER_PROPERTIES_CHANGED = "speaker-change",
}

export type CameraControllerEventMap = {
    [CameraControllerEvents.MICROPHONE_PROPERTIES_CHANGED]: (muted: boolean, volume: number) => void;
    [CameraControllerEvents.SPEAKER_PROPERTIES_CHANGED]: (muted: boolean, volume: number) => void;
}

/**
 * Everything needed to expose a HomeKit Camera.
 *
 * @event 'microphone-change' => (muted: boolean, volume: number) => void
 *      Emitted when the mute state or the volume changed. The Apple Home App typically does not set those values
 *      except the mute state. When you adjust the volume in the Camera view it will reset the muted state if it was set previously.
 *      The value of volume has nothing to do with the volume slider in the Camera view of the Home app.
 * @event 'speaker-change' => (muted: boolean, volume: number) => void
 *      Emitted when the mute state or the volume changed. The Apple Home App typically does not set those values
 *      except the mute state. When you unmute the device microphone it will reset the mute state if it was set previously.
 */
export class CameraController extends EventEmitter<CameraControllerEventMap> implements Controller<CameraControllerServiceMap> {

    private static readonly STREAM_MANAGEMENT = "streamManagement"; // key to index all RTPStreamManagement services

    readonly controllerType: ControllerType = DefaultControllerType.CAMERA;

    private readonly streamCount: number;
    private readonly delegate: CameraStreamingDelegate;
    private readonly streamingOptions: CameraStreamingOptions;
    // private readonly recordingOptions: CameraRecordingOptions, // soon
    private readonly legacyMode: boolean = false;

    streamManagements: RTPStreamManagement[] = [];

    private microphoneService?: Microphone;
    private speakerService?: Speaker;

    private microphoneMuted: boolean = false;
    private microphoneVolume: number = 100;
    private speakerMuted: boolean = false;
    private speakerVolume: number = 100;

    constructor(options: CameraControllerOptions, legacyMode: boolean = false) {
        super();
        this.streamCount = Math.max(1, options.cameraStreamCount || 1);
        this.delegate = options.delegate;
        this.streamingOptions = options.streamingOptions;

        this.legacyMode = legacyMode; // legacy mode will prent from Microphone and Speaker services to get created to avoid collisions
    }

    // ----------------------------------- STREAM API ------------------------------------

    /**
     * Call this method if you want to forcefully suspend an ongoing streaming session.
     * This would be adequate if the the rtp server or media encoding encountered an unexpected error.
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

    constructServices(): CameraControllerServiceMap {
        for (let i = 0; i < this.streamCount; i++) {
            this.streamManagements.push(new RTPStreamManagement(i, this.streamingOptions, this.delegate));
        }

        if (!this.legacyMode && this.streamingOptions.audio) {
            // In theory the Microphone Service is a necessity. In practice its not. lol. So we just add it if the user wants to support audio
            this.microphoneService = new Service.Microphone('', '');
            this.microphoneService.setCharacteristic(Characteristic.Volume, this.microphoneVolume);

            if (this.streamingOptions.audio.twoWayAudio) {
                this.speakerService = new Service.Speaker('', '');
                this.speakerService.setCharacteristic(Characteristic.Volume, this.speakerVolume);
            }
        }

        const serviceMap: CameraControllerServiceMap = {
            microphone: this.microphoneService,
            speaker: this.speakerService,
        };

        this.streamManagements.forEach((management, index) => serviceMap[CameraController.STREAM_MANAGEMENT + index] = management.getService());

        return serviceMap;
    }

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
                    break; // we finished counting and we got no saved service; we are finished
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

        if (this.migrateFromDoorbell(serviceMap)) {
            modifiedServiceMap = true;
        }

        if (modifiedServiceMap) { // serviceMap must only be returned if anything actually changed
            return serviceMap;
        }
    }

    // overwritten in DoorbellController (to avoid cyclic dependencies, i hate typescript for that)
    protected migrateFromDoorbell(serviceMap: ControllerServiceMap): boolean {
        if (serviceMap.doorbell) { // See NOTICE in DoorbellController
            delete serviceMap.doorbell;
            return true;
        }

        return false;
    }

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

    handleFactoryReset(): void {
        this.streamManagements.forEach(management => management.handleFactoryReset());
    }

    handleSnapshotRequest(height: number, width: number, callback: NodeCallback<Buffer>) {
        this.delegate.handleSnapshotRequest({
            height: height,
            width: width,
        }, callback);
    }

    handleCloseConnection(sessionID: SessionIdentifier): void {
        this.streamManagements.forEach(management => management.handleCloseConnection(sessionID));

        if (this.delegate instanceof LegacyCameraSourceAdapter) {
            this.delegate.forwardCloseConnection(sessionID);
        }
    }

}
