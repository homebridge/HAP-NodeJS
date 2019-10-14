import * as tlv from './util/tlv';
import bufferShim from "buffer-shims";
import createDebug from 'debug';

import { Service } from "./Service";
import {
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback
} from "./Characteristic";
import { CharacteristicValue } from "../types";
import { Status } from "./HAPServer";
import { Accessory } from "./Accessory";

const debug = createDebug('HomeKitRemoteController');

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
    buttonConfiguration: ButtonConfiguration[]
}

export type ButtonConfiguration = {
    buttonID: number,
    buttonType: ButtonType,
    buttonName?: string
}

export class HomeKitRemoteController {

    targetControlManagementService?: Service;
    targetControlService?: Service;

    buttons: Record<number, number>;
    supportedConfiguration: string;
    // it is advice to persistently store this configuration below, but HomeKit seems to just reconfigure itself
    // after an reboot of the accessory. If someone has the time to implement persistent storage
    // 'activeIdentifier' and 'active' should probably be included as well
    targetConfigurations: Record<number, TargetConfiguration>;
    targetConfigurationsString: string;

    lastButtonEvent: string;

    activeIdentifier: number;
    active: boolean;

    constructor() {
        this.buttons = {};
        const configuration: SupportedConfiguration = this.constructSupportedConfiguration();
        this.supportedConfiguration = this._targetControlSupportedConfiguration(configuration);
        this.targetConfigurations = {};
        this.targetConfigurationsString = "";

        this.lastButtonEvent = "";

        this.activeIdentifier = 0; // id of 0 means no device selected
        this.active = false;

        this._createServices();
    }

    pushButton = (button: ButtonType) => {
        const timestamp = new Date().getTime();
        this._buttonEvent(this.buttons[button], ButtonState.DOWN, timestamp, this.activeIdentifier);
        debug("Pressed button %d", button);
    };

    releaseButton = (button: ButtonType) => {
        const timestamp = new Date().getTime();
        this._buttonEvent(this.buttons[button], ButtonState.UP, timestamp, this.activeIdentifier);
        debug("Released button %d", button);
    };

    setActiveIdentifier = (activeIdentifier: number) => {
        debug("%d is now active", activeIdentifier);
        this.activeIdentifier = activeIdentifier;
        this.targetControlService!.getCharacteristic(Characteristic.ActiveIdentifier)!.updateValue(activeIdentifier);
    };

    isConfigured = (targetIdentifier: number) => {
        return this.targetConfigurations[targetIdentifier] !== undefined;
    };

    getTargetIdentifierByName = (name: string) => {
        for (const activeIdentifier in this.targetConfigurations) {
            const configuration = this.targetConfigurations[activeIdentifier];
            if (configuration.targetName === name) {
                return parseInt(activeIdentifier);
            }
        }
        return undefined;
    };

    addServicesToAccessory = (accessory: Accessory) => {
        if (!this.targetControlManagementService || !this.targetControlService) {
            throw new Error("Services not configured!"); // playing it save
        }

        accessory.addService(this.targetControlManagementService);
        accessory.setPrimaryService(this.targetControlManagementService);
        accessory.addService(this.targetControlService);
    };

    constructSupportedConfiguration = () => {
        const configuration: SupportedConfiguration = {
            maximumTargets: 10, // some random number. (ten should be okay?)
            ticksPerSecond: 1000, // we rely on unix timestamps
            supportedButtonConfiguration: [],
            hardwareImplemented: false // siri is only allowed for hardware implemented remotes
        };

        const supportedButtons = [ // siri button is left out
            ButtonType.MENU, ButtonType.PLAY_PAUSE, ButtonType.TV_HOME, ButtonType.SELECT,
            ButtonType.ARROW_UP, ButtonType.ARROW_RIGHT, ButtonType.ARROW_DOWN, ButtonType.ARROW_LEFT,
            ButtonType.VOLUME_UP, ButtonType.VOLUME_DOWN, ButtonType.POWER, ButtonType.GENERIC
        ];
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

    _buttonEvent = (buttonID: number, buttonState: ButtonState, timestamp: number, activeIdentifier: number) => {
        if (activeIdentifier === 0)
            return; // cannot press button if no device is selected

        const buttonIdTlv = tlv.encode(
            ButtonEvent.BUTTON_ID, buttonID
        );

        const buttonStateTlv = tlv.encode(
            ButtonEvent.BUTTON_STATE, buttonState
        );

        const timestampTlv = tlv.encode(
            ButtonEvent.TIMESTAMP, tlv.writeUInt64(timestamp)
            // timestamp should be uint64. bigint though is only supported by node 10.4.0 and above
            // thus we just interpret timestamp as a regular number
        );

        const activeIdentifierTlv = tlv.encode(
            ButtonEvent.ACTIVE_IDENTIFIER, tlv.writeUInt32(activeIdentifier)
        );

        this.lastButtonEvent = Buffer.concat([
            buttonIdTlv, buttonStateTlv, timestampTlv, activeIdentifierTlv
        ]).toString('base64');
        this.targetControlService!.getCharacteristic(Characteristic.ButtonEvent)!.updateValue(this.lastButtonEvent);
    };

    _handleTargetControlWrite = (value: any, callback: CharacteristicSetCallback) => {
        const data = bufferShim.from(value, 'base64');
        const objects = tlv.decode(data);

        const operation = objects[TargetControlList.OPERATION][0];

        let targetConfiguration: TargetConfiguration | undefined = undefined;
        if (objects[TargetControlList.TARGET_CONFIGURATION]) { // if target configuration was sent, parse it
            targetConfiguration = this._parseTargetConfiguration(objects[TargetControlList.TARGET_CONFIGURATION]);
        }

        debug("Received TargetControl write operation %s%s", Operation[operation], targetConfiguration !== undefined
            ? "with configuration: " + JSON.stringify(targetConfiguration)
            : "");

        if (targetConfiguration === undefined && (operation === Operation.ADD || operation === Operation.UPDATE || operation === Operation.REMOVE)) {
            callback(new Error(Status.INVALID_VALUE_IN_REQUEST + ""));
            return;
        } else if (targetConfiguration && (operation === Operation.LIST || operation === Operation.RESET)) {
            callback(new Error(Status.INVALID_VALUE_IN_REQUEST + ""));
            return;
        }

        switch (operation) {
            case Operation.ADD:
                this.targetConfigurations[targetConfiguration!.targetIdentifier] = targetConfiguration!;

                this.targetConfigurationsString = this._targetConfigurations(this.targetConfigurations);
                break;
            case Operation.UPDATE:
                // update only seems to update button configuration, leaving out names and category
                // for me it always removes the volume buttons from the configuration. Why, i don't know

                const savedTargetConfiguration = this.targetConfigurations[targetConfiguration!.targetIdentifier];
                if (targetConfiguration!.targetName)
                    savedTargetConfiguration.targetName = targetConfiguration!.targetName;
                if (targetConfiguration!.targetCategory)
                    savedTargetConfiguration.targetCategory = targetConfiguration!.targetCategory;
                if (targetConfiguration!.buttonConfiguration)
                    savedTargetConfiguration.buttonConfiguration = targetConfiguration!.buttonConfiguration;

                this.targetConfigurationsString = this._targetConfigurations(this.targetConfigurations);
                break;
            case Operation.REMOVE:
                delete this.targetConfigurations[targetConfiguration!.targetIdentifier];

                this.targetConfigurationsString = this._targetConfigurations(this.targetConfigurations);
                break;
            case Operation.RESET:
                this.targetConfigurations = {};
                this.targetConfigurationsString = "";
                break;
            case Operation.LIST:
                this.targetConfigurationsString = this._targetConfigurations(this.targetConfigurations);
                break;
        }

        callback(undefined, this.targetConfigurationsString); // passing value for write response
        debug("Returning target configuration: " + this.targetConfigurationsString);

        if (operation === Operation.ADD)
            this.setActiveIdentifier(targetConfiguration!.targetIdentifier);
    };

    _parseTargetConfiguration = (data: Buffer) => {
        const configTLV = tlv.decode(data);

        const identifier = tlv.readUInt32(configTLV[TargetConfigurationTypes.TARGET_IDENTIFIER]);

        let name = undefined;
        if (configTLV[TargetConfigurationTypes.TARGET_NAME])
            name = configTLV[TargetConfigurationTypes.TARGET_NAME].toString();

        let category = undefined;
        if (configTLV[TargetConfigurationTypes.TARGET_CATEGORY])
            category = tlv.readUInt16(configTLV[TargetConfigurationTypes.TARGET_CATEGORY]);

        const buttonConfiguration: ButtonConfiguration[] = [];

        if (configTLV[TargetConfigurationTypes.BUTTON_CONFIGURATION]) {
            const buttonConfigurationTLV = tlv.decodeList(configTLV[TargetConfigurationTypes.BUTTON_CONFIGURATION], ButtonConfigurationTypes.BUTTON_ID);
            buttonConfigurationTLV.forEach(entry => {
                const buttonId = entry[ButtonConfigurationTypes.BUTTON_ID][0];
                const buttonType = tlv.readUInt16(entry[ButtonConfigurationTypes.BUTTON_TYPE]);
                let buttonName;
                if (entry[ButtonConfigurationTypes.BUTTON_NAME])
                    buttonName = entry[ButtonConfigurationTypes.BUTTON_NAME].toString();

                buttonConfiguration.push({
                    buttonID: buttonId,
                    buttonType: buttonType,
                    buttonName: buttonName
                })
            });
        }

        return {
            targetIdentifier: identifier,
            targetName: name,
            targetCategory: category,
            buttonConfiguration: buttonConfiguration
        } as TargetConfiguration;
    };

    _targetConfigurations = (configurations: Record<number, TargetConfiguration>) => {
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
            configuration.buttonConfiguration.forEach(value => {
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

    _targetControlSupportedConfiguration = (configuration: SupportedConfiguration) => {
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

        const type = tlv.encode(TargetControlCommands.TYPE, configuration.hardwareImplemented? 1: 0);

        return Buffer.concat(
            [maximumTargets, ticksPerSecond, supportedButtonConfiguration, type]
        ).toString('base64');
    };

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
                this._handleTargetControlWrite(value, callback);
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
                callback(undefined, this.active);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.active = value as boolean;
                callback();
            }).getValue();
        this.targetControlService.getCharacteristic(Characteristic.ButtonEvent)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.lastButtonEvent);
            }).getValue();

        /* The following characteristics are need for Siri support and the implementation of HomeKit Data Streams
        const siriService = new Service.Siri('', '');
        siriService.getCharacteristic(Characteristic.SiriInputType)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
               callback(undefined, 0); // push button triggered Apple TV
            });

        const dataStreamTransportManagement = new Service.DataStreamTransportManagement('', '');
        dataStreamTransportManagement.getCharacteristic(Characteristic.SupportedDataStreamTransportConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, "");
            });
        dataStreamTransportManagement.getCharacteristic(Characteristic.SetupDataStreamTransport)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(null, "");
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                const writeResponse = "";
                callback(null, writeResponse);
            }).getValue();
        dataStreamTransportManagement.getCharacteristic(Characteristic.Version)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, "1.0");
            });

        const audioStreamManagement = new Service.AudioStreamManagement('', '');
        audioStreamManagement.getCharacteristic(Characteristic.SupportedAudioStreamConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, "");
            });
        audioStreamManagement.getCharacteristic(Characteristic.SelectedAudioStreamConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(null, "");
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                callback();
            }).getValue();
        */
    }
}
