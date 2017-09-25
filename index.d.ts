declare namespace HAPNodeJS {

    export interface uuid {
        generate(data: string): string;
        isValid(UUID: string): boolean;
        unparse(bug: string, offset: number): string;
    }

    type EventService = "characteristic-change" | "service-configurationChange"

    export interface IEventEmitterAccessory {
        addListener(event: EventService, listener: Function): this;
        on(event: EventService, listener: Function): this;
        once(event: EventService, listener: Function): this;
        removeListener(event: EventService, listener: Function): this;
        removeAllListeners(event?: EventService): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: EventService): Function[];
        emit(event: EventService, ...args: any[]): boolean;
        listenerCount(type: string): number;
    }

    export interface Service extends IEventEmitterAccessory {
        new (displayName: string, UUID: string, subtype: string): Service;

        displayName: string;
        UUID: string;
        subtype: string;
        iid: string;
        characteristics: Characteristic[];
        optionalCharacteristics: Characteristic[];

        addCharacteristic(characteristic: Characteristic | Function): Characteristic;
        removeCharacteristic(characteristic: Characteristic): void;
        getCharacteristic(name: string | Function): Characteristic;
        testCharacteristic(name: string): boolean;
        setCharacteristic(name: string | Function, value: string): Service;
        updateCharacteristic(name: string, value: string): Service;
        addOptionalCharacteristic(characteristic: Characteristic | Function): void;
        getCharacteristicByIID(iid: string): Characteristic;

        toHAP(opt: any): JSON;

        AccessoryInformation: Service;
        AirPurifier: Service;
        AirQualitySensor: Service;
        BatteryService: Service;
        CameraControl: Service;
        CameraRTPStreamManagement: Service;
        CarbonDioxideSensor: Service;
        CarbonMonoxideSensor: Service;
        ContactSensor: Service;
        Door: Service;
        Doorbell: Service;
        Fan: Service;
        Fanv2: Service;
        FilterMaintenance: Service;
        GarageDoorOpener: Service;
        HeaterCooler: Service;
        HumidifierDehumidifier: Service;
        HumiditySensor: Service;
        LeakSensor: Service;
        LightSensor: Service;
        Lightbulb: Service;
        LockManagement: Service;
        LockMechanism: Service;
        Microphone: Service;
        MotionSensor: Service;
        OccupancySensor: Service;
        Outlet: Service;
        SecuritySystem: Service;
        Slat: Service;
        SmokeSensor: Service;
        Speaker: Service;
        StatefulProgrammableSwitch: Service;
        StatelessProgrammableSwitch: Service;
        Switch: Service;
        TemperatureSensor: Service;
        Thermostat: Service;
        Window: Service;
        WindowCovering: Service;
    }

    export interface CameraSource {

    }

    type EventAccessory = "service-configurationChange" | "service-characteristic-change" | "identify"

    export interface IEventEmitterAccessory {
        addListener(event: EventAccessory, listener: Function): this;
        on(event: EventAccessory, listener: Function): this;
        once(event: EventAccessory, listener: Function): this;
        removeListener(event: EventAccessory, listener: Function): this;
        removeAllListeners(event?: EventAccessory): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: EventAccessory): Function[];
        emit(event: EventAccessory, ...args: any[]): boolean;
        listenerCount(type: string): number;
    }

    export interface CharacteristicProps {
        format: Characteristic.Formats;
        unit: Characteristic.Units,
        minValue: number,
        maxValue: number,
        minStep: number,
        perms: Characteristic.Perms[]
    }

    type EventCharacteristic = "get" | "set"

    export interface IEventEmitterCharacteristic {
        addListener(event: EventCharacteristic, listener: Function): this;
        on(event: EventCharacteristic, listener: Function): this;
        once(event: EventCharacteristic, listener: Function): this;
        removeListener(event: EventCharacteristic, listener: Function): this;
        removeAllListeners(event?: EventCharacteristic): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: EventCharacteristic): Function[];
        emit(event: EventCharacteristic, ...args: any[]): boolean;
        listenerCount(type: string): number;
    }

    export interface Characteristic extends IEventEmitterCharacteristic {
        new (displayName: string, UUID: string, props?: CharacteristicProps): Characteristic;

        Formats: typeof Characteristic.Formats;
        Units: typeof Characteristic.Units;
        Perms: typeof Characteristic.Perms;

        setProps(props: CharacteristicProps): Characteristic
        getValue(callback?: (error: Error, value: boolean | string | number) => void, context?: any, connectionID?: string): void;
        setValue(newValue: boolean | string | number, callback?: (error: Error) => void, context?: any, connectionID?: string): Characteristic;
        updateValue(newValue: boolean | string | number, callback?: () => void, context?: any): Characteristic;
        getDefaultValue(): boolean | string | number;
        toHAP(opt: any): JSON;

        AccessoryFlags: Characteristic;
        Active: Characteristic;
        AdministratorOnlyAccess: Characteristic;
        AirParticulateDensity: Characteristic;
        AirParticulateSize: Characteristic;
        AirQuality: Characteristic;
        AppMatchingIdentifier: Characteristic;
        AudioFeedback: Characteristic;
        BatteryLevel: Characteristic;
        Brightness: Characteristic;
        CarbonDioxideDetected: Characteristic;
        CarbonDioxideLevel: Characteristic;
        CarbonDioxidePeakLevel: Characteristic;
        CarbonMonoxideDetected: Characteristic;
        CarbonMonoxideLevel: Characteristic;
        CarbonMonoxidePeakLevel: Characteristic;
        ChargingState: Characteristic;
        ContactSensorState: Characteristic;
        CoolingThresholdTemperature: Characteristic;
        CurrentAirPurifierState: Characteristic;
        CurrentAmbientLightLevel: Characteristic;
        CurrentDoorState: Characteristic;
        CurrentFanState: Characteristic;
        CurrentHeaterCoolerState: Characteristic;
        CurrentHeatingCoolingState: Characteristic;
        CurrentHorizontalTiltAngle: Characteristic;
        CurrentHumidifierDehumidifierState: Characteristic;
        CurrentPosition: Characteristic;
        CurrentRelativeHumidity: Characteristic;
        CurrentSlatState: Characteristic;
        CurrentTemperature: Characteristic;
        CurrentTiltAngle: Characteristic;
        CurrentVerticalTiltAngle: Characteristic;
        DigitalZoom: Characteristic;
        FilterChangeIndication: Characteristic;
        FilterLifeLevel: Characteristic;
        FirmwareRevision: Characteristic;
        HardwareRevision: Characteristic;
        HeatingThresholdTemperature: Characteristic;
        HoldPosition: Characteristic;
        Hue: Characteristic;
        Identify: Characteristic;
        ImageMirroring: Characteristic;
        ImageRotation: Characteristic;
        LeakDetected: Characteristic;
        LockControlPoint: Characteristic;
        LockCurrentState: Characteristic;
        LockLastKnownAction: Characteristic;
        LockManagementAutoSecurityTimeout: Characteristic;
        LockPhysicalControls: Characteristic;
        LockTargetState: Characteristic;
        Logs: Characteristic;
        Manufacturer: Characteristic;
        Model: Characteristic;
        Mute: Characteristic;
        MotionDetected: Characteristic;
        Name: Characteristic;
        NightVision: Characteristic;
        NitrogenDioxideDensity: Characteristic;
        ObstructionDetected: Characteristic;
        OccupancyDetected: Characteristic;
        On: Characteristic;
        OpticalZoom: Characteristic;
        OutletInUse: Characteristic;
        OzoneDensity: Characteristic;
        PairSetup: Characteristic;
        PairVerify: Characteristic;
        PairingFeatures: Characteristic;
        PairingPairings: Characteristic;
        PM10Density: Characteristic;
        PM2_5Density: Characteristic;
        PositionState: Characteristic;
        ProgrammableSwitchEvent: Characteristic;
        ProgrammableSwitchOutputState: Characteristic;
        RelativeHumidityDehumidifierThreshold: Characteristic;
        RelativeHumidityHumidifierThreshold: Characteristic;
        ResetFilterIndication: Characteristic;
        RotationDirection: Characteristic;
        RotationSpeed: Characteristic;
        Saturation: Characteristic;
        SecuritySystemAlarmType: Characteristic;
        SecuritySystemCurrentState: Characteristic;
        SecuritySystemTargetState: Characteristic;
        SelectedStreamConfiguration: Characteristic;
        SerialNumber: Characteristic;
        SetupEndpoints: Characteristic;
        SlatType: Characteristic;
        SmokeDetected: Characteristic;
        SoftwareRevision: Characteristic;
        StatusActive: Characteristic;
        StatusFault: Characteristic;
        StatusJammed: Characteristic;
        StatusLowBattery: Characteristic;
        StatusTampered: Characteristic;
        StreamingStatus: Characteristic;
        SulphurDioxideDensity: Characteristic;
        SupportedAudioStreamConfiguration: Characteristic;
        SupportedRTPConfiguration: Characteristic;
        SupportedVideoStreamConfiguration: Characteristic;
        SwingMode: Characteristic;
        TargetAirPurifierState: Characteristic;
        TargetAirQuality: Characteristic;
        TargetDoorState: Characteristic;
        TargetFanState: Characteristic;
        TargetHeaterCoolerState: Characteristic;
        TargetHeatingCoolingState: Characteristic;
        TargetHorizontalTiltAngle: Characteristic;
        TargetHumidifierDehumidifierState: Characteristic;
        TargetPosition: Characteristic;
        TargetRelativeHumidity: Characteristic;
        TargetSlatState: Characteristic;
        TargetTemperature: Characteristic;
        TargetTiltAngle: Characteristic;
        TargetVerticalTiltAngle: Characteristic;
        TemperatureDisplayUnits: Characteristic;
        Version: Characteristic;
        VOCDensity: Characteristic;
        Volume: Characteristic;
        WaterLevel: Characteristic;
    }


    module Characteristic {
        export enum Formats {
            BOOL,
            INT,
            FLOAT,
            STRING,
            ARRAY, // unconfirmed
            DICTIONARY, // unconfirmed
            UINT8,
            UINT16,
            UINT32,
            UINT64,
            DATA, // unconfirmed
            TLV8
        }

        export enum Units {
            // HomeKit only defines Celsius, for Fahrenheit, it requires iOS app to do the conversion.
            CELSIUS,
            PERCENTAGE,
            ARC_DEGREE,
            LUX,
            SECONDS
        }

        export enum Perms {
            READ,
            WRITE,
            NOTIFY,
            HIDDEN
        }
    }

    export interface PublishInfo {
        port: number;
        username: string;
        pincode: string;
        category: number;
    }

    export interface Accessory extends IEventEmitterAccessory {
        new (displayName: string, UUID: string): Accessory;
        displayName: string;
        username: string;
        pincode: string;
        UUID: string;
        aid: string;
        bridged: boolean;
        bridgedAccessories: Accessory[];
        reachable: boolean;
        category: Accessory.Categories;
        services: Service[];
        cameraSource: CameraSource;
        Categories: typeof Accessory.Categories
        addService(service: Service | Function): Service;
        removeService(service: Service): void;
        getService(name: string | Function): Service;
        updateReachability(reachable: boolean): void;
        addBridgedAccessory(accessory: Accessory, deferUpdate: boolean): Accessory;
        addBridgedAccessories(accessories: Accessory[]): void
        removeBridgedAccessory(accessory: Accessory, deferUpdate: boolean): void;
        removeBridgedAccessories(accessories: Accessory[]): void;
        getCharacteristicByIID(iid: string): Characteristic;
        getBridgedAccessoryByAID(aid: string): Accessory;
        findCharacteristic(aid: string, iid: string): Accessory;
        configureCameraSource(cameraSource: CameraSource): void;
        toHAP(opt: any): JSON;
        publish(info: PublishInfo, allowInsecureRequest: boolean): void;
        destroy(): void;
    }

    module Accessory {
        export enum Categories {
            OTHER = 1,
            BRIDGE = 2,
            FAN = 3,
            GARAGE_DOOR_OPENER = 4,
            LIGHTBULB = 5,
            DOOR_LOCK = 6,
            OUTLET = 7,
            SWITCH = 8,
            THERMOSTAT = 9,
            SENSOR = 10,
            ALARM_SYSTEM = 11,
            DOOR = 12,
            WINDOW = 13,
            WINDOW_COVERING = 14,
            PROGRAMMABLE_SWITCH = 15,
            RANGE_EXTENDER = 16,
            CAMERA = 17
        }
    }

    export interface HAPNodeJS {
        init(storagePath?: string): void,
        uuid: uuid,
        Accessory: Accessory,
        Service: any,
        Characteristic: any
    }


}

declare var hapNodeJS: HAPNodeJS.HAPNodeJS;

declare module "hap-nodejs" {
    export = hapNodeJS;
}