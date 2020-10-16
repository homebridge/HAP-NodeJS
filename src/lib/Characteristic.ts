import assert from "assert";
import createDebug from "debug";
import { EventEmitter } from "events";
import { CharacteristicJsonObject } from "../internal-types";
import { CharacteristicValue, Nullable, VoidCallback, } from '../types';
import {
  AccessControlLevel,
  AccessoryFlags,
  AccessoryIdentifier,
  Active,
  ActiveIdentifier,
  ActivityInterval,
  AdministratorOnlyAccess,
  AirParticulateDensity,
  AirParticulateSize,
  AirQuality,
  AppMatchingIdentifier,
  AudioFeedback,
  BatteryLevel,
  Brightness,
  ButtonEvent,
  CameraOperatingModeIndicator,
  CarbonDioxideDetected,
  CarbonDioxideLevel,
  CarbonDioxidePeakLevel,
  CarbonMonoxideDetected,
  CarbonMonoxideLevel,
  CarbonMonoxidePeakLevel,
  CCAEnergyDetectThreshold,
  CCASignalDetectThreshold,
  CharacteristicValueActiveTransitionCount,
  CharacteristicValueTransitionControl,
  ChargingState,
  ClosedCaptions,
  ColorTemperature,
  ConfiguredName,
  ContactSensorState,
  CoolingThresholdTemperature,
  CurrentAirPurifierState,
  CurrentAmbientLightLevel,
  CurrentDoorState,
  CurrentFanState,
  CurrentHeaterCoolerState,
  CurrentHeatingCoolingState,
  CurrentHorizontalTiltAngle,
  CurrentHumidifierDehumidifierState,
  CurrentMediaState,
  CurrentPosition,
  CurrentRelativeHumidity,
  CurrentSlatState,
  CurrentTemperature,
  CurrentTiltAngle,
  CurrentTransport,
  CurrentVerticalTiltAngle,
  CurrentVisibilityState,
  DataStreamHAPTransport,
  DataStreamHAPTransportInterrupt,
  DiagonalFieldOfView,
  DigitalZoom,
  DisplayOrder,
  EventRetransmissionMaximum,
  EventSnapshotsActive,
  EventTransmissionCounters,
  FilterChangeIndication,
  FilterLifeLevel,
  FirmwareRevision,
  HardwareRevision,
  HeartBeat,
  HeatingThresholdTemperature,
  HoldPosition,
  HomeKitCameraActive,
  Hue,
  Identifier,
  Identify,
  ImageMirroring,
  ImageRotation,
  InputDeviceType,
  InputSourceType,
  InUse,
  IsConfigured,
  LeakDetected,
  ListPairings,
  LockControlPoint,
  LockCurrentState,
  LockLastKnownAction,
  LockManagementAutoSecurityTimeout,
  LockPhysicalControls,
  LockTargetState,
  Logs,
  MACRetransmissionMaximum,
  MACTransmissionCounters,
  ManagedNetworkEnable,
  ManuallyDisabled,
  Manufacturer,
  MaximumTransmitPower,
  Model,
  MotionDetected,
  Mute,
  Name,
  NetworkAccessViolationControl,
  NetworkClientProfileControl,
  NetworkClientStatusControl,
  NightVision,
  NitrogenDioxideDensity,
  ObstructionDetected,
  OccupancyDetected,
  On,
  OperatingStateResponse,
  OpticalZoom,
  OutletInUse,
  OzoneDensity,
  PairingFeatures,
  PairSetup,
  PairVerify,
  PasswordSetting,
  PeriodicSnapshotsActive,
  PictureMode,
  Ping,
  PM10Density,
  PM2_5Density,
  PositionState,
  PowerModeSelection,
  ProductData,
  ProgrammableSwitchEvent,
  ProgrammableSwitchOutputState,
  ProgramMode,
  ReceivedSignalStrengthIndication,
  ReceiverSensitivity,
  RecordingAudioActive,
  RelativeHumidityDehumidifierThreshold,
  RelativeHumidityHumidifierThreshold,
  RelayControlPoint,
  RelayEnabled,
  RelayState,
  RemainingDuration,
  RemoteKey,
  ResetFilterIndication,
  RotationDirection,
  RotationSpeed,
  RouterStatus,
  Saturation,
  SecuritySystemAlarmType,
  SecuritySystemCurrentState,
  SecuritySystemTargetState,
  SelectedAudioStreamConfiguration,
  SelectedCameraRecordingConfiguration,
  SelectedRTPStreamConfiguration,
  SerialNumber,
  ServiceLabelIndex,
  ServiceLabelNamespace,
  SetDuration,
  SetupDataStreamTransport,
  SetupEndpoints,
  SetupTransferTransport,
  SignalToNoiseRatio,
  SiriInputType,
  SlatType,
  SleepDiscoveryMode,
  SleepInterval,
  SmokeDetected,
  SoftwareRevision,
  StatusActive,
  StatusFault,
  StatusJammed,
  StatusLowBattery,
  StatusTampered,
  StreamingStatus,
  SulphurDioxideDensity,
  SupportedAudioRecordingConfiguration,
  SupportedAudioStreamConfiguration,
  SupportedCameraRecordingConfiguration,
  SupportedCharacteristicValueTransitionConfiguration,
  SupportedDataStreamTransportConfiguration,
  SupportedDiagnosticsSnapshot,
  SupportedRouterConfiguration,
  SupportedRTPConfiguration,
  SupportedTransferTransportConfiguration,
  SupportedVideoRecordingConfiguration,
  SupportedVideoStreamConfiguration,
  SwingMode,
  TargetAirPurifierState,
  TargetControlList,
  TargetControlSupportedConfiguration,
  TargetDoorState,
  TargetFanState,
  TargetHeaterCoolerState,
  TargetHeatingCoolingState,
  TargetHorizontalTiltAngle,
  TargetHumidifierDehumidifierState,
  TargetMediaState,
  TargetPosition,
  TargetRelativeHumidity,
  TargetTemperature,
  TargetTiltAngle,
  TargetVerticalTiltAngle,
  TargetVisibilityState,
  TemperatureDisplayUnits,
  ThirdPartyCameraActive,
  ThreadControlPoint,
  ThreadNodeCapabilities,
  ThreadOpenThreadVersion,
  ThreadStatus,
  TransmitPower,
  TunnelConnectionTimeout,
  TunneledAccessoryAdvertising,
  TunneledAccessoryConnected,
  TunneledAccessoryStateNumber,
  ValveType,
  Version,
  VideoAnalysisActive,
  VOCDensity,
  Volume,
  VolumeControlType,
  VolumeSelector,
  WakeConfiguration,
  WANConfigurationList,
  WANStatusList,
  WaterLevel,
  WiFiCapabilities,
  WiFiConfigurationControl,
  WiFiSatelliteStatus,
} from "./definitions";
import { HAPStatus } from "./HAPServer";
import { IdentifierCache } from './model/IdentifierCache';
import { clone } from "./util/clone";
import { HAPConnection } from "./util/eventedhttp";
import { HapStatusError } from './util/hapStatusError';
import { once } from './util/once';
import { toShortForm } from './util/uuid';

const debug = createDebug("HAP-NodeJS:Characteristic");

export const enum Formats {
  BOOL = 'bool',
  /**
   * Signed 32-bit integer
   */
  INT = 'int', // signed 32-bit int
  /**
   * Signed 64-bit floating point
   */
  FLOAT = 'float',
  /**
   * String encoded in utf8
   */
  STRING = 'string',
  /**
   * Unsigned 8-bit integer.
   */
  UINT8 = 'uint8',
  /**
   * Unsigned 16-bit integer.
   */
  UINT16 = 'uint16',
  /**
   * Unsigned 32-bit integer.
   */
  UINT32 = 'uint32',
  /**
   * Unsigned 64-bit integer.
   */
  UINT64 = 'uint64',
  /**
   * Data is base64 encoded string.
   */
  DATA = 'data',
  /**
   * Base64 encoded tlv8 string.
   */
  TLV8 = 'tlv8',
  /**
   * @deprecated Not contained in the HAP spec
   */
  ARRAY = 'array',
  /**
   * @deprecated Not contained in the HAP spec
   */
  DICTIONARY = 'dict',
}

function isNumericFormat(format: Formats | string): boolean {
  switch (format) {
    case Formats.INT:
    case Formats.FLOAT:
    case Formats.UINT8:
    case Formats.UINT16:
    case Formats.UINT32:
    case Formats.UINT64:
      return true;
    default:
      return false;
  }
}

export const enum Units {
  /**
   * Celsius is the only temperature unit in the HomeKit Accessory Protocol.
   * Unit conversion is always done on the client side e.g. on the iPhone in the Home App depending on
   * the configured unit on the device itself.
   */
  CELSIUS = 'celsius',
  PERCENTAGE = 'percentage',
  ARC_DEGREE = 'arcdegrees',
  LUX = 'lux',
  SECONDS = 'seconds',
}

export const enum Perms {
  // noinspection JSUnusedGlobalSymbols
  /**
   * @deprecated replaced by {@link PAIRED_READ}. Kept for backwards compatibility.
   */
  READ = 'pr',
  /**
   * @deprecated replaced by {@link PAIRED_WRITE}. Kept for backwards compatibility.
   */
  WRITE = 'pw',
  PAIRED_READ = 'pr',
  PAIRED_WRITE = 'pw',
  NOTIFY = 'ev',
  EVENTS = 'ev',
  ADDITIONAL_AUTHORIZATION = 'aa',
  TIMED_WRITE = 'tw',
  HIDDEN = 'hd',
  WRITE_RESPONSE = 'wr',
}

export interface CharacteristicProps {
  format: Formats | string;
  perms: Perms[];
  unit?: Units | string;
  description?: string;
  minValue?: number;
  maxValue?: number;
  minStep?: number;
  /**
   * Maximum number of characters when format is {@link Formats.STRING}.
   * Default is 64 characters. Maximum allowed is 256 characters.
   */
  maxLen?: number;
  /**
   * Maximum number of characters when format is {@link Formats.DATA}.
   * Default is 2097152 characters.
   */
  maxDataLen?: number;
  validValues?: number[];
  /**
   * Two element array where the first value specifies the lowest valid value and
   * the second element specifies the highest valid value.
   */
  validValueRanges?: [min: number, max: number];
  adminOnlyAccess?: Access[];
}

export const enum Access {
  READ = 0x00,
  WRITE = 0x01,
  NOTIFY = 0x02
}

export type CharacteristicChange = {
  originator?: HAPConnection,
  newValue: Nullable<CharacteristicValue>;
  oldValue: Nullable<CharacteristicValue>;
  context?: any;
};

export interface SerializedCharacteristic {
  displayName: string,
  UUID: string,
  props: CharacteristicProps,
  value: Nullable<CharacteristicValue>,
  eventOnlyCharacteristic: boolean,
}

export const enum CharacteristicEventTypes {
  /**
   * This event is thrown when a HomeKit controller wants to read the current value of the characteristic.
   * The event handler should call the supplied callback as fast as possible.
   *
   * HAP-NodeJS will complain about slow running get handlers after 3 seconds and terminate the request after 10 seconds.
   */
  GET = "get",
  /**
   * This event is thrown when a HomeKit controller wants to write a new value to the characteristic.
   * The event handler should call the supplied callback as fast as possible.
   *
   * HAP-NodeJS will complain about slow running set handlers after 3 seconds and terminate the request after 10 seconds.
   */
  SET = "set",
  /**
   * Emitted after a new value is set for the characteristic.
   * The new value can be set via a request by a HomeKit controller or via an API call.
   */
  CHANGE = "change",
  /**
   * @internal
   */
  SUBSCRIBE = "subscribe",
  /**
   * @internal
   */
  UNSUBSCRIBE = "unsubscribe",
}

export type CharacteristicGetCallback = (status?: HAPStatus | null | Error, value?: Nullable<CharacteristicValue>) => void;
export type CharacteristicSetCallback = (error?: HAPStatus | null | Error, writeResponse?: Nullable<CharacteristicValue>) => void;
export type CharacteristicGetHandler = () => Promise<Nullable<CharacteristicValue>> | Nullable<CharacteristicValue>;
export type CharacteristicSetHandler = (value: CharacteristicValue) => Promise<Nullable<CharacteristicValue> | void> | Nullable<CharacteristicValue> | void;

export type AdditionalAuthorizationHandler = (additionalAuthorizationData: string | undefined) => boolean;

export declare interface Characteristic {

  on(event: "get", listener: (callback: CharacteristicGetCallback, context: any, connection?: HAPConnection) => void): this;
  on(event: "set", listener: (value: CharacteristicValue, callback: CharacteristicSetCallback, context: any, connection?: HAPConnection) => void): this
  on(event: "change", listener: (change: CharacteristicChange) => void): this;
  /**
   * @internal
   */
  on(event: "subscribe", listener: VoidCallback): this;
  /**
   * @internal
   */
  on(event: "unsubscribe", listener: VoidCallback): this;

  /**
   * @internal
   */
  emit(event: "get", callback: CharacteristicGetCallback, context: any, connection?: HAPConnection): boolean;
  /**
   * @internal
   */
  emit(event: "set", value: CharacteristicValue, callback: CharacteristicSetCallback, context: any, connection?: HAPConnection): boolean;
  /**
   * @internal
   */
  emit(event: "change", change: CharacteristicChange): boolean;
  /**
   * @internal
   */
  emit(event: "subscribe"): boolean;
  /**
   * @internal
   */
  emit(event: "unsubscribe"): boolean;

}

/**
 * Characteristic represents a particular typed variable that can be assigned to a Service. For instance, a
 * "Hue" Characteristic might store a 'float' value of type 'arcdegrees'. You could add the Hue Characteristic
 * to a {@link Service} in order to store that value. A particular Characteristic is distinguished from others by its
 * UUID. HomeKit provides a set of known Characteristic UUIDs defined in HomeKit.ts along with a
 * corresponding concrete subclass.
 *
 * You can also define custom Characteristics by providing your own UUID. Custom Characteristics can be added
 * to any native or custom Services, but Siri will likely not be able to work with these.
 */
export class Characteristic extends EventEmitter {

  /**
   * @deprecated Please use the Formats const enum above. Scheduled to be removed in 2021-06.
   */
  // @ts-expect-error
  static Formats = Formats;
  /**
   * @deprecated Please use the Units const enum above. Scheduled to be removed in 2021-06.
   */
  // @ts-expect-error
  static Units = Units;
  /**
   * @deprecated Please use the Perms const enum above. Scheduled to be removed in 2021-06.
   */
  // @ts-expect-error
  static Perms = Perms;

  // Pattern below is for automatic detection of the section of defined characteristics. Used by the generator
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  public static AccessControlLevel: typeof AccessControlLevel;
  public static AccessoryFlags: typeof AccessoryFlags;
  public static AccessoryIdentifier: typeof AccessoryIdentifier;
  public static Active: typeof Active;
  public static ActiveIdentifier: typeof ActiveIdentifier;
  public static ActivityInterval: typeof ActivityInterval;
  public static AdministratorOnlyAccess: typeof AdministratorOnlyAccess;
  public static AirParticulateDensity: typeof AirParticulateDensity;
  public static AirParticulateSize: typeof AirParticulateSize;
  public static AirQuality: typeof AirQuality;
  public static AppMatchingIdentifier: typeof AppMatchingIdentifier;
  public static AudioFeedback: typeof AudioFeedback;
  public static BatteryLevel: typeof BatteryLevel;
  public static Brightness: typeof Brightness;
  public static ButtonEvent: typeof ButtonEvent;
  public static CameraOperatingModeIndicator: typeof CameraOperatingModeIndicator;
  public static CarbonDioxideDetected: typeof CarbonDioxideDetected;
  public static CarbonDioxideLevel: typeof CarbonDioxideLevel;
  public static CarbonDioxidePeakLevel: typeof CarbonDioxidePeakLevel;
  public static CarbonMonoxideDetected: typeof CarbonMonoxideDetected;
  public static CarbonMonoxideLevel: typeof CarbonMonoxideLevel;
  public static CarbonMonoxidePeakLevel: typeof CarbonMonoxidePeakLevel;
  public static CCAEnergyDetectThreshold: typeof CCAEnergyDetectThreshold;
  public static CCASignalDetectThreshold: typeof CCASignalDetectThreshold;
  public static CharacteristicValueActiveTransitionCount: typeof CharacteristicValueActiveTransitionCount;
  public static CharacteristicValueTransitionControl: typeof CharacteristicValueTransitionControl;
  public static ChargingState: typeof ChargingState;
  public static ClosedCaptions: typeof ClosedCaptions;
  public static ColorTemperature: typeof ColorTemperature;
  public static ConfiguredName: typeof ConfiguredName;
  public static ContactSensorState: typeof ContactSensorState;
  public static CoolingThresholdTemperature: typeof CoolingThresholdTemperature;
  public static CurrentAirPurifierState: typeof CurrentAirPurifierState;
  public static CurrentAmbientLightLevel: typeof CurrentAmbientLightLevel;
  public static CurrentDoorState: typeof CurrentDoorState;
  public static CurrentFanState: typeof CurrentFanState;
  public static CurrentHeaterCoolerState: typeof CurrentHeaterCoolerState;
  public static CurrentHeatingCoolingState: typeof CurrentHeatingCoolingState;
  public static CurrentHorizontalTiltAngle: typeof CurrentHorizontalTiltAngle;
  public static CurrentHumidifierDehumidifierState: typeof CurrentHumidifierDehumidifierState;
  public static CurrentMediaState: typeof CurrentMediaState;
  public static CurrentPosition: typeof CurrentPosition;
  public static CurrentRelativeHumidity: typeof CurrentRelativeHumidity;
  public static CurrentSlatState: typeof CurrentSlatState;
  public static CurrentTemperature: typeof CurrentTemperature;
  public static CurrentTiltAngle: typeof CurrentTiltAngle;
  public static CurrentTransport: typeof CurrentTransport;
  public static CurrentVerticalTiltAngle: typeof CurrentVerticalTiltAngle;
  public static CurrentVisibilityState: typeof CurrentVisibilityState;
  public static DataStreamHAPTransport: typeof DataStreamHAPTransport;
  public static DataStreamHAPTransportInterrupt: typeof DataStreamHAPTransportInterrupt;
  public static DiagonalFieldOfView: typeof DiagonalFieldOfView;
  public static DigitalZoom: typeof DigitalZoom;
  public static DisplayOrder: typeof DisplayOrder;
  public static EventRetransmissionMaximum: typeof EventRetransmissionMaximum;
  public static EventSnapshotsActive: typeof EventSnapshotsActive;
  public static EventTransmissionCounters: typeof EventTransmissionCounters;
  public static FilterChangeIndication: typeof FilterChangeIndication;
  public static FilterLifeLevel: typeof FilterLifeLevel;
  public static FirmwareRevision: typeof FirmwareRevision;
  public static HardwareRevision: typeof HardwareRevision;
  public static HeartBeat: typeof HeartBeat;
  public static HeatingThresholdTemperature: typeof HeatingThresholdTemperature;
  public static HoldPosition: typeof HoldPosition;
  public static HomeKitCameraActive: typeof HomeKitCameraActive;
  public static Hue: typeof Hue;
  public static Identifier: typeof Identifier;
  public static Identify: typeof Identify;
  public static ImageMirroring: typeof ImageMirroring;
  public static ImageRotation: typeof ImageRotation;
  public static InputDeviceType: typeof InputDeviceType;
  public static InputSourceType: typeof InputSourceType;
  public static InUse: typeof InUse;
  public static IsConfigured: typeof IsConfigured;
  public static LeakDetected: typeof LeakDetected;
  public static ListPairings: typeof ListPairings;
  public static LockControlPoint: typeof LockControlPoint;
  public static LockCurrentState: typeof LockCurrentState;
  public static LockLastKnownAction: typeof LockLastKnownAction;
  public static LockManagementAutoSecurityTimeout: typeof LockManagementAutoSecurityTimeout;
  public static LockPhysicalControls: typeof LockPhysicalControls;
  public static LockTargetState: typeof LockTargetState;
  public static Logs: typeof Logs;
  public static MACRetransmissionMaximum: typeof MACRetransmissionMaximum;
  public static MACTransmissionCounters: typeof MACTransmissionCounters;
  public static ManagedNetworkEnable: typeof ManagedNetworkEnable;
  public static ManuallyDisabled: typeof ManuallyDisabled;
  public static Manufacturer: typeof Manufacturer;
  public static MaximumTransmitPower: typeof MaximumTransmitPower;
  public static Model: typeof Model;
  public static MotionDetected: typeof MotionDetected;
  public static Mute: typeof Mute;
  public static Name: typeof Name;
  public static NetworkAccessViolationControl: typeof NetworkAccessViolationControl;
  public static NetworkClientProfileControl: typeof NetworkClientProfileControl;
  public static NetworkClientStatusControl: typeof NetworkClientStatusControl;
  public static NightVision: typeof NightVision;
  public static NitrogenDioxideDensity: typeof NitrogenDioxideDensity;
  public static ObstructionDetected: typeof ObstructionDetected;
  public static OccupancyDetected: typeof OccupancyDetected;
  public static On: typeof On;
  public static OperatingStateResponse: typeof OperatingStateResponse;
  public static OpticalZoom: typeof OpticalZoom;
  public static OutletInUse: typeof OutletInUse;
  public static OzoneDensity: typeof OzoneDensity;
  public static PairingFeatures: typeof PairingFeatures;
  /**
   * @deprecated Please use {@link Characteristic.ListPairings}.
   */
  public static PairingPairings: typeof ListPairings;
  public static PairSetup: typeof PairSetup;
  public static PairVerify: typeof PairVerify;
  public static PasswordSetting: typeof PasswordSetting;
  public static PeriodicSnapshotsActive: typeof PeriodicSnapshotsActive;
  public static PictureMode: typeof PictureMode;
  public static Ping: typeof Ping;
  public static PM10Density: typeof PM10Density;
  public static PM2_5Density: typeof PM2_5Density;
  public static PositionState: typeof PositionState;
  public static PowerModeSelection: typeof PowerModeSelection;
  public static ProductData: typeof ProductData;
  public static ProgrammableSwitchEvent: typeof ProgrammableSwitchEvent;
  public static ProgrammableSwitchOutputState: typeof ProgrammableSwitchOutputState;
  public static ProgramMode: typeof ProgramMode;
  public static ReceivedSignalStrengthIndication: typeof ReceivedSignalStrengthIndication;
  public static ReceiverSensitivity: typeof ReceiverSensitivity;
  public static RecordingAudioActive: typeof RecordingAudioActive;
  public static RelativeHumidityDehumidifierThreshold: typeof RelativeHumidityDehumidifierThreshold;
  public static RelativeHumidityHumidifierThreshold: typeof RelativeHumidityHumidifierThreshold;
  public static RelayControlPoint: typeof RelayControlPoint;
  public static RelayEnabled: typeof RelayEnabled;
  public static RelayState: typeof RelayState;
  public static RemainingDuration: typeof RemainingDuration;
  public static RemoteKey: typeof RemoteKey;
  public static ResetFilterIndication: typeof ResetFilterIndication;
  public static RotationDirection: typeof RotationDirection;
  public static RotationSpeed: typeof RotationSpeed;
  public static RouterStatus: typeof RouterStatus;
  public static Saturation: typeof Saturation;
  public static SecuritySystemAlarmType: typeof SecuritySystemAlarmType;
  public static SecuritySystemCurrentState: typeof SecuritySystemCurrentState;
  public static SecuritySystemTargetState: typeof SecuritySystemTargetState;
  public static SelectedAudioStreamConfiguration: typeof SelectedAudioStreamConfiguration;
  public static SelectedCameraRecordingConfiguration: typeof SelectedCameraRecordingConfiguration;
  public static SelectedRTPStreamConfiguration: typeof SelectedRTPStreamConfiguration;
  public static SerialNumber: typeof SerialNumber;
  public static ServiceLabelIndex: typeof ServiceLabelIndex;
  public static ServiceLabelNamespace: typeof ServiceLabelNamespace;
  public static SetDuration: typeof SetDuration;
  public static SetupDataStreamTransport: typeof SetupDataStreamTransport;
  public static SetupEndpoints: typeof SetupEndpoints;
  public static SetupTransferTransport: typeof SetupTransferTransport;
  public static SignalToNoiseRatio: typeof SignalToNoiseRatio;
  public static SiriInputType: typeof SiriInputType;
  public static SlatType: typeof SlatType;
  public static SleepDiscoveryMode: typeof SleepDiscoveryMode;
  public static SleepInterval: typeof SleepInterval;
  public static SmokeDetected: typeof SmokeDetected;
  public static SoftwareRevision: typeof SoftwareRevision;
  public static StatusActive: typeof StatusActive;
  public static StatusFault: typeof StatusFault;
  public static StatusJammed: typeof StatusJammed;
  public static StatusLowBattery: typeof StatusLowBattery;
  public static StatusTampered: typeof StatusTampered;
  public static StreamingStatus: typeof StreamingStatus;
  public static SulphurDioxideDensity: typeof SulphurDioxideDensity;
  public static SupportedAudioRecordingConfiguration: typeof SupportedAudioRecordingConfiguration;
  public static SupportedAudioStreamConfiguration: typeof SupportedAudioStreamConfiguration;
  public static SupportedCameraRecordingConfiguration: typeof SupportedCameraRecordingConfiguration;
  public static SupportedCharacteristicValueTransitionConfiguration: typeof SupportedCharacteristicValueTransitionConfiguration;
  public static SupportedDataStreamTransportConfiguration: typeof SupportedDataStreamTransportConfiguration;
  public static SupportedDiagnosticsSnapshot: typeof SupportedDiagnosticsSnapshot;
  public static SupportedRouterConfiguration: typeof SupportedRouterConfiguration;
  public static SupportedRTPConfiguration: typeof SupportedRTPConfiguration;
  public static SupportedTransferTransportConfiguration: typeof SupportedTransferTransportConfiguration;
  public static SupportedVideoRecordingConfiguration: typeof SupportedVideoRecordingConfiguration;
  public static SupportedVideoStreamConfiguration: typeof SupportedVideoStreamConfiguration;
  public static SwingMode: typeof SwingMode;
  public static TargetAirPurifierState: typeof TargetAirPurifierState;
  public static TargetControlList: typeof TargetControlList;
  public static TargetControlSupportedConfiguration: typeof TargetControlSupportedConfiguration;
  public static TargetDoorState: typeof TargetDoorState;
  public static TargetFanState: typeof TargetFanState;
  public static TargetHeaterCoolerState: typeof TargetHeaterCoolerState;
  public static TargetHeatingCoolingState: typeof TargetHeatingCoolingState;
  public static TargetHorizontalTiltAngle: typeof TargetHorizontalTiltAngle;
  public static TargetHumidifierDehumidifierState: typeof TargetHumidifierDehumidifierState;
  public static TargetMediaState: typeof TargetMediaState;
  public static TargetPosition: typeof TargetPosition;
  public static TargetRelativeHumidity: typeof TargetRelativeHumidity;
  public static TargetTemperature: typeof TargetTemperature;
  public static TargetTiltAngle: typeof TargetTiltAngle;
  public static TargetVerticalTiltAngle: typeof TargetVerticalTiltAngle;
  public static TargetVisibilityState: typeof TargetVisibilityState;
  public static TemperatureDisplayUnits: typeof TemperatureDisplayUnits;
  public static ThirdPartyCameraActive: typeof ThirdPartyCameraActive;
  public static ThreadControlPoint: typeof ThreadControlPoint;
  public static ThreadNodeCapabilities: typeof ThreadNodeCapabilities;
  public static ThreadOpenThreadVersion: typeof ThreadOpenThreadVersion;
  public static ThreadStatus: typeof ThreadStatus;
  public static TransmitPower: typeof TransmitPower;
  public static TunnelConnectionTimeout: typeof TunnelConnectionTimeout;
  public static TunneledAccessoryAdvertising: typeof TunneledAccessoryAdvertising;
  public static TunneledAccessoryConnected: typeof TunneledAccessoryConnected;
  public static TunneledAccessoryStateNumber: typeof TunneledAccessoryStateNumber;
  public static ValveType: typeof ValveType;
  public static Version: typeof Version;
  public static VideoAnalysisActive: typeof VideoAnalysisActive;
  public static VOCDensity: typeof VOCDensity;
  public static Volume: typeof Volume;
  public static VolumeControlType: typeof VolumeControlType;
  public static VolumeSelector: typeof VolumeSelector;
  public static WakeConfiguration: typeof WakeConfiguration;
  public static WANConfigurationList: typeof WANConfigurationList;
  public static WANStatusList: typeof WANStatusList;
  public static WaterLevel: typeof WaterLevel;
  public static WiFiCapabilities: typeof WiFiCapabilities;
  public static WiFiConfigurationControl: typeof WiFiConfigurationControl;
  public static WiFiSatelliteStatus: typeof WiFiSatelliteStatus;
  // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=

  // NOTICE: when adding/changing properties, remember to possibly adjust the serialize/deserialize functions
  public displayName: string;
  public UUID: string;
  iid: Nullable<number> = null;
  value: Nullable<CharacteristicValue> = null;
  status: HAPStatus = HAPStatus.SUCCESS;
  props: CharacteristicProps;

  /**
   * The {@link onGet} handler
   */
  private getHandler?: CharacteristicGetHandler;

  /**
   * The {@link onSet} handler
   */
  private setHandler?: CharacteristicSetHandler;

  private subscriptions: number = 0;
  /**
   * @internal
   */
  additionalAuthorizationHandler?: AdditionalAuthorizationHandler;

  public constructor(displayName: string, UUID: string, props: CharacteristicProps) {
    super();
    this.displayName = displayName;
    this.UUID = UUID;
    this.props = { // some weird defaults (with legacy constructor props was optional)
      format: Formats.INT,
      perms: [Perms.NOTIFY],
    };

    this.setProps(props || {}); // ensure sanity checks are called
  }

  /**
   * Accepts a function that will be called to retrieve the current value of a Characteristic.
   * The function must return a valid Characteristic value for the Characteristic type.
   * May optionally return a promise.
   *
   * @example
   * ```ts
   * Characteristic.onGet(async () => {
   *   return true;
   * });
   * ```
   * @param handler
   */
  public onGet(handler: CharacteristicGetHandler) {
    if (typeof handler !== 'function' || handler.length !== 0) {
      console.warn(`[${this.displayName}] .onGet handler must be a function with exactly zero input arguments.`);
      return this;
    }
    this.getHandler = handler;
    return this;
  }

  /**
   * Accepts a function that will be called when setting the value of a Characteristic.
   * If the characteristic supports {@link Perms.WRITE_RESPONSE} and the request requests a write response value,
   * the returned value will be used.
   * May optionally return a promise.
   *
   * @example
   * ```ts
   * Characteristic.onSet(async (value: CharacteristicValue) => {
   *   console.log(value);
   * });
   * ```
   * @param handler
   */
  public onSet(handler: CharacteristicSetHandler) {
    if (typeof handler !== 'function' || handler.length !== 1) {
      console.warn(`[${this.displayName}] .onSet handler must be a function with exactly one input argument.`);
      return this;
    }
    this.setHandler = handler;
    return this;
  }

  /**
   * Updates the properties of this characteristic.
   * Properties passed via the parameter will be set. Any parameter set to null will be deleted.
   * See {@link CharacteristicProps}.
   *
   * @param props - Partial properties object with the desired updates.
   */
  public setProps(props: Partial<CharacteristicProps>): Characteristic {
    assert(props, "props cannot be undefined when setting props");
    // TODO calling setProps after publish doesn't lead to a increment in the current configuration number

    // for every value "null" can be used to reset props, except for required props
    if (props.format) {
      this.props.format = props.format;
    }
    if (props.perms) {
      assert(props.perms.length > 0, "characteristic prop perms cannot be empty array");
      this.props.perms = props.perms;
    }
    if (props.unit !== undefined) {
      this.props.unit = props.unit != null? props.unit: undefined;
    }
    if (props.description !== undefined) {
      this.props.description = props.description != null? props.description: undefined;
    }
    if (props.minValue !== undefined) {
      this.props.minValue = props.minValue != null? props.minValue: undefined;
    }
    if (props.maxValue !== undefined) {
      this.props.maxValue = props.maxValue != null? props.maxValue: undefined;
    }
    if (props.minStep !== undefined) {
      this.props.minStep = props.minStep != null? props.minStep: undefined;
    }
    if (props.maxLen !== undefined) {
      if (props.maxLen != null) {
        if (props.maxLen > 256) {
          console.warn("");
          props.maxLen = 256;
        }
        this.props.maxLen = props.maxLen;
      } else {
        this.props.maxLen = undefined;
      }
    }
    if (props.maxDataLen !== undefined) {
      this.props.maxDataLen = props.maxDataLen != null? props.maxDataLen: undefined;
    }
    if (props.validValues !== undefined) {
      assert(props.validValues.length, "characteristic prop validValues cannot be empty array");
      this.props.validValues = props.validValues != null? props.validValues: undefined;
    }
    if (props.validValueRanges !== undefined) {
      assert(props.validValueRanges.length === 2, "characteristic prop validValueRanges must have a length of 2");
      this.props.validValueRanges = props.validValueRanges != null? props.validValueRanges: undefined;
    }
    if (props.adminOnlyAccess !== undefined) {
      this.props.adminOnlyAccess = props.adminOnlyAccess != null? props.adminOnlyAccess: undefined;
    }

    if (this.props.minValue != null && this.props.maxValue != null) { // the eqeq instead of eqeqeq is important here
      if (this.props.minValue > this.props.maxValue) { // see https://github.com/homebridge/HAP-NodeJS/issues/690
        this.props.minValue = undefined;
        this.props.maxValue = undefined;
        throw new Error("Error setting CharacteristicsProps for '" + this.displayName + "': 'minValue' cannot be greater or equal the 'maxValue'!");
      }
    }

    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * This method can be used to setup additional authorization for a characteristic.
   * For one it adds the {@link Perms.ADDITIONAL_AUTHORIZATION} permission to the characteristic
   * (if it wasn't already) to signal support for additional authorization to HomeKit.
   * Additionally an {@link AdditionalAuthorizationHandler} is setup up which is called
   * before a write request is performed.
   *
   * Additional Authorization Data can be added to SET request via a custom iOS App.
   * Before hap-nodejs executes a write request it will call the {@link AdditionalAuthorizationHandler}
   * with 'authData' supplied in the write request. The 'authData' is a base64 encoded string
   * (or undefined if no authData was supplied).
   * The {@link AdditionalAuthorizationHandler} must then return true or false to indicate if the write request
   * is authorized and should be accepted.
   *
   * @param handler - Handler called to check additional authorization data.
   */
  public setupAdditionalAuthorization(handler: AdditionalAuthorizationHandler): void {
    if (!this.props.perms.includes(Perms.ADDITIONAL_AUTHORIZATION)) {
      this.props.perms.push(Perms.ADDITIONAL_AUTHORIZATION);
    }
    this.additionalAuthorizationHandler = handler;
  }

  /**
   * Updates the current value of the characteristic.
   *
   * @param callback
   * @param context
   * @internal use to return the current value on HAP requests
   *
   * @deprecated
   */
  getValue(callback?: CharacteristicGetCallback, context?: any): void {
    this.handleGetRequest(undefined, context).then(value => {
      if (callback) {
        callback(null, value);
      }
    }, reason => {
      if (callback) {
        callback(reason);
      }
    });
  }

  /**
   * This updates the value by calling the {@link CharacteristicEventTypes.SET} event handler associated with the characteristic.
   * This acts the same way as when a HomeKit controller sends a /characteristics request to update the characteristic.
   * A event notification will be sent to all connected HomeKit controllers which are registered
   * to receive event notifications for this characteristic.
   *
   * This method behaves like a {@link updateValue} call with the addition that the own {@link CharacteristicEventTypes.SET}
   * event handler is called.
   *
   * @param value - The new value.
   */
  setValue(value: CharacteristicValue): Characteristic
  /**
   * This updates the value by calling the {@link CharacteristicEventTypes.SET} event handler associated with the characteristic.
   * This acts the same way as when a HomeKit controller sends a /characteristics request to update the characteristic.
   * A event notification will be sent to all connected HomeKit controllers which are registered
   * to receive event notifications for this characteristic.
   *
   * This method behaves like a {@link updateValue} call with the addition that the own {@link CharacteristicEventTypes.SET}
   * event handler is called.
   *
   * @param value - The new value.
   * @param callback - Deprecated parameter there to provide backwards compatibility. Called once the
   *   {@link CharacteristicEventTypes.SET} event handler returns.
   * @param context - Deprecated parameter there to provide backwards compatibility. Passed to the
   *   {@link CharacteristicEventTypes.SET} event handler.
   * @deprecated Parameters callback and context are deprecated.
   */
  setValue(value: CharacteristicValue, callback?: CharacteristicSetCallback, context?: any): Characteristic
  setValue(value: CharacteristicValue, callback?: CharacteristicSetCallback, context?: any): Characteristic {
    value = this.validateUserInput(value)!;
    this.handleSetRequest(value, undefined, context).then(value => {
      if (callback) {
        if (value) { // possible write response
          callback(null, value);
        } else {
          callback(null);
        }
      }
    }, reason => {
      if (callback) {
        callback(reason);
      }
    });

    return this;
  }

  /**
   * This updates the value of the characteristic. A event notification will be sent to all connected
   * HomeKit controllers which are registered to receive event notifications for this characteristic.
   *
   * @param value - The new value.
   */
  updateValue(value: Nullable<CharacteristicValue>): Characteristic;
  /**
   * This updates the value of the characteristic. A event notification will be sent to all connected
   * HomeKit controllers which are registered to receive event notifications for this characteristic.
   *
   * @param value - The new value.
   * @param callback - Deprecated parameter there to provide backwards compatibility. Callback is called instantly.
   * @param context - Deprecated parameter there to provide backwards compatibility.
   * @deprecated Parameters callback and context are deprecated.
   */
  updateValue(value: Nullable<CharacteristicValue>, callback?: () => void, context?: any): Characteristic;
  updateValue(value: Nullable<CharacteristicValue>, callback?: () => void, context?: any): Characteristic {
    this.status = HAPStatus.SUCCESS;

    value = this.validateUserInput(value);
    const oldValue = this.value;
    this.value = value;

    if (callback) {
      callback();
    }

    this.emit(CharacteristicEventTypes.CHANGE, { originator: undefined, oldValue: oldValue, newValue: value, context: context });

    return this; // for chaining
  }

  /**
   * Called when a HAP requests wants to know the current value of the characteristic.
   *
   * @param connection - The HAP connection from which the request originated from.
   * @param context - Deprecated parameter. There for backwards compatibility.
   * @internal Used by the Accessory to load the characteristic value
   */
  async handleGetRequest(connection?: HAPConnection, context?: any): Promise<Nullable<CharacteristicValue>> {
    if (!this.props.perms.includes(Perms.PAIRED_READ)) { // check if we are allowed to read from this characteristic
      throw HAPStatus.WRITE_ONLY_CHARACTERISTIC;
    }

    if (this.UUID === Characteristic.ProgrammableSwitchEvent.UUID) {
      // special workaround for event only programmable switch event, which must always return null
      return null;
    }

    if (this.getHandler) {
      if (this.listeners(CharacteristicEventTypes.GET).length > 0) {
        console.warn(`[${this.displayName}] Ignoring on('get') handler as onGet handler was defined instead.`);
      }

      try {
        let value = await this.getHandler();
        this.status = HAPStatus.SUCCESS;

        try {
          value = this.validateUserInput(value);
        } catch (error) {
          console.warn(`[${this.displayName}] An illegal value was supplied by the read handler for characteristic: ${error.message}`);
          this.status = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
          return Promise.reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE)
        }

        const oldValue = this.value;
        this.value = value;

        if (oldValue !== value) { // emit a change event if necessary
          this.emit(CharacteristicEventTypes.CHANGE, { originator: connection, oldValue: oldValue, newValue: value, context: context });
        }
      } catch (error) {
        if (typeof error === "number") {
          this.status = error;
        } else if (error instanceof HapStatusError) {
          this.status = error.hapStatus;
        } else {
          console.warn(`[${this.displayName}] Unhandled error thrown inside read handler for characteristic: ${error.stack}`);
          this.status = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
        }
        throw this.status;
      }
    }

    if (this.listeners(CharacteristicEventTypes.GET).length === 0) {
      if (this.status) {
        throw this.status;
      } else {
        return this.value;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        this.emit(CharacteristicEventTypes.GET, once((status?: Error | HAPStatus | null, value?: Nullable<CharacteristicValue>) => {
          if (status) {
            if (typeof status === "number") {
              this.status = status;
            } else if (status instanceof HapStatusError) {
              this.status = status.hapStatus;
            } else {
              this.status = extractHAPStatusFromError(status);
              debug("[%s] Received error from get handler %s", this.displayName, status.stack);
            }
            reject(this.status);
            return;
          }

          this.status = HAPStatus.SUCCESS;

          value = this.validateUserInput(value);
          const oldValue = this.value;
          this.value = value;

          resolve(value);

          if (oldValue !== value) { // emit a change event if necessary
            this.emit(CharacteristicEventTypes.CHANGE, { originator: connection, oldValue: oldValue, newValue: value, context: context });
          }
        }), context, connection);
      } catch (error) {
        console.warn(`[${this.displayName}] Unhandled error thrown inside read handler for characteristic: ${error.stack}`);
        this.status = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
        reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    });
  }

  /**
   * Called when a HAP requests update the current value of the characteristic.
   *
   * @param value - The updated value
   * @param connection - The connection from which the request originated from
   * @param context - Deprecated parameter. There for backwards compatibility.
   * @returns Promise resolve to void in normal operation. When characteristic supports write response, the
   *  HAP request requests write response and the set handler returns a write response value, the respective
   *  write response value is resolved.
   * @internal
   */
  async handleSetRequest(value: CharacteristicValue, connection?: HAPConnection, context?: any): Promise<CharacteristicValue | void> {
    this.status = HAPStatus.SUCCESS;

    if (connection !== undefined && !this.validClientSuppliedValue(value)) {
      // if connection is undefined, the set "request" comes from the setValue method.
      // for setValue a value of "null" is allowed and checked via validateUserInput.
      return Promise.reject(HAPStatus.INVALID_VALUE_IN_REQUEST);
    }

    if (isNumericFormat(this.props.format)) {
      value = this.roundNumericValue(value as number);
    }

    const oldValue = this.value;

    if (this.setHandler) {
      if (this.listeners(CharacteristicEventTypes.SET).length > 0) {
        console.warn(`[${this.displayName}] Ignoring on('set') handler as onSet handler was defined instead.`);
      }

      try {
        const writeResponse = await this.setHandler(value);
        this.status = HAPStatus.SUCCESS;

        if (writeResponse != null && this.props.perms.includes(Perms.WRITE_RESPONSE)) {
          this.value = writeResponse;
        } else {
          if (writeResponse != null) {
            console.warn(`[${this.displayName}] SET handler returned write response value, though the characteristic doesn't support write response!`);
          }
          this.value = value;
        }

        this.emit(CharacteristicEventTypes.CHANGE, { originator: connection, oldValue: oldValue, newValue: value, context: context });
        return this.value;
      } catch (error) {
        if (typeof error === "number") {
          this.status = error;
        } else if (error instanceof HapStatusError) {
          this.status = error.hapStatus;
        } else {
          console.warn(`[${this.displayName}] Unhandled error thrown inside write handler for characteristic: ${error.stack}`);
          this.status = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
        }
        throw this.status;
      }
    }

    if (this.listeners(CharacteristicEventTypes.SET).length === 0) {
      this.value = value;
      this.emit(CharacteristicEventTypes.CHANGE, { originator: connection, oldValue: oldValue, newValue: value, context: context });
      return Promise.resolve();
    } else {
      // the executor of the promise is called on the next tick, thus we set the updated value immediately until the set
      // event is executed.
      this.value = value;

      return new Promise((resolve, reject) => {
        try {
          this.emit(CharacteristicEventTypes.SET, value, once((status?: Error | HAPStatus | null, writeResponse?: Nullable<CharacteristicValue>) => {
            if (status) {
              if (typeof status === "number") {
                this.status = status;
              } else if (status instanceof HapStatusError) {
                this.status = status.hapStatus;
              } else {
                this.status = extractHAPStatusFromError(status);
                debug("[%s] Received error from set handler %s", this.displayName, status.stack);
              }
              reject(this.status);
              return;
            }

            this.status = HAPStatus.SUCCESS;

            if (writeResponse != null && this.props.perms.includes(Perms.WRITE_RESPONSE)) {
              // support write response simply by letting the implementor pass the response as second argument to the callback
              this.value = writeResponse;
              resolve(writeResponse);
            } else {
              if (writeResponse != null) {
                console.warn(`[${this.displayName}] SET handler returned write response value, though the characteristic doesn't support write response!`);
              }
              this.value = value;
              resolve();
            }

            this.emit(CharacteristicEventTypes.CHANGE, { originator: connection, oldValue: oldValue, newValue: value, context: context });
          }), context, connection);
        } catch (error) {
          console.warn(`[${this.displayName}] Unhandled error thrown inside write handler for characteristic: ${error.stack}`);
          this.status = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
          reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
    }
  }

  /**
   * Called once a HomeKit controller subscribes to events of this characteristics.
   * @internal
   */
  subscribe(): void {
    if (this.subscriptions === 0) {
      this.emit(CharacteristicEventTypes.SUBSCRIBE);
    }
    this.subscriptions++;
  }

  /**
   * Called once a HomeKit controller unsubscribe to events of this characteristics or a HomeKit controller
   * which was subscribed to this characteristic disconnects.
   * @internal
   */
  unsubscribe(): void {
    const wasOne = this.subscriptions === 1;
    this.subscriptions--;
    this.subscriptions = Math.max(this.subscriptions, 0);
    if (wasOne) {
      this.emit(CharacteristicEventTypes.UNSUBSCRIBE);
    }
  }

  protected getDefaultValue(): Nullable<CharacteristicValue> {
    // noinspection JSDeprecatedSymbols
    switch (this.props.format) {
      case Formats.BOOL:
        return false;
      case Formats.STRING:
        switch (this.UUID) {
          case Characteristic.Manufacturer.UUID:
            return "Default-Manufacturer";
          case Characteristic.Model.UUID:
            return "Default-Model";
          case Characteristic.SerialNumber.UUID:
            return "Default-SerialNumber";
          case Characteristic.FirmwareRevision.UUID:
            return "0.0.0";
          default:
              return "";
        }
      case Formats.DATA:
        return null; // who knows!
      case Formats.TLV8:
        return null; // who knows!
      case Formats.DICTIONARY:
        return {};
      case Formats.ARRAY:
        return [];
      default:
        return this.props.minValue ?? 0;
    }
  }

  private roundNumericValue(value: number): number {
    if (!this.props.minStep) {
      return Math.round(value); // round to 0 decimal places
    }
    const base = this.props.minValue ?? 0;
    const times = ((value - base) / this.props.minStep); // this value could become very large, so this doesn't really support little minStep values
    return Math.round(times) * this.props.minStep + base;
  }

  /**
   * Checks if the value received from the HAP request is valid.
   * If returned false the received value is not valid and {@link HAPStatus.INVALID_VALUE_IN_REQUEST}
   * must be returned.
   * @param value - Value supplied by the HomeKit controller
   */
  private validClientSuppliedValue(value?: Nullable<CharacteristicValue>): boolean {
    if (value == undefined) {
      return false;
    }

    let numericMin: number | undefined = undefined;
    let numericMax: number | undefined = undefined;

    switch (this.props.format) {
      case Formats.BOOL:
        if (!(typeof value === "boolean" || value == 0 || value == 1)) {
          return false;
        }
        break;
      case Formats.INT: // 32-bit signed int
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value !== "number") {
          return false;
        }

        numericMin = maxWithUndefined(this.props.minValue, -2147483648);
        numericMax = minWithUndefined(this.props.maxValue, 2147483647);
        break;
      case Formats.FLOAT:
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value !== "number") {
          return false;
        }

        if (this.props.minValue != null) {
          numericMin = this.props.minValue;
        }
        if (this.props.maxValue != null) {
          numericMax = this.props.maxValue;
        }
        break;
      case Formats.UINT8:
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value !== "number") {
          return false;
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 255);
        break;
      case Formats.UINT16:
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value !== "number") {
          return false;
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 65535);
        break;
      case Formats.UINT32:
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value !== "number") {
          return false;
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 4294967295);
        break;
      case Formats.UINT64:
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value !== "number") {
          return false;
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 18446744073709551615); // don't get fooled, javascript uses 18446744073709552000 here
        break;
      case Formats.STRING: {
        if (typeof value !== "string") {
          return false;
        }

        const maxLength = this.props.maxLen != null? this.props.maxLen: 64; // default is 64; max is 256 which is set in setProps
        if (value.length > maxLength) {
          return false;
        }
        break;
      }
      case Formats.DATA: {
        if (typeof value !== "string") {
          return false;
        }
        // we don't validate base64 here

        const maxLength = this.props.maxDataLen != null? this.props.maxDataLen: 0x200000; // default is 0x200000
        if (value.length > maxLength) {
          return false;
        }
        break;
      }
      case Formats.TLV8:
        if (typeof value !== "string") {
          return false;
        }
        break;
    }

    if (typeof value === "number") {
      if (numericMin != null && value < numericMin) {
        return false;
      }
      if (numericMax != null && value > numericMax) {
        return false;
      }

      if (this.props.validValues && !this.props.validValues.includes(value)) {
        return false;
      }
      if (this.props.validValueRanges && this.props.validValueRanges.length === 2) {
        if (value < this.props.validValueRanges[0]) {
          return false;
        } else if (value > this.props.validValueRanges[1]) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Checks if the value received from the API call is valid.
   * It adjust the value where it makes sense, prints a warning where values may be rejected with an error
   * in the future and throws an error which can't be converted to a valid value.
   *
   * @param value - The value received from the API call
   */
  private validateUserInput(value?: Nullable<CharacteristicValue>): Nullable<CharacteristicValue> {
    if (value === undefined) {
      console.warn(`[${this.displayName}] characteristic was supplied illegal value: undefined! This might throw errors in the future!`);
      return this.value; // don't change the value
    } else if (value === null) {
      if (this.UUID === Characteristic.Model.UUID || this.UUID === Characteristic.SerialNumber.UUID) { // mirrors the statement in case: Formats.STRING
        console.error(new Error(`[${this.displayName}] characteristic must have a non null value otherwise HomeKit will reject this accessory. Ignoring new value.`).stack);
        return this.value; // don't change the value
      }

      return null; // null is allowed
    }


    let numericMin: number | undefined = undefined;
    let numericMax: number | undefined = undefined;

    switch (this.props.format) {
      case Formats.BOOL: {
        const type = typeof value;
        if (type === "boolean") {
          return value;
        } else if (type === "number") {
          return value === 1;
        } else if (type === "string") {
          return value === "1";
        } else {
          throw new Error("characteristic value expected boolean and received " + type);
        }
      }
      case Formats.INT: {
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value === "string") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string instead of number. Supplying illegal values will throw errors in the future!`);
          value = parseInt(value, 10);
        } else if (typeof value !== "number") {
          throw new Error("characteristic value expected number and received " + typeof value);
        }

        numericMin = maxWithUndefined(this.props.minValue, -2147483648);
        numericMax = minWithUndefined(this.props.maxValue, 2147483647);
        break;
      }
      case Formats.FLOAT: {
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value === "string") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string instead of float. Supplying illegal values will throw errors in the future!`);
          value = parseFloat(value);
        } else if (typeof value !== "number") {
          throw new Error("characteristic value expected float and received " + typeof value);
        }

        if (this.props.minValue != null) {
          numericMin = this.props.minValue;
        }
        if (this.props.maxValue != null) {
          numericMax = this.props.maxValue;
        }
        break;
      }
      case Formats.UINT8: {
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value === "string") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string instead of number. Supplying illegal values will throw errors in the future!`);
          value = parseInt(value, 10);
        } else if (typeof value !== "number") {
          throw new Error("characteristic value expected number and received " + typeof value);
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 255);
        break;
      }
      case Formats.UINT16: {
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value === "string") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string instead of number. Supplying illegal values will throw errors in the future!`);
          value = parseInt(value, 10);
        } else if (typeof value !== "number") {
          throw new Error("characteristic value expected number and received " + typeof value);
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 65535);
        break;
      }
      case Formats.UINT32: {
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value === "string") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string instead of number. Supplying illegal values will throw errors in the future!`);
          value = parseInt(value, 10);
        } else if (typeof value !== "number") {
          throw new Error("characteristic value expected number and received " + typeof value);
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 4294967295);
        break;
      }
      case Formats.UINT64: {
        if (typeof value === "boolean") {
          value = value? 1: 0;
        } if (typeof value === "string") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string instead of number. Supplying illegal values will throw errors in the future!`);
          value = parseInt(value, 10);
        } else if (typeof value !== "number") {
          throw new Error("characteristic value expected number and received " + typeof value);
        }

        numericMin = maxWithUndefined(this.props.minValue, 0);
        numericMax = minWithUndefined(this.props.maxValue, 18446744073709551615); // don't get fooled, javascript uses 18446744073709552000 here
        break;
      }
      case Formats.STRING: {
        if (typeof value === "number") {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: number instead of string. Supplying illegal values will throw errors in the future!`);
          value = String(value);
        } else if (typeof value !== "string") {
          throw new Error("characteristic value expected string and received " + (typeof value));
        }

        if (value.length <= 1 && (this.UUID === Characteristic.Model.UUID || this.UUID === Characteristic.SerialNumber.UUID)) { // mirrors the case value = null at the beginning
          console.error(new Error(`[${this.displayName}] characteristic must have a length of more than 1 character otherwise HomeKit will reject this accessory. Ignoring new value.`).stack);
          return this.value; // just return the current value
        }

        const maxLength = this.props.maxLen != null? this.props.maxLen: 64; // default is 64 (max is 256 which is set in setProps)
        if (value.length > maxLength) {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string '${value}' exceeded max length of ${maxLength}.`);
          value = value.substring(0, maxLength);
        }

        return value;
      }
      case Formats.DATA:
        if (typeof value !== "string") {
          throw new Error("characteristic with data format must have string value");
        }

        if (this.props.maxDataLen != null && value.length > this.props.maxDataLen) {
          // can't cut it as we would basically yet binary rubbish afterwards
          throw new Error("characteristic with data format exceeds specified maxDataLen!");
        }
        return value;
      case Formats.TLV8:
        return value; // we trust that this is valid tlv8
    }

    if (typeof value === "number") {
      if (numericMin != null && value < numericMin) {
        console.warn(`[${this.displayName}] characteristic was supplied illegal value: number ${value} exceeded minimum of ${numericMin}.`);
        value = numericMin;
      }
      if (numericMax != null && value > numericMax) {
        console.warn(`[${this.displayName}] characteristic was supplied illegal value: number ${value} exceeded maximum of ${numericMax}.`);
        value = numericMax;
      }

      if (this.props.validValues && !this.props.validValues.includes(value)) {
        throw new Error(`characteristic value ${value} is not contained in valid values array!`);
      }

      if (this.props.validValueRanges && this.props.validValueRanges.length === 2) {
        if (value < this.props.validValueRanges[0]) {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: number ${value} not contained in valid value range of ${this.props.validValueRanges}. Supplying illegal values will throw errors in the future!`);
          value = this.props.validValueRanges[0];
        } else if (value > this.props.validValueRanges[1]) {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: number ${value} not contained in valid value range of ${this.props.validValueRanges}. Supplying illegal values will throw errors in the future!`);
          value = this.props.validValueRanges[1];
        }
      }

      value = this.roundNumericValue(value);
    }

    return value;
  }

  /**
   * @internal used to assign iid to characteristic
   */
  _assignID(identifierCache: IdentifierCache, accessoryName: string, serviceUUID: string, serviceSubtype?: string): void {
    // generate our IID based on our UUID
    this.iid = identifierCache.getIID(accessoryName, serviceUUID, serviceSubtype, this.UUID);
  }

  /**
   * Returns a JSON representation of this characteristic suitable for delivering to HAP clients.
   * @internal used to generate response to /accessories query
   */
  async toHAP(connection: HAPConnection): Promise<CharacteristicJsonObject> {
    const object = this.internalHAPRepresentation();

    if (!this.props.perms.includes(Perms.PAIRED_READ)) {
      object.value = undefined;
    } else if (this.UUID === Characteristic.ProgrammableSwitchEvent.UUID) {
      // special workaround for event only programmable switch event, which must always return null
      object.value = null;
    } else { // query the current value
      object.value = await this.handleGetRequest(connection).catch(() => {
        debug('[%s] Error getting value for characteristic on /accessories request', this.displayName);
        return this.value; // use cached value
      });
    }

    return object;
  }

  /**
   * Returns a JSON representation of this characteristic without the value.
   * @internal used to generate the config hash
   */
  internalHAPRepresentation(): CharacteristicJsonObject {
    assert(this.iid,"iid cannot be undefined for characteristic '" + this.displayName + "'");
    return {
      type: toShortForm(this.UUID),
      iid: this.iid!,
      value: null,
      perms: this.props.perms,
      description: this.props.description || this.displayName,
      format: this.props.format,
      unit: this.props.unit,
      minValue: this.props.minValue,
      maxValue: this.props.maxValue,
      minStep: this.props.minStep,
      maxLen: this.props.maxLen,
      maxDataLen: this.props.maxDataLen,
      "valid-values": this.props.validValues,
      "valid-values-range": this.props.validValueRanges,
    }
  }

  /**
   * Serialize characteristic into json string.
   *
   * @param characteristic - Characteristic object.
   * @internal used to store characteristic on disk
   */
  static serialize(characteristic: Characteristic): SerializedCharacteristic {
    return {
      displayName: characteristic.displayName,
      UUID: characteristic.UUID,
      props: clone({}, characteristic.props),
      value: characteristic.value,
      eventOnlyCharacteristic: characteristic.UUID === Characteristic.ProgrammableSwitchEvent.UUID, // support downgrades for now
    }
  };

  /**
   * Deserialize characteristic from json string.
   *
   * @param json - Json string representing a characteristic.
   * @internal used to recreate characteristic from disk
   */
  static deserialize(json: SerializedCharacteristic): Characteristic {
    const characteristic = new Characteristic(json.displayName, json.UUID, json.props);

    characteristic.value = json.value;

    return characteristic;
  };

}

const numberPattern = /^-?\d+$/;
function extractHAPStatusFromError(error: Error) {
  let errorValue = HAPStatus.SERVICE_COMMUNICATION_FAILURE;

  if (numberPattern.test(error.message)) {
    const value = parseInt(error.message);

    if (value >= HAPStatus.INSUFFICIENT_PRIVILEGES && value <= HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE) {
      errorValue = value;
    }
  }

  return errorValue;
}

function maxWithUndefined(a?: number, b?: number): number | undefined {
  if (a === undefined) {
    return b;
  } else if (b === undefined) {
    return a;
  } else {
    return Math.max(a, b);
  }
}

function minWithUndefined(a?: number, b?: number): number | undefined {
  if (a === undefined) {
    return b;
  } else if (b === undefined) {
    return a;
  } else {
    return Math.min(a, b);
  }
}
