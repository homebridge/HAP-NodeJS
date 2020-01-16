import * as tlv from './util/tlv';
import createDebug from 'debug';
import assert from 'assert';

import {Service} from "./Service";
import {
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback
} from "./Characteristic";
import {CharacteristicValue} from "../types";
import {Status} from "./HAPServer";
import {Accessory, AccessoryEventTypes} from "./Accessory";
import {
    DataSendCloseReason,
    DataStreamConnection,
    DataStreamConnectionEvents,
    DataStreamManagement,
    DataStreamProtocolHandler,
    DataStreamServerEvents,
    EventHandler,
    Float32, HDSStatus,
    Int64,
    Protocols,
    RequestHandler,
    Topics
} from "./datastream";
import {
    AudioCodecParamBitRateTypes,
    AudioCodecParamSampleRateTypes,
    AudioCodecParamTypes,
    AudioCodecTypes,
    AudioTypes
} from "./StreamController";
import {EventEmitter} from "./EventEmitter";
import {HAPSessionEvents, Session} from "./util/eventedhttp";
import Timeout = NodeJS.Timeout;

const debug = createDebug('Remote:Controller');

export enum TargetControlCommands {
    MAXIMUM_TARGETS = 0x01,
    TICKS_PER_SECOND = 0x02,
    SUPPORTED_BUTTON_CONFIGURATION = 0x03,
    TYPE = 0x04
}

export enum SupportedButtonConfigurationTypes {
    BUTTON_ID = 0x01,
    BUTTON_TYPE = 0x02
}

export enum ButtonType {
    UNDEFINED = 0x00,
    MENU = 0x01,
    PLAY_PAUSE = 0x02,
    TV_HOME = 0x03,
    SELECT = 0x04,
    ARROW_UP = 0x05,
    ARROW_RIGHT = 0x06,
    ARROW_DOWN = 0x07,
    ARROW_LEFT = 0x08,
    VOLUME_UP = 0x09,
    VOLUME_DOWN = 0x0A,
    SIRI = 0x0B,
    POWER = 0x0C,
    GENERIC = 0x0D
}


export enum TargetControlList {
    OPERATION = 0x01,
    TARGET_CONFIGURATION = 0x02
}

export enum Operation {
    UNDEFINED = 0x00,
    LIST = 0x01,
    ADD = 0x02,
    REMOVE = 0x03,
    RESET = 0x04,
    UPDATE = 0x05
}

export enum TargetConfigurationTypes {
    TARGET_IDENTIFIER = 0x01,
    TARGET_NAME = 0x02,
    TARGET_CATEGORY = 0x03,
    BUTTON_CONFIGURATION = 0x04
}

export enum TargetCategory {
    UNDEFINED = 0x00,
    APPLE_TV = 0x18
}

export enum ButtonConfigurationTypes {
    BUTTON_ID = 0x01,
    BUTTON_TYPE = 0x02,
    BUTTON_NAME = 0x03,
}

export enum ButtonEvent {
    BUTTON_ID = 0x01,
    BUTTON_STATE = 0x02,
    TIMESTAMP = 0x03,
    ACTIVE_IDENTIFIER = 0x04,
}

export enum ButtonState {
    UP = 0x00,
    DOWN = 0x01
}


export type SupportedConfiguration = {
    maximumTargets: number,
    ticksPerSecond: number,
    supportedButtonConfiguration: SupportedButtonConfiguration[],
    hardwareImplemented: boolean
}

export type SupportedButtonConfiguration = {
    buttonID: number,
    buttonType: ButtonType
}

export type TargetConfiguration = {
    targetIdentifier: number,
    targetName?: string, // on Operation.UPDATE targetName is left out
    targetCategory?: TargetCategory, // on Operation.UPDATE targetCategory is left out
    buttonConfiguration: Record<number, ButtonConfiguration> // button configurations indexed by their ID
}

export type ButtonConfiguration = {
    buttonID: number,
    buttonType: ButtonType,
    buttonName?: string
}


export enum SiriInputType {
    PUSH_BUTTON_TRIGGERED_APPLE_TV = 0,
}


export enum SupportedAudioStreamConfigurationTypes {
    AUDIO_CODEC_CONFIGURATION = 0x01,
    COMFORT_NOISE_SUPPORT = 0x02,
}

export enum SelectedAudioInputStreamConfigurationTypes {
    SELECTED_AUDIO_INPUT_STREAM_CONFIGURATION = 0x01,
}

export type SupportedAudioStreamConfiguration = {
    audioCodecConfiguration: AudioCodecConfiguration,
}

export type SelectedAudioStreamConfiguration = {
    audioCodecConfiguration: AudioCodecConfiguration,
}

export type AudioCodecConfiguration = {
    codecType: AudioCodecTypes,
    parameters: AudioCodecParameters,
}

export type AudioCodecParameters = {
    channels: number, // number of audio channels, default is 1
    bitrate: AudioCodecParamBitRateTypes,
    samplerate: AudioCodecParamSampleRateTypes,
    rtpTime?: RTPTime, // only present in SelectedAudioCodecParameters TLV
}

export type RTPTime = 20 | 30 | 40 | 60;


export enum SiriAudioSessionState {
    STARTING = 0, // we are currently waiting for a response for the start request
    SENDING = 1, // we are sending data
    CLOSING = 2, // we are currently waiting for the acknowledgment event
    CLOSED = 3, // the close event was sent
}

export type DataSendMessageData = {
    packets: AudioFramePacket[],
    streamId: Int64,
    endOfStream: boolean,
}

export type AudioFrame = {
    data: Buffer,
    rms: number, // root mean square
}

export type AudioFramePacket = {
    data: Buffer,
    metadata: {
        rms: Float32, // root mean square
        sequenceNumber: Int64,
    },
}


export type FrameHandler = (frame: AudioFrame) => void;
export type ErrorHandler = (error: DataSendCloseReason) => void;

export interface SiriAudioStreamProducer {

    startAudioProduction(selectedAudioConfiguration: AudioCodecConfiguration): void;

    stopAudioProduction(): void;

}

export interface SiriAudioStreamProducerConstructor {

    /**
     * Creates a new instance of a SiriAudioStreamProducer
     *
     * @param frameHandler {FrameHandler} - called for every opus frame recorded
     * @param errorHandler {ErrorHandler} - should be called with a appropriate reason when the producing process errored
     * @param options - optional parameter for passing any configuration related options
     */
    new(frameHandler: FrameHandler, errorHandler: ErrorHandler, options?: any): SiriAudioStreamProducer;

}

export enum RemoteControllerEvents {
    ACTIVE_CHANGE = "active-change",
    ACTIVE_IDENTIFIER_CHANGE = "active-identifier-change",

    TARGET_ADDED = "target-add",
    TARGET_UPDATED = "target-update",
    TARGET_REMOVED = "target-remove",
    TARGETS_RESET = "targets-reset",
}

export enum TargetUpdates {
    NAME,
    CATEGORY,
    UPDATED_BUTTONS,
    REMOVED_BUTTONS,
}

export type RemoteControllerEventMap = {
    [RemoteControllerEvents.ACTIVE_CHANGE]: (active: boolean) => void;
    [RemoteControllerEvents.ACTIVE_IDENTIFIER_CHANGE]: (activeIdentifier: number) => void;

    [RemoteControllerEvents.TARGET_ADDED]: (targetConfiguration: TargetConfiguration) => void;
    [RemoteControllerEvents.TARGET_UPDATED]: (targetConfiguration: TargetConfiguration, updates: TargetUpdates[]) => void;
    [RemoteControllerEvents.TARGET_REMOVED]: (targetIdentifier: number) => void;
    [RemoteControllerEvents.TARGETS_RESET]: () => void;
}

/**
 * Handles everything need to implement a fully working HomeKit remote controller.
 *
 * @event 'active-change': (active: boolean) => void
 *        This event is emitted when the active state of the remote has changed.
 *        active = true indicates that there is currently an apple tv listening of button presses and audio streams.
 *
 * @event 'active-identifier-change': (activeIdentifier: number) => void
 *        This event is emitted when the currently selected target has changed.
 *        Possible reasons for a changed active identifier: manual change via api call, first target configuration
 *        gets added, active target gets removed, accessory gets unpaired, reset request was sent.
 *        An activeIdentifier of 0 indicates that no target is selected.
 *
 *
 * @event 'target-add': (targetConfiguration: TargetConfiguration) => void
 *        This event is emitted when a new target configuration is received. As we currently do not persistently store
 *        configured targets, this will be called at every startup for every Apple TV configured in the home.
 *
 * @event 'target-update': (targetConfiguration: TargetConfiguration, updates: TargetUpdates[]) => void
 *        This event is emitted when a existing target was updated.
 *        The 'updates' array indicates what exactly was changed for the target.
 *
 * @event 'target-remove': (targetIdentifier: number) => void
 *        This event is emitted when a existing configuration for a target was removed.
 *
 * @event 'targets-reset': () => void
 *        This event is emitted when a reset of the target configuration is requested.
 *        With this event every configuration made should be reset. This event is also called
 *        when the accessory gets unpaired.
 */
export class HomeKitRemoteController extends EventEmitter<RemoteControllerEventMap> implements DataStreamProtocolHandler {

    audioSupported: boolean;
    audioProducerConstructor?: SiriAudioStreamProducerConstructor;
    audioProducerOptions?: any;

    accessoryConfigured: boolean = false;
    targetControlManagementService?: Service;
    targetControlService?: Service;

    siriService?: Service;
    audioStreamManagementService?: Service;
    dataStreamManagement?: DataStreamManagement;

    private buttons: Record<number, number> = {}; // internal mapping of buttonId to buttonType for supported buttons
    private readonly supportedConfiguration: string;
    /*
        It is advice to persistently store this configuration below, but HomeKit seems to just reconfigure itself
        after an reboot of the accessory.
        If someone has the time to implement persistent storage 'activeIdentifier' and 'active'
        should probably be included as well. Also a check at startup if we are still paired could be useful :thinking:
     */
    targetConfigurations: Record<number, TargetConfiguration> = {};
    private  targetConfigurationsString: string = "";

    private lastButtonEvent: string = "";

    activeIdentifier: number = 0; // id of 0 means no device selected
    private activeSession?: Session; // session which marked this remote as active and listens for events and siri
    private activeSessionDisconnectionListener?: () => void;

    supportedAudioConfiguration: string;
    selectedAudioConfiguration: AudioCodecConfiguration;
    selectedAudioConfigurationString: string;

    dataStreamConnections: Record<number, DataStreamConnection> = {}; // maps targetIdentifiers to active data stream connections
    activeAudioSession?: SiriAudioSession;
    nextAudioSession?: SiriAudioSession;

    eventHandler?: Record<string, EventHandler>;
    requestHandler?: Record<string, RequestHandler>;

    /**
     * Creates a new HomeKitRemoteController.
     * If siri voice input is supported the constructor to an SiriAudioStreamProducer needs to be supplied.
     * Otherwise a remote without voice support will be created.
     *
     * For every audio session a new SiriAudioStreamProducer will be constructed.
     *
     * @param audioProducerConstructor {SiriAudioStreamProducerConstructor} - constructor for a SiriAudioStreamProducer
     * @param producerOptions - if supplied this argument will be supplied as third argument of the SiriAudioStreamProducer
     *                          constructor. This should be used to supply configurations to the stream producer.
     */
    constructor(audioProducerConstructor?: SiriAudioStreamProducerConstructor, producerOptions?: any) {
        super();
        this.audioSupported = audioProducerConstructor !== undefined;
        this.audioProducerConstructor = audioProducerConstructor;
        this.audioProducerOptions = producerOptions;

        const configuration: SupportedConfiguration = this.constructSupportedConfiguration();
        this.supportedConfiguration = this.buildTargetControlSupportedConfigurationTLV(configuration);

        const audioConfiguration: SupportedAudioStreamConfiguration = this.constructSupportedAudioConfiguration();
        this.supportedAudioConfiguration = this.buildSupportedAudioConfigurationTLV(audioConfiguration);

        this.selectedAudioConfiguration = { // set the required defaults
            codecType: AudioCodecTypes.OPUS,
            parameters: {
                channels: 1,
                bitrate: AudioCodecParamBitRateTypes.VARIABLE,
                samplerate: AudioCodecParamSampleRateTypes.KHZ_16,
                rtpTime: 20,
            }
        };
        this.selectedAudioConfigurationString = this.buildSelectedAudioConfigurationTLV({
            audioCodecConfiguration: this.selectedAudioConfiguration,
        });

        this._createServices();

        if (this.audioSupported) { // subscribe to necessary events if siri is enabled
            this.dataStreamManagement!
                .onEventMessage(Protocols.TARGET_CONTROL, Topics.WHOAMI, this.handleTargetControlWhoAmI.bind(this))
                .onServerEvent(DataStreamServerEvents.CONNECTION_CLOSED, this.handleDataStreamConnectionClosed.bind(this));

            this.eventHandler = {
                [Topics.ACK]: this.handleDataSendAckEvent.bind(this),
                [Topics.CLOSE]: this.handleDataSendCloseEvent.bind(this),
            };
        }
    }

    /**
     * Set a new target as active target. A value of 0 indicates that no target is selected currently.
     *
     * @param activeIdentifier {number} - target identifier
     */
    setActiveIdentifier = (activeIdentifier: number) => {
        if (activeIdentifier === this.activeIdentifier) {
            return;
        }

        if (activeIdentifier !== 0 && !this.targetConfigurations[activeIdentifier]) {
            throw Error("Tried setting unconfigured targetIdentifier to active");
        }

        debug("%d is now the active target", activeIdentifier);
        this.activeIdentifier = activeIdentifier;
        this.targetControlService!.getCharacteristic(Characteristic.ActiveIdentifier)!.updateValue(activeIdentifier);

        if (this.activeAudioSession) {
            this.handleSiriAudioStop();
        }

        setTimeout(() => this.emit(RemoteControllerEvents.ACTIVE_IDENTIFIER_CHANGE, activeIdentifier), 0);
        this.setInactive();
    };

    /**
     * @returns if the current target is active, meaning the active device is listening for button events or audio sessions
     */
    isActive = () => {
        return !!this.activeSession;
    };

    /**
     * Checks if the supplied targetIdentifier is configured.
     *
     * @param targetIdentifier {number}
     */
    isConfigured = (targetIdentifier: number) => {
        return this.targetConfigurations[targetIdentifier] !== undefined;
    };

    /**
     * Returns the targetIdentifier for a give device name
     *
     * @param name {string} - the name of the device
     * @returns the targetIdentifier of the device or undefined if not existent
     */
    getTargetIdentifierByName = (name: string) => {
        for (const activeIdentifier in this.targetConfigurations) {
            const configuration = this.targetConfigurations[activeIdentifier];
            if (configuration.targetName === name) {
                return parseInt(activeIdentifier);
            }
        }
        return undefined;
    };

    /**
     * Sends a button event to press the supplied button.
     *
     * @param button {ButtonType} - button to be pressed
     */
    pushButton = (button: ButtonType) => {
        debug("Pressing button %s", ButtonType[button]);
        this.sendButtonEvent(button, ButtonState.DOWN);
    };

    /**
     * Sends a button event that the supplied button was released.
     *
     * @param button {ButtonType} - button which was released
     */
    releaseButton = (button: ButtonType) => {
        debug("Released button %s", ButtonType[button]);
        this.sendButtonEvent(button, ButtonState.UP);
    };

    /**
     * Presses a supplied button for a given time.
     *
     * @param button {ButtonType} - button to be pressed and released
     * @param time {number} - time in milliseconds (defaults to 200ms)
     */
    pushAndReleaseButton = (button: ButtonType, time: number = 200) => {
        this.pushButton(button);
        setTimeout(() => this.releaseButton(button), time);
    };

    /**
     * This method adds and configures the remote services for a give accessory.
     *
     * @param accessory {Accessory} - the give accessory this remote should be added to
     */
    addServicesToAccessory = (accessory: Accessory) => {
        if (!this.targetControlManagementService || !this.targetControlService) {
            throw new Error("Unexpected state: Services not configured!"); // playing it save
        }
        if (this.accessoryConfigured) {
            throw new Error("Remote was already added to an accessory");
        }

        accessory.addService(this.targetControlManagementService);
        accessory.setPrimaryService(this.targetControlManagementService);
        accessory.addService(this.targetControlService);

        if (this.audioSupported) {
            accessory.addService(this.siriService!);
            accessory.addService(this.audioStreamManagementService!);
            accessory.addService(this.dataStreamManagement!.getService());
        }

        const primaryAccessory = accessory.getPrimaryAccessory();
        primaryAccessory.on(AccessoryEventTypes.UNPAIRED, () => {
            debug("Accessory was unpaired. Resetting targets...");
            this.handleResetTargets(undefined);
        });

        this.accessoryConfigured = true;
    };

    // ---------------------------------- CONFIGURATION ----------------------------------
    // override methods if you would like to change anything (but should not be necessary most likely)

    constructSupportedConfiguration = () => {
        const configuration: SupportedConfiguration = {
            maximumTargets: 10, // some random number. (ten should be okay?)
            ticksPerSecond: 1000, // we rely on unix timestamps
            supportedButtonConfiguration: [],
            hardwareImplemented: this.audioSupported // siri is only allowed for hardware implemented remotes
        };

        const supportedButtons = [
            ButtonType.MENU, ButtonType.PLAY_PAUSE, ButtonType.TV_HOME, ButtonType.SELECT,
            ButtonType.ARROW_UP, ButtonType.ARROW_RIGHT, ButtonType.ARROW_DOWN, ButtonType.ARROW_LEFT,
            ButtonType.VOLUME_UP, ButtonType.VOLUME_DOWN, ButtonType.POWER, ButtonType.GENERIC
        ];
        if (this.audioSupported) { // add siri button if this remote supports it
            supportedButtons.push(ButtonType.SIRI);
        }

        supportedButtons.forEach(button => {
            const buttonConfiguration: SupportedButtonConfiguration = {
                buttonID: 100 + button,
                buttonType: button
            };
            configuration.supportedButtonConfiguration.push(buttonConfiguration);
            this.buttons[button] = buttonConfiguration.buttonID; // also saving mapping of type to id locally
        });

        return configuration;
    };

    constructSupportedAudioConfiguration = (): SupportedAudioStreamConfiguration => {
        // the following parameters are expected from HomeKit for a remote
        return {
            audioCodecConfiguration: {
                codecType: AudioCodecTypes.OPUS,
                parameters: {
                    channels: 1,
                    bitrate: AudioCodecParamBitRateTypes.VARIABLE,
                    samplerate: AudioCodecParamSampleRateTypes.KHZ_16,
                }
            },
        }
    };

    // --------------------------------- TARGET CONTROL ----------------------------------

    private handleTargetControlWrite = (value: any, callback: CharacteristicSetCallback) => {
        const data = Buffer.from(value, 'base64');
        const objects = tlv.decode(data);

        const operation = objects[TargetControlList.OPERATION][0] as Operation;

        let targetConfiguration: TargetConfiguration | undefined = undefined;
        if (objects[TargetControlList.TARGET_CONFIGURATION]) { // if target configuration was sent, parse it
            targetConfiguration = this.parseTargetConfigurationTLV(objects[TargetControlList.TARGET_CONFIGURATION]);
        }

        debug("Received TargetControl write operation %s", Operation[operation]);

        let handler: (targetConfiguration?: TargetConfiguration) => Status;
        switch (operation) {
            case Operation.ADD:
                handler = this.handleAddTarget;
                break;
            case Operation.UPDATE:
                handler = this.handleUpdateTarget;
                break;
            case Operation.REMOVE:
                handler = this.handleRemoveTarget;
                break;
            case Operation.RESET:
                handler = this.handleResetTargets;
                break;
            case Operation.LIST:
                handler = this.handleListTargets;
                break;
            default:
                callback(new Error(Status.INVALID_VALUE_IN_REQUEST+""), undefined);
                return;
        }

        const status = handler(targetConfiguration);
        if (status === Status.SUCCESS) {
            callback(undefined, this.targetConfigurationsString); // passing value for write response

            if (operation === Operation.ADD && this.activeIdentifier === 0) {
                this.setActiveIdentifier(targetConfiguration!.targetIdentifier);
            }
        } else {
            callback(new Error(status + ""));
        }
    };

    private handleAddTarget = (targetConfiguration?: TargetConfiguration): Status => {
        if (!targetConfiguration) {
            return Status.INVALID_VALUE_IN_REQUEST;
        }

        this.targetConfigurations[targetConfiguration.targetIdentifier] = targetConfiguration;

        debug("Configured new target '" + targetConfiguration.targetName + "' with targetIdentifier '" + targetConfiguration.targetIdentifier + "'");

        setTimeout(() => this.emit(RemoteControllerEvents.TARGET_ADDED, targetConfiguration), 0);

        this.targetConfigurationsString = this.buildTargetConfigurationsTLV(this.targetConfigurations); // set response
        return Status.SUCCESS;
    };

    private handleUpdateTarget = (targetConfiguration?: TargetConfiguration): Status => {
        if (!targetConfiguration) {
            return Status.INVALID_VALUE_IN_REQUEST;
        }

        const updates: TargetUpdates[] = [];

        const configuredTarget = this.targetConfigurations[targetConfiguration.targetIdentifier];
        if (targetConfiguration.targetName) {
            debug("Target name was updated '%s' => '%s' (%d)",
                configuredTarget.targetName, targetConfiguration.targetName, configuredTarget.targetIdentifier);

            configuredTarget.targetName = targetConfiguration.targetName;
            updates.push(TargetUpdates.NAME);
        }
        if (targetConfiguration.targetCategory) {
            debug("Target category was updated '%d' => '%d' for target '%s' (%d)",
                configuredTarget.targetCategory, targetConfiguration.targetCategory,
                configuredTarget.targetName, configuredTarget.targetIdentifier);

            configuredTarget.targetCategory = targetConfiguration.targetCategory;
            updates.push(TargetUpdates.CATEGORY);
        }
        if (targetConfiguration.buttonConfiguration) {
            debug("%d button configurations were updated for target '%s' (%d)",
                Object.keys(targetConfiguration.buttonConfiguration).length,
                configuredTarget.targetName, configuredTarget.targetIdentifier);

            for (const key in targetConfiguration.buttonConfiguration) {
                const configuration = targetConfiguration.buttonConfiguration[key];
                const savedConfiguration = configuredTarget.buttonConfiguration[configuration.buttonID];

                savedConfiguration.buttonType = configuration.buttonType;
                savedConfiguration.buttonName = configuration.buttonName;
            }
            updates.push(TargetUpdates.UPDATED_BUTTONS);
        }

        setTimeout(() => this.emit(RemoteControllerEvents.TARGET_UPDATED, targetConfiguration, updates), 0);

        this.targetConfigurationsString = this.buildTargetConfigurationsTLV(this.targetConfigurations); // set response
        return Status.SUCCESS;
    };

    private handleRemoveTarget = (targetConfiguration?: TargetConfiguration): Status => {
        if (!targetConfiguration) {
            return Status.INVALID_VALUE_IN_REQUEST;
        }

        const configuredTarget = this.targetConfigurations[targetConfiguration.targetIdentifier];
        if (!configuredTarget) {
            return Status.INVALID_VALUE_IN_REQUEST;
        }

        if (targetConfiguration.buttonConfiguration) {
            for (const key in targetConfiguration.buttonConfiguration) {
                delete configuredTarget.buttonConfiguration[key];
            }

            debug("Removed %d button configurations of target '%s' (%d)",
                Object.keys(targetConfiguration.buttonConfiguration).length, configuredTarget.targetName, configuredTarget.targetIdentifier);
            setTimeout(() => this.emit(RemoteControllerEvents.TARGET_UPDATED, configuredTarget, [TargetUpdates.REMOVED_BUTTONS]), 0);
        } else {
            delete this.targetConfigurations[targetConfiguration.targetIdentifier];

            debug ("Target '%s' (%d) was removed", configuredTarget.targetName, configuredTarget.targetIdentifier);
            setTimeout(() => this.emit(RemoteControllerEvents.TARGET_REMOVED, targetConfiguration.targetIdentifier), 0);

            const keys = Object.keys(this.targetConfigurations);
            this.setActiveIdentifier(keys.length === 0? 0: parseInt(keys[0])); // switch to next available remote
        }

        this.targetConfigurationsString = this.buildTargetConfigurationsTLV(this.targetConfigurations); // set response
        return Status.SUCCESS;
    };

    private handleResetTargets = (targetConfiguration?: TargetConfiguration): Status => {
        if (targetConfiguration) {
            return Status.INVALID_VALUE_IN_REQUEST;
        }

        debug("Resetting all target configurations");
        this.targetConfigurations = {};

        setTimeout(() => this.emit(RemoteControllerEvents.TARGETS_RESET), 0);
        this.setActiveIdentifier(0); // resetting active identifier (also sets active to false)

        this.targetConfigurationsString = ""; // set response
        return Status.SUCCESS;
    };

    private handleListTargets = (targetConfiguration?: TargetConfiguration): Status => {
        if (targetConfiguration) {
            return Status.INVALID_VALUE_IN_REQUEST;
        }

        // this.targetConfigurationsString is updated after each change, so we basically don't need to do anything here
        debug("Returning " + Object.keys(this.targetConfigurations).length + " target configurations");
        return Status.SUCCESS;
    };

    private handleActiveWrite = (value: CharacteristicValue, callback: CharacteristicSetCallback, connectionID?: string) => {
        if (!connectionID) {
            callback(new Error(Status.INVALID_VALUE_IN_REQUEST + ""));
            return;
        }
        const session: Session = Session.getSession(connectionID);
        if (!session) {
            callback(new Error(Status.INVALID_VALUE_IN_REQUEST + ""));
            return;
        }

        if (this.activeIdentifier === 0) {
            debug("Tried to change active state. There is no active target set though");
            callback(new Error(Status.INVALID_VALUE_IN_REQUEST + ""));
            return;
        }

        if (this.activeSession) {
            this.activeSession.removeListener(HAPSessionEvents.CLOSED, this.activeSessionDisconnectionListener!);
            this.activeSession = undefined;
            this.activeSessionDisconnectionListener = undefined;
        }

        this.activeSession = value? session: undefined;
        if (this.activeSession) { // register listener when hap session disconnects
            this.activeSessionDisconnectionListener = this.handleActiveSessionDisconnected.bind(this, this.activeSession);
            this.activeSession.on(HAPSessionEvents.CLOSED, this.activeSessionDisconnectionListener);
        }

        const activeName = this.targetConfigurations[this.activeIdentifier].targetName;
        debug("Remote with activeTarget '%s' (%d) was set to %s", activeName, this.activeIdentifier, value ? "ACTIVE" : "INACTIVE");

        callback();

        this.emit(RemoteControllerEvents.ACTIVE_CHANGE, value as boolean);
    };

    private setInactive = () => {
        if (this.activeSession === undefined) {
            return;
        }

        this.activeSession.removeListener(HAPSessionEvents.CLOSED, this.activeSessionDisconnectionListener!);
        this.activeSession = undefined;
        this.activeSessionDisconnectionListener = undefined;

        this.targetControlService!.getCharacteristic(Characteristic.Active)!.updateValue(false);
        debug("Remote was set to INACTIVE");

        setTimeout(() => this.emit(RemoteControllerEvents.ACTIVE_CHANGE, false), 0);
    };

    private handleActiveSessionDisconnected = (session: Session) => {
        if (session !== this.activeSession) {
            return;
        }

        debug("Active hap session disconnected!");
        this.setInactive();
    };

    private sendButtonEvent = (button: ButtonType, buttonState: ButtonState) => {
        const buttonID = this.buttons[button];
        if (buttonID === undefined || buttonID === 0) {
            throw new Error("Tried sending button event for unsupported button (" + button + ")");
        }

        if (this.activeIdentifier === 0) { // cannot press button if no device is selected
            throw new Error("Tried sending button event although no target was selected");
        }

        if (!this.isActive()) { // cannot press button if device is not active (aka no apple tv is listening)
            throw new Error("Tried sending button event although target was not marked as active");
        }

        if (button === ButtonType.SIRI && this.audioSupported) {
            if (buttonState === ButtonState.DOWN) { // start streaming session
                this.handleSiriAudioStart();
            } else if (buttonState === ButtonState.UP) { // stop streaming session
                this.handleSiriAudioStop();
            }
            return;
        }

        const buttonIdTlv = tlv.encode(
            ButtonEvent.BUTTON_ID, buttonID
        );

        const buttonStateTlv = tlv.encode(
            ButtonEvent.BUTTON_STATE, buttonState
        );

        const timestampTlv = tlv.encode(
            ButtonEvent.TIMESTAMP, tlv.writeUInt64(new Date().getTime())
            // timestamp should be uint64. bigint though is only supported by node 10.4.0 and above
            // thus we just interpret timestamp as a regular number
        );

        const activeIdentifierTlv = tlv.encode(
            ButtonEvent.ACTIVE_IDENTIFIER, tlv.writeUInt32(this.activeIdentifier)
        );

        this.lastButtonEvent = Buffer.concat([
            buttonIdTlv, buttonStateTlv, timestampTlv, activeIdentifierTlv
        ]).toString('base64');
        this.targetControlService!.getCharacteristic(Characteristic.ButtonEvent)!.updateValue(this.lastButtonEvent);
    };

    private parseTargetConfigurationTLV = (data: Buffer): TargetConfiguration => {
        const configTLV = tlv.decode(data);

        const identifier = tlv.readUInt32(configTLV[TargetConfigurationTypes.TARGET_IDENTIFIER]);

        let name = undefined;
        if (configTLV[TargetConfigurationTypes.TARGET_NAME])
            name = configTLV[TargetConfigurationTypes.TARGET_NAME].toString();

        let category = undefined;
        if (configTLV[TargetConfigurationTypes.TARGET_CATEGORY])
            category = tlv.readUInt16(configTLV[TargetConfigurationTypes.TARGET_CATEGORY]);

        const buttonConfiguration: Record<number, ButtonConfiguration> = {};

        if (configTLV[TargetConfigurationTypes.BUTTON_CONFIGURATION]) {
            const buttonConfigurationTLV = tlv.decodeList(configTLV[TargetConfigurationTypes.BUTTON_CONFIGURATION], ButtonConfigurationTypes.BUTTON_ID);
            buttonConfigurationTLV.forEach(entry => {
                const buttonId = entry[ButtonConfigurationTypes.BUTTON_ID][0];
                const buttonType = tlv.readUInt16(entry[ButtonConfigurationTypes.BUTTON_TYPE]);
                let buttonName;
                if (entry[ButtonConfigurationTypes.BUTTON_NAME]) {
                    buttonName = entry[ButtonConfigurationTypes.BUTTON_NAME].toString();
                } else {
                    buttonName = ButtonType[buttonType as ButtonType];
                }

                buttonConfiguration[buttonId] = {
                    buttonID: buttonId,
                    buttonType: buttonType,
                    buttonName: buttonName
                };
            });
        }

        return {
            targetIdentifier: identifier,
            targetName: name,
            targetCategory: category,
            buttonConfiguration: buttonConfiguration
        };
    };

    private buildTargetConfigurationsTLV = (configurations: Record<number, TargetConfiguration>) => {
        const bufferList = [];
        for (const key in configurations) {
            // noinspection JSUnfilteredForInLoop
            const configuration = configurations[key];

            const targetIdentifier = tlv.encode(
                TargetConfigurationTypes.TARGET_IDENTIFIER, tlv.writeUInt32(configuration.targetIdentifier)
            );

            const targetName = tlv.encode(
                TargetConfigurationTypes.TARGET_NAME, configuration.targetName!
            );

            const targetCategory = tlv.encode(
                TargetConfigurationTypes.TARGET_CATEGORY, tlv.writeUInt16(configuration.targetCategory!)
            );

            const buttonConfigurationBuffers: Buffer[] = [];
            Object.values(configuration.buttonConfiguration).forEach(value => {
                let tlvBuffer = tlv.encode(
                    ButtonConfigurationTypes.BUTTON_ID, value.buttonID,
                    ButtonConfigurationTypes.BUTTON_TYPE, tlv.writeUInt16(value.buttonType)
                );

                if (value.buttonName) {
                    tlvBuffer = Buffer.concat([
                        tlvBuffer,
                        tlv.encode(
                            ButtonConfigurationTypes.BUTTON_NAME, value.buttonName
                        )
                    ])
                }

                buttonConfigurationBuffers.push(tlvBuffer);
            });

            const buttonConfiguration = tlv.encode(
                TargetConfigurationTypes.BUTTON_CONFIGURATION, Buffer.concat(buttonConfigurationBuffers)
            );

            const targetConfiguration = Buffer.concat(
                [targetIdentifier, targetName, targetCategory, buttonConfiguration]
            );

            bufferList.push(tlv.encode(TargetControlList.TARGET_CONFIGURATION, targetConfiguration));
        }

        return Buffer.concat(bufferList).toString('base64');
    };

    private buildTargetControlSupportedConfigurationTLV = (configuration: SupportedConfiguration) => {
        const maximumTargets = tlv.encode(
            TargetControlCommands.MAXIMUM_TARGETS, configuration.maximumTargets
        );

        const ticksPerSecond = tlv.encode(
            TargetControlCommands.TICKS_PER_SECOND, tlv.writeUInt64(configuration.ticksPerSecond)
        );

        const supportedButtonConfigurationBuffers: Uint8Array[] = [];
        configuration.supportedButtonConfiguration.forEach(value => {
            const tlvBuffer = tlv.encode(
                SupportedButtonConfigurationTypes.BUTTON_ID, value.buttonID,
                SupportedButtonConfigurationTypes.BUTTON_TYPE, tlv.writeUInt16(value.buttonType)
            );
            supportedButtonConfigurationBuffers.push(tlvBuffer);
        });
        const supportedButtonConfiguration = tlv.encode(
            TargetControlCommands.SUPPORTED_BUTTON_CONFIGURATION, Buffer.concat(supportedButtonConfigurationBuffers)
        );

        const type = tlv.encode(TargetControlCommands.TYPE, configuration.hardwareImplemented ? 1 : 0);

        return Buffer.concat(
            [maximumTargets, ticksPerSecond, supportedButtonConfiguration, type]
        ).toString('base64');
    };

    // --------------------------------- SIRI/DATA STREAM --------------------------------

    private handleTargetControlWhoAmI = (connection: DataStreamConnection, message: Record<any, any>) => {
        const targetIdentifier = message["identifier"];
        this.dataStreamConnections[targetIdentifier] = connection;
        debug("Discovered HDS connection for targetIdentifier %s", targetIdentifier);

        connection.addProtocolHandler(Protocols.DATA_SEND, this);
    };

    private handleSiriAudioStart = () => {
        if (!this.audioSupported) {
            throw new Error("Cannot start siri stream on remote where siri is not supported");
        }

        if (!this.isActive()) {
            debug("Tried opening Siri audio stream, however no controller is connected!");
            return;
        }

        if (this.activeAudioSession && (!this.activeAudioSession.isClosing() || this.nextAudioSession)) {
            // there is already a session running, which is not in closing state and/or there is even already a
            // nextAudioSession running. ignoring start request
            debug("Tried opening Siri audio stream, however there is already one in progress");
            return;
        }

        const connection = this.dataStreamConnections[this.activeIdentifier]; // get connection for current target
        if (connection === undefined) { // target seems not connected, ignore it
            debug("Tried opening Siri audio stream however target is not connected via HDS");
            return;
        }

        const audioSession = new SiriAudioSession(connection, this.selectedAudioConfiguration, this.audioProducerConstructor!, this.audioProducerOptions);
        if (!this.activeAudioSession) {
            this.activeAudioSession = audioSession;
        } else {
            // we checked above that this only happens if the activeAudioSession is in closing state,
            // so no collision with the input device can happen
            this.nextAudioSession = audioSession;
        }

        audioSession.on(SiriAudioSessionEvents.CLOSE, this.handleSiriAudioSessionClosed.bind(this, audioSession));
        audioSession.start();
    };

    private handleSiriAudioStop = () => {
        if (this.activeAudioSession) {
            if (!this.activeAudioSession.isClosing()) {
                this.activeAudioSession.stop();
                return;
            } else if (this.nextAudioSession && !this.nextAudioSession.isClosing()) {
                this.nextAudioSession.stop();
                return;
            }
        }

        debug("handleSiriAudioStop called although no audio session was started");
    };

    private handleDataSendAckEvent = (message: Record<any, any>) => { // transfer was successful
        const streamId = message["streamId"];
        const endOfStream = message["endOfStream"];

        if (this.activeAudioSession && this.activeAudioSession.streamId === streamId) {
            this.activeAudioSession.handleDataSendAckEvent(endOfStream);
        } else if (this.nextAudioSession && this.nextAudioSession.streamId === streamId) {
            this.nextAudioSession.handleDataSendAckEvent(endOfStream);
        } else {
            debug("Received dataSend acknowledgment event for unknown streamId '%s'", streamId);
        }
    };

    private handleDataSendCloseEvent = (message: Record<any, any>) => { // controller indicates he can't handle audio request currently
        const streamId = message["streamId"];
        const reason = message["reason"] as DataSendCloseReason;

        if (this.activeAudioSession && this.activeAudioSession.streamId === streamId) {
            this.activeAudioSession.handleDataSendCloseEvent(reason);
        } else if (this.nextAudioSession && this.nextAudioSession.streamId === streamId) {
            this.nextAudioSession.handleDataSendCloseEvent(reason);
        } else {
            debug("Received dataSend close event for unknown streamId '%s'", streamId);
        }
    };

    private handleSiriAudioSessionClosed = (session: SiriAudioSession) => {
        if (session === this.activeAudioSession) {
            this.activeAudioSession = this.nextAudioSession;
            this.nextAudioSession = undefined;
        } else if (session === this.nextAudioSession) {
            this.nextAudioSession = undefined;
        }
    };

    private handleDataStreamConnectionClosed = (connection: DataStreamConnection) => {
        for (const targetIdentifier in this.dataStreamConnections) {
            const connection0 = this.dataStreamConnections[targetIdentifier];
            if (connection === connection0) {
                debug("HDS connection disconnected for targetIdentifier %s", targetIdentifier);
                delete this.dataStreamConnections[targetIdentifier];
                break;
            }
        }
    };

    // ------------------------------- AUDIO CONFIGURATION -------------------------------

    private handleSelectedAudioConfigurationWrite = (value: any, callback: CharacteristicSetCallback) => {
        const data = Buffer.from(value, 'base64');
        const objects = tlv.decode(data);

        const selectedAudioStreamConfiguration = tlv.decode(
            objects[SelectedAudioInputStreamConfigurationTypes.SELECTED_AUDIO_INPUT_STREAM_CONFIGURATION]
        );

        const codec = selectedAudioStreamConfiguration[AudioTypes.CODEC][0];
        const parameters = tlv.decode(selectedAudioStreamConfiguration[AudioTypes.CODEC_PARAM]);

        const channels = parameters[AudioCodecParamTypes.CHANNEL][0];
        const bitrate = parameters[AudioCodecParamTypes.BIT_RATE][0];
        const samplerate = parameters[AudioCodecParamTypes.SAMPLE_RATE][0];

        this.selectedAudioConfiguration = {
            codecType: codec,
            parameters: {
                channels: channels,
                bitrate: bitrate,
                samplerate: samplerate,
                rtpTime: 20
            }
        };
        this.selectedAudioConfigurationString = this.buildSelectedAudioConfigurationTLV({
            audioCodecConfiguration: this.selectedAudioConfiguration,
        });

        callback();
    };

    private buildSupportedAudioConfigurationTLV = (configuration: SupportedAudioStreamConfiguration) => {
        const codecConfigurationTLV = this.buildCodecConfigurationTLV(configuration.audioCodecConfiguration);

        const supportedAudioStreamConfiguration = tlv.encode(
            SupportedAudioStreamConfigurationTypes.AUDIO_CODEC_CONFIGURATION, codecConfigurationTLV
        );
        return supportedAudioStreamConfiguration.toString('base64');
    };

    private buildSelectedAudioConfigurationTLV = (configuration: SelectedAudioStreamConfiguration) => {
        const codecConfigurationTLV = this.buildCodecConfigurationTLV(configuration.audioCodecConfiguration);

        const supportedAudioStreamConfiguration = tlv.encode(
            SelectedAudioInputStreamConfigurationTypes.SELECTED_AUDIO_INPUT_STREAM_CONFIGURATION, codecConfigurationTLV,
        );
        return supportedAudioStreamConfiguration.toString('base64');
    };

    private buildCodecConfigurationTLV = (codecConfiguration: AudioCodecConfiguration) => {
        const parameters = codecConfiguration.parameters;

        let parametersTLV = tlv.encode(
            AudioCodecParamTypes.CHANNEL, parameters.channels,
            AudioCodecParamTypes.BIT_RATE, parameters.bitrate,
            AudioCodecParamTypes.SAMPLE_RATE, parameters.samplerate,
        );
        if (parameters.rtpTime) {
            parametersTLV = Buffer.concat([
                parametersTLV,
                tlv.encode(AudioCodecParamTypes.PACKET_TIME, parameters.rtpTime)
            ]);
        }

        return tlv.encode(
            AudioTypes.CODEC, codecConfiguration.codecType,
            AudioTypes.CODEC_PARAM, parametersTLV
        );
    };

    // -----------------------------------------------------------------------------------

    _createServices = () => {
        this.targetControlManagementService = new Service.TargetControlManagement('', '');
        this.targetControlManagementService.getCharacteristic(Characteristic.TargetControlSupportedConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(null, this.supportedConfiguration);
            }).getValue();
        this.targetControlManagementService.getCharacteristic(Characteristic.TargetControlList)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(null, this.targetConfigurationsString);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.handleTargetControlWrite(value, callback);
            }).getValue();

        // you can also expose multiple TargetControl services to control multiple apple tvs simultaneously.
        // should we extend this class to support multiple TargetControl services or should users just create a second accessory?
        this.targetControlService = new Service.TargetControl('', '');
        this.targetControlService.getCharacteristic(Characteristic.ActiveIdentifier)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.activeIdentifier);
            }).getValue();
        this.targetControlService.getCharacteristic(Characteristic.Active)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.isActive());
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context?: any, connectionID?: string) => {
                this.handleActiveWrite(value, callback, connectionID);
            }).getValue();
        this.targetControlService.getCharacteristic(Characteristic.ButtonEvent)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.lastButtonEvent);
            }).getValue();

        if (this.audioSupported) {
            this.siriService = new Service.Siri('', '');
            this.siriService.getCharacteristic(Characteristic.SiriInputType)!
                .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                    callback(undefined, SiriInputType.PUSH_BUTTON_TRIGGERED_APPLE_TV);
                });

            this.audioStreamManagementService = new Service.AudioStreamManagement('', '');
            this.audioStreamManagementService.getCharacteristic(Characteristic.SupportedAudioStreamConfiguration)!
                .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                    callback(undefined, this.supportedAudioConfiguration);
                }).getValue();
            this.audioStreamManagementService.getCharacteristic(Characteristic.SelectedAudioStreamConfiguration)!
                .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                    callback(null, this.selectedAudioConfigurationString);
                })
                .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                    this.handleSelectedAudioConfigurationWrite(value, callback);
                }).getValue();

            this.dataStreamManagement = new DataStreamManagement();

            this.siriService.addLinkedService(this.dataStreamManagement.getService());
            this.siriService.addLinkedService(this.audioStreamManagementService);
        }
    }
}

export enum SiriAudioSessionEvents {
    CLOSE = "close",
}

export type SiriAudioSessionEventMap = {
    [SiriAudioSessionEvents.CLOSE]: () => void;
}

/**
 * Represents an ongoing audio transmission
 */
export class SiriAudioSession extends EventEmitter<SiriAudioSessionEventMap> {

    readonly connection: DataStreamConnection;
    private readonly selectedAudioConfiguration: AudioCodecConfiguration;

    private readonly producer: SiriAudioStreamProducer;
    private producerRunning = false; // indicates if the producer is running
    private producerTimer?: Timeout; // producer has a 3s timeout to produce the first frame, otherwise transmission will be cancelled

    state: SiriAudioSessionState = SiriAudioSessionState.STARTING;
    streamId?: number; // present when state >= SENDING
    endOfStream: boolean = false;

    private audioFrameQueue: AudioFrame[] = [];
    private readonly maxQueueSize = 1024;
    private sequenceNumber: number = 0;

    private readonly closeListener: () => void;

    constructor(connection: DataStreamConnection, selectedAudioConfiguration: AudioCodecConfiguration, producerConstructor: SiriAudioStreamProducerConstructor, producerOptions?: any) {
        super();
        this.connection = connection;
        this.selectedAudioConfiguration = selectedAudioConfiguration;

        this.producer = new producerConstructor(this.handleSiriAudioFrame.bind(this), this.handleProducerError.bind(this), producerOptions);

        this.connection.on(DataStreamConnectionEvents.CLOSED, this.closeListener = this.handleDataStreamConnectionClosed.bind(this));
    }

    /**
     * Called when siri button is pressed
     */
    start() {
        debug("Sending request to start siri audio stream");

        // opening dataSend
        this.connection.sendRequest(Protocols.DATA_SEND, Topics.OPEN, {
            target: "controller",
            type: "audio.siri"
        }, (error, status, message) => {
            if (this.state === SiriAudioSessionState.CLOSED) {
                debug("Ignoring dataSend open response as the session is already closed");
                return;
            }

            assert.strictEqual(this.state, SiriAudioSessionState.STARTING);
            this.state = SiriAudioSessionState.SENDING;

            if (error || status) {
                if (error) { // errors get produced by hap-nodejs
                    debug("Error occurred trying to start siri audio stream: %s", error.message);
                } else if (status) { // status codes are those returned by the hds response
                    debug("Controller responded with non-zero status code: %s", HDSStatus[status]);
                }
                this.closed();
            } else {
                this.streamId = message["streamId"];

                if (!this.producerRunning) { // audio producer errored in the meantime
                    this.sendDataSendCloseEvent(DataSendCloseReason.CANCELLED);
                } else {
                    debug("Successfully setup siri audio stream with streamId %d", this.streamId);
                }
            }
        });

        this.startAudioProducer(); // start audio producer and queue frames in the meantime
    }

    /**
     * @returns if the audio session is closing
     */
    isClosing() {
        return this.state >= SiriAudioSessionState.CLOSING;
    }

    /**
     * Called when siri button is released (or active identifier is changed to another device)
     */
    stop() {
        assert(this.state <= SiriAudioSessionState.SENDING, "state was higher than SENDING");

        debug("Stopping siri audio stream with streamId %d", this.streamId);

        this.endOfStream = true; // mark as endOfStream
        this.stopAudioProducer();

        if (this.state === SiriAudioSessionState.SENDING) {
            this.handleSiriAudioFrame(undefined); // send out last few audio frames with endOfStream property set

            this.state = SiriAudioSessionState.CLOSING; // we are waiting for an acknowledgment (triggered by endOfStream property)
        } else { // if state is not SENDING (aka state is STARTING) the callback for DATA_SEND OPEN did not yet return (or never will)
            this.closed();
        }
    }

    private startAudioProducer() {
        this.producer.startAudioProduction(this.selectedAudioConfiguration);
        this.producerRunning = true;

        this.producerTimer = setTimeout(() => { // producer has 3s to start producing audio frames
            debug("Didn't receive any frames from audio producer for stream with streamId %s. Canceling the stream now.", this.streamId);
            this.producerTimer = undefined;
            this.handleProducerError(DataSendCloseReason.CANCELLED);
        }, 3000);
    }

    private stopAudioProducer() {
        this.producer.stopAudioProduction();
        this.producerRunning = false;

        if (this.producerTimer) {
            clearTimeout(this.producerTimer);
            this.producerTimer = undefined;
        }
    }

    private handleSiriAudioFrame = (frame?: AudioFrame) => { // called from audio producer
        if (this.state >= SiriAudioSessionState.CLOSING) {
            return;
        }

        if (this.producerTimer) { // if producerTimer is defined, then this is the first frame we are receiving
            clearTimeout(this.producerTimer);
            this.producerTimer = undefined;
        }

        if (frame && this.audioFrameQueue.length < this.maxQueueSize) { // add frame to queue whilst it is not full
            this.audioFrameQueue.push(frame);
        }

        if (this.state !== SiriAudioSessionState.SENDING) { // dataSend isn't open yet
            return;
        }

        let queued;
        while ((queued = this.popSome()) !== null) { // send packets
            const packets: AudioFramePacket[] = [];
            queued.forEach(frame => {
                const packetData: AudioFramePacket = {
                    data: frame.data,
                    metadata: {
                        rms: new Float32(frame.rms),
                        sequenceNumber: new Int64(this.sequenceNumber++),
                    }
                };
                packets.push(packetData);
            });

            const message: DataSendMessageData = {
                packets: packets,
                streamId: new Int64(this.streamId!),
                endOfStream: this.endOfStream,
            };

            try {
                this.connection.sendEvent(Protocols.DATA_SEND, Topics.DATA, message);
            } catch (error) {
                debug("Error occurred when trying to send audio frame of hds connection: %s", error.message);

                this.stopAudioProducer();
                this.closed();
            }

            if (this.endOfStream) {
                break; // popSome() returns empty list if endOfStream=true
            }
        }
    };

    private handleProducerError = (error: DataSendCloseReason) => { // called from audio producer
        if (this.state >= SiriAudioSessionState.CLOSING) {
            return;
        }

        this.stopAudioProducer(); // ensure backend is closed
        if (this.state === SiriAudioSessionState.SENDING) { // if state is less than sending dataSend isn't open (yet)
            this.sendDataSendCloseEvent(error); // cancel submission
        }
    };

    handleDataSendAckEvent = (endOfStream: boolean) => { // transfer was successful
        assert.strictEqual(endOfStream, true);

        debug("Received acknowledgment for siri audio stream with streamId %s, closing it now", this.streamId);

        this.sendDataSendCloseEvent(DataSendCloseReason.NORMAL);
    };

    handleDataSendCloseEvent = (reason: DataSendCloseReason) => { // controller indicates he can't handle audio request currently
        debug("Received close event from controller with reason %s for stream with streamId %s", DataSendCloseReason[reason], this.streamId);
        if (this.state <= SiriAudioSessionState.SENDING) {
            this.stopAudioProducer();
        }

        this.closed();
    };

    private sendDataSendCloseEvent = (reason: DataSendCloseReason) => {
        assert(this.state >= SiriAudioSessionState.SENDING, "state was less than SENDING");
        assert(this.state <= SiriAudioSessionState.CLOSING, "state was higher than CLOSING");

        this.connection.sendEvent(Protocols.DATA_SEND, Topics.CLOSE, {
            streamId: new Int64(this.streamId!),
            reason: new Int64(reason),
        });

        this.closed();
    };

    private handleDataStreamConnectionClosed = () => {
        debug("Closing audio session with streamId %d", this.streamId);

        if (this.state <= SiriAudioSessionState.SENDING) {
            this.stopAudioProducer();
        }

        this.closed();
    };

    private closed = () => {
        const lastState = this.state;
        this.state = SiriAudioSessionState.CLOSED;

        if (lastState !== SiriAudioSessionState.CLOSED) {
            this.emit(SiriAudioSessionEvents.CLOSE);
            this.connection.removeListener(DataStreamConnectionEvents.CLOSED, this.closeListener);
        }
    };

    private popSome() { // tries to return 5 elements from the queue, if endOfStream=true also less than 5
        if (this.audioFrameQueue.length < 5 && !this.endOfStream) {
            return null;
        }

        const size = Math.min(this.audioFrameQueue.length, 5); // 5 frames per hap packet seems fine
        const result = [];
        for (let i = 0; i < size; i++) {
            const element = this.audioFrameQueue.shift()!; // removes first element
            result.push(element);
        }

        return result;
    }

}
