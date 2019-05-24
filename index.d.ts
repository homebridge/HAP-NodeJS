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
        testCharacteristic(name: string | Function): boolean;
        setCharacteristic(name: string | Function, value: CharacteristicValue): Service;
        updateCharacteristic(name: string | Function, value: CharacteristicValue): Service;
        addOptionalCharacteristic(characteristic: Characteristic | Function): void;
        getCharacteristicByIID(iid: string): Characteristic;

        toHAP(opt: any): JSON;

        AccessoryInformation: PredefinedService;
        AirPurifier: PredefinedService;
        AirQualitySensor: PredefinedService;
        BatteryService: PredefinedService;
        BridgeConfiguration: PredefinedService;
        BridgingState: PredefinedService;
        CameraControl: PredefinedService;
        CameraRTPStreamManagement: PredefinedService;
        CarbonDioxideSensor: PredefinedService;
        CarbonMonoxideSensor: PredefinedService;
        ContactSensor: PredefinedService;
        Door: PredefinedService;
        Doorbell: PredefinedService;
        Fan: PredefinedService;
        Fanv2: PredefinedService;
        Faucet: PredefinedService;
        FilterMaintenance: PredefinedService;
        GarageDoorOpener: PredefinedService;
        HeaterCooler: PredefinedService;
        HumidifierDehumidifier: PredefinedService;
        HumiditySensor: PredefinedService;
        InputSource: PredefinedService;
        IrrigationSystem: PredefinedService;
        LeakSensor: PredefinedService;
        LightSensor: PredefinedService;
        Lightbulb: PredefinedService;
        LockManagement: PredefinedService;
        LockMechanism: PredefinedService;
        Microphone: PredefinedService;
        MotionSensor: PredefinedService;
        OccupancySensor: PredefinedService;
        Outlet: PredefinedService;
        Pairing: PredefinedService;
        ProtocolInformation: PredefinedService;
        Relay: PredefinedService;
        SecuritySystem: PredefinedService;
        ServiceLabel: PredefinedService;
        Slat: PredefinedService;
        SmokeSensor: PredefinedService;
        Speaker: PredefinedService;
        StatefulProgrammableSwitch: PredefinedService;
        StatelessProgrammableSwitch: PredefinedService;
        Switch: PredefinedService;
        Television: PredefinedService;
        TelevisionSpeaker: PredefinedService;
        TemperatureSensor: PredefinedService;
        Thermostat: PredefinedService;
        TimeInformation: PredefinedService;
        TunneledBTLEAccessoryService: PredefinedService;
        Valve: PredefinedService;
        Window: PredefinedService;
        WindowCovering: PredefinedService;
    }
    
    export interface PredefinedService {
        new (displayName: string, subtype: string): Service;
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
    type CharacteristicValue = boolean | string | number

    export type CharacteristicGetCallback<T = CharacteristicValue> = (error: Error | null , value: T) => void
    export type CharacteristicSetCallback = (error?: Error | null) => void
    export type CharacteristicCallback = CharacteristicGetCallback | CharacteristicSetCallback

    export interface IEventEmitterCharacteristic {
        addListener(event: EventCharacteristic, listener: CharacteristicCallback): this;
        on(event: EventCharacteristic, listener: CharacteristicCallback): this;
        once(event: EventCharacteristic, listener: CharacteristicCallback): this;
        removeListener(event: EventCharacteristic, listener: CharacteristicCallback): this;
        removeAllListeners(event?: EventCharacteristic): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: EventCharacteristic): CharacteristicCallback[];
        emit(event: EventCharacteristic, ...args: any[]): boolean;
        listenerCount(type: string): number;
    }

    export interface Characteristic extends IEventEmitterCharacteristic {
        new (displayName: string, UUID: string, props?: CharacteristicProps): Characteristic;

        Formats: typeof Characteristic.Formats;
        Units: typeof Characteristic.Units;
        Perms: typeof Characteristic.Perms;

        setProps(props: CharacteristicProps): Characteristic
        getValue(callback?: CharacteristicGetCallback, context?: any, connectionID?: string): void;
        setValue(newValue: CharacteristicValue, callback?: CharacteristicSetCallback, context?: any, connectionID?: string): Characteristic;
        updateValue(newValue: CharacteristicValue, callback?: () => void, context?: any): Characteristic;
        getDefaultValue(): CharacteristicValue;
        toHAP(opt: any): JSON;

        AccessoryFlags: Characteristic;
        AccessoryIdentifier: Characteristic;
        Active: Characteristic;
        ActiveIdentifier: Characteristic;
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
        Category: Characteristic;
        ChargingState: Characteristic;
        ClosedCaptions: Characteristic;
        ColorTemperature: Characteristic;
        ConfigureBridgedAccessory: Characteristic;
        ConfigureBridgedAccessoryStatus: Characteristic;
        ConfiguredName: Characteristic;
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
        CurrentMediaState: Characteristic;
        CurrentPosition: Characteristic;
        CurrentRelativeHumidity: Characteristic;
        CurrentSlatState: Characteristic;
        CurrentTemperature: Characteristic;
        CurrentTiltAngle: Characteristic;
        CurrentTime: Characteristic;
        CurrentVerticalTiltAngle: Characteristic;
        CurrentVisibilityState: Characteristic;
        DayoftheWeek: Characteristic;
        DigitalZoom: Characteristic;
        DiscoverBridgedAccessories: Characteristic;
        DiscoveredBridgedAccessories: Characteristic;
        DisplayOrder: Characteristic;
        FilterChangeIndication: Characteristic;
        FilterLifeLevel: Characteristic;
        FirmwareRevision: Characteristic;
        HardwareRevision: Characteristic;
        HeatingThresholdTemperature: Characteristic;
        HoldPosition: Characteristic;
        Hue: Characteristic;
        Identifier: Characteristic;
        Identify: Characteristic;
        ImageMirroring: Characteristic;
        ImageRotation: Characteristic;
        InUse: Characteristic;
        InputDeviceType: Characteristic;
        InputSourceType: Characteristic;
        IsConfigured: Characteristic;
        LeakDetected: Characteristic;
        LinkQuality: Characteristic;
        LockControlPoint: Characteristic;
        LockCurrentState: Characteristic;
        LockLastKnownAction: Characteristic;
        LockManagementAutoSecurityTimeout: Characteristic;
        LockPhysicalControls: Characteristic;
        LockTargetState: Characteristic;
        Logs: Characteristic;
        Manufacturer: Characteristic;
        Model: Characteristic;
        MotionDetected: Characteristic;
        Mute: Characteristic;
        Name: Characteristic;
        NightVision: Characteristic;
        NitrogenDioxideDensity: Characteristic;
        ObstructionDetected: Characteristic;
        OccupancyDetected: Characteristic;
        On: Characteristic;
        OpticalZoom: Characteristic;
        OutletInUse: Characteristic;
        OzoneDensity: Characteristic;
        PM10Density: Characteristic;
        PM2_5Density: Characteristic;
        PairSetup: Characteristic;
        PairVerify: Characteristic;
        PairingFeatures: Characteristic;
        PairingPairings: Characteristic;
        PictureMode: Characteristic;
        PositionState: Characteristic;
        PowerModeSelection: Characteristic;
        ProgramMode: Characteristic;
        ProgrammableSwitchEvent: Characteristic;
        ProgrammableSwitchOutputState: Characteristic;
        Reachable: Characteristic;
        RelativeHumidityDehumidifierThreshold: Characteristic;
        RelativeHumidityHumidifierThreshold: Characteristic;
        RelayControlPoint: Characteristic;
        RelayEnabled: Characteristic;
        RelayState: Characteristic;
        RemainingDuration: Characteristic;
        RemoteKey: Characteristic;
        ResetFilterIndication: Characteristic;
        RotationDirection: Characteristic;
        RotationSpeed: Characteristic;
        Saturation: Characteristic;
        SecuritySystemAlarmType: Characteristic;
        SecuritySystemCurrentState: Characteristic;
        SecuritySystemTargetState: Characteristic;
        SelectedRTPStreamConfiguration: Characteristic;
        SerialNumber: Characteristic;
        ServiceLabelIndex: Characteristic;
        ServiceLabelNamespace: Characteristic;
        SetDuration: Characteristic;
        SetupEndpoints: Characteristic;
        SlatType: Characteristic;
        SleepDiscoveryMode: Characteristic;
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
        TargetMediaState: Characteristic;
        TargetPosition: Characteristic;
        TargetRelativeHumidity: Characteristic;
        TargetSlatState: Characteristic;
        TargetTemperature: Characteristic;
        TargetTiltAngle: Characteristic;
        TargetVerticalTiltAngle: Characteristic;
        TargetVisibilityState: Characteristic;
        TemperatureDisplayUnits: Characteristic;
        TimeUpdate: Characteristic;
        TunnelConnectionTimeout: Characteristic;
        TunneledAccessoryAdvertising: Characteristic;
        TunneledAccessoryConnected: Characteristic;
        TunneledAccessoryStateNumber: Characteristic;
        VOCDensity: Characteristic;
        ValveType: Characteristic;
        Version: Characteristic;
        Volume: Characteristic;
        VolumeControlType: Characteristic;
        VolumeSelector: Characteristic;
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
        setupURI(): string;
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
            SECURITY_SYSTEM = 11,
            DOOR = 12,
            WINDOW = 13,
            WINDOW_COVERING = 14,
            PROGRAMMABLE_SWITCH = 15,
            RANGE_EXTENDER = 16,
            CAMERA = 17,
            IP_CAMERA = 17,
            VIDEO_DOORBELL = 18,
            AIR_PURIFIER = 19,
            AIR_HEATER = 20,
            AIR_CONDITIONER = 21,
            AIR_HUMIDIFIER = 22,
            AIR_DEHUMIDIFIER = 23,
            APPLE_TV = 24,
            SPEAKER = 26,
            AIRPORT = 27,
            SPRINKLER = 28,
            FAUCET = 29,
            SHOWER_HEAD = 30,
            TELEVISION = 31,
            TARGET_CONTROLLER = 32
        }
    }

    export interface HAPNodeJS {
        init(storagePath?: string): void,
        uuid: uuid,
        Accessory: Accessory,
        Service: Service,
        Characteristic: Characteristic
    }


}

declare var hapNodeJS: HAPNodeJS.HAPNodeJS;

declare module "hap-nodejs" {
    export = hapNodeJS;
}
