import assert from "assert";
import createDebug from "debug";
import { EventEmitter } from "events";
import { CharacteristicJsonObject, CharacteristicValue, Nullable, PartialAllowingNull, VoidCallback } from "../types";
import { CharacteristicWarningType } from "./Accessory";
import type {
  AccessCodeControlPoint,
  AccessCodeSupportedConfiguration,
  AccessControlLevel,
  AccessoryFlags,
  AccessoryIdentifier,
  Active,
  ActiveIdentifier,
  ActivityInterval,
  AdministratorOnlyAccess,
  AirParticulateDensity,
  AirParticulateSize,
  AirPlayEnable,
  AirQuality,
  AppMatchingIdentifier,
  AssetUpdateReadiness,
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
  Category,
  CCAEnergyDetectThreshold,
  CCASignalDetectThreshold,
  CharacteristicValueActiveTransitionCount,
  CharacteristicValueTransitionControl,
  ChargingState,
  ClosedCaptions,
  ColorTemperature,
  ConfigurationState,
  ConfigureBridgedAccessory,
  ConfigureBridgedAccessoryStatus,
  ConfiguredName,
  ContactSensorState,
  CoolingThresholdTemperature,
  CryptoHash,
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
  CurrentTime,
  CurrentTransport,
  CurrentVerticalTiltAngle,
  CurrentVisibilityState,
  DataStreamHAPTransport,
  DataStreamHAPTransportInterrupt,
  DayoftheWeek,
  DiagonalFieldOfView,
  DigitalZoom,
  DiscoverBridgedAccessories,
  DiscoveredBridgedAccessories,
  DisplayOrder,
  EventRetransmissionMaximum,
  EventSnapshotsActive,
  EventTransmissionCounters,
  FilterChangeIndication,
  FilterLifeLevel,
  FirmwareRevision,
  FirmwareUpdateReadiness,
  FirmwareUpdateStatus,
  HardwareFinish,
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
  LinkQuality,
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
  MetricsBufferFullState,
  Model,
  MotionDetected,
  MultifunctionButton,
  Mute,
  Name,
  NetworkAccessViolationControl,
  NetworkClientProfileControl,
  NetworkClientStatusControl,
  NFCAccessControlPoint,
  NFCAccessSupportedConfiguration,
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
  Reachable,
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
  SelectedDiagnosticsModes,
  SelectedRTPStreamConfiguration,
  SelectedSleepConfiguration,
  SerialNumber,
  ServiceLabelIndex,
  ServiceLabelNamespace,
  SetDuration,
  SetupDataStreamTransport,
  SetupEndpoints,
  SetupTransferTransport,
  SignalToNoiseRatio,
  SiriEnable,
  SiriEndpointSessionStatus,
  SiriEngineVersion,
  SiriInputType,
  SiriLightOnUse,
  SiriListening,
  SiriTouchToUse,
  SlatType,
  SleepDiscoveryMode,
  SleepInterval,
  SmokeDetected,
  SoftwareRevision,
  StagedFirmwareVersion,
  StatusActive,
  StatusFault,
  StatusJammed,
  StatusLowBattery,
  StatusTampered,
  StreamingStatus,
  SulphurDioxideDensity,
  SupportedAssetTypes,
  SupportedAudioRecordingConfiguration,
  SupportedAudioStreamConfiguration,
  SupportedCameraRecordingConfiguration,
  SupportedCharacteristicValueTransitionConfiguration,
  SupportedDataStreamTransportConfiguration,
  SupportedDiagnosticsModes,
  SupportedDiagnosticsSnapshot,
  SupportedFirmwareUpdateConfiguration,
  SupportedMetrics,
  SupportedRouterConfiguration,
  SupportedRTPConfiguration,
  SupportedSleepConfiguration,
  SupportedTransferTransportConfiguration,
  SupportedVideoRecordingConfiguration,
  SupportedVideoStreamConfiguration,
  SwingMode,
  TapType,
  TargetAirPurifierState,
  TargetAirQuality,
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
  TargetSlatState,
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
  TimeUpdate,
  Token,
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
import { HAPStatus, IsKnownHAPStatusError } from "./HAPServer";
import { IdentifierCache } from "./model/IdentifierCache";
import { clone } from "./util/clone";
import { HAPConnection } from "./util/eventedhttp";
import { HapStatusError } from "./util/hapStatusError";
import { once } from "./util/once";
import {
  formatOutgoingCharacteristicValue,
  isIntegerNumericFormat,
  isNumericFormat,
  isUnsignedNumericFormat,
  numericLowerBound,
  numericUpperBound,
} from "./util/request-util";
import { BASE_UUID, toShortForm } from "./util/uuid";

const debug = createDebug("HAP-NodeJS:Characteristic");

/**
 * @group Characteristic
 */
export const enum Formats {
  BOOL = "bool",
  /**
   * Signed 32-bit integer
   */
  INT = "int", // signed 32-bit int
  /**
   * Signed 64-bit floating point
   */
  FLOAT = "float",
  /**
   * String encoded in utf8
   */
  STRING = "string",
  /**
   * Unsigned 8-bit integer.
   */
  UINT8 = "uint8",
  /**
   * Unsigned 16-bit integer.
   */
  UINT16 = "uint16",
  /**
   * Unsigned 32-bit integer.
   */
  UINT32 = "uint32",
  /**
   * Unsigned 64-bit integer.
   */
  UINT64 = "uint64",
  /**
   * Data is base64 encoded string.
   */
  DATA = "data",
  /**
   * Base64 encoded tlv8 string.
   */
  TLV8 = "tlv8",
  /**
   * @deprecated Not contained in the HAP spec
   */
  ARRAY = "array",
  /**
   * @deprecated Not contained in the HAP spec
   */
  DICTIONARY = "dict",
}

/**
 * @group Characteristic
 */
export const enum Units {
  /**
   * Celsius is the only temperature unit in the HomeKit Accessory Protocol.
   * Unit conversion is always done on the client side e.g. on the iPhone in the Home App depending on
   * the configured unit on the device itself.
   */
  CELSIUS = "celsius",
  PERCENTAGE = "percentage",
  ARC_DEGREE = "arcdegrees",
  LUX = "lux",
  SECONDS = "seconds",
}

/**
 * @group Characteristic
 */
export const enum Perms {
  // noinspection JSUnusedGlobalSymbols
  /**
   * @deprecated replaced by {@link PAIRED_READ}. Kept for backwards compatibility.
   */
  READ = "pr",
  /**
   * @deprecated replaced by {@link PAIRED_WRITE}. Kept for backwards compatibility.
   */
  WRITE = "pw",
  PAIRED_READ = "pr",
  PAIRED_WRITE = "pw",
  NOTIFY = "ev",
  EVENTS = "ev",
  ADDITIONAL_AUTHORIZATION = "aa",
  TIMED_WRITE = "tw",
  HIDDEN = "hd",
  WRITE_RESPONSE = "wr",
}

/**
 * @group Characteristic
 */
export interface CharacteristicProps {
  format: Formats | string;
  perms: Perms[];
  unit?: Units | string;
  description?: string;
  /**
   * Defines the minimum value for a numeric characteristic
   */
  minValue?: number;
  /**
   * Defines the maximum value for a numeric characteristic
   */
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
  /**
   * Defines an array of valid values to be used for the characteristic.
   */
  validValues?: number[];
  /**
   * Two element array where the first value specifies the lowest valid value and
   * the second element specifies the highest valid value.
   */
  validValueRanges?: [min: number, max: number];
  adminOnlyAccess?: Access[];
}

/**
 * Describes the abstract access to a {@link Characteristic}.
 * It abstracts the more granular access described by {@link Perms}.
 *
 * It is used in {@link CharacteristicProps.adminOnlyAccess}.
 *
 * @group Characteristic
 */
export const enum Access {
  READ = 0x00,
  WRITE = 0x01,
  NOTIFY = 0x02
}

/**
 * @group Characteristic
 */
export type CharacteristicChange = {
  originator?: HAPConnection,
  newValue: Nullable<CharacteristicValue>;
  oldValue: Nullable<CharacteristicValue>;
  reason: ChangeReason,
  context?: CharacteristicContext;
};

/**
 * @group Characteristic
 */
export const enum ChangeReason {
  /**
   * Reason used when HomeKit writes a value or the API user calls {@link Characteristic.setValue}.
   */
  WRITE = "write",
  /**
   * Reason used when the API user calls the method {@link Characteristic.updateValue}.
   */
  UPDATE = "update",
  /**
   * Used when HomeKit reads a value or the API user calls the deprecated method `Characteristic.getValue`.
   */
  READ = "read",
  /**
   * Used when call to {@link Characteristic.sendEventNotification} was made.
   */
  EVENT = "event",
}

/**
 * This format for a context object can be used to pass to any characteristic write operation.
 * It can contain additional information used by the internal event handlers of hap-nodejs.
 * The context object can be combined with any custom data for own use.
 *
 * @group Characteristic
 */
export interface CharacteristicOperationContext {
  /**
   * If set to true for any characteristic write operation
   * the Accessory won't send any event notifications to HomeKit controllers
   * for that particular change.
   */
  omitEventUpdate?: boolean;
}

/**
 * @group Characteristic
 */
export interface SerializedCharacteristic {
  displayName: string,
  UUID: string,
  eventOnlyCharacteristic: boolean,
  constructorName?: string,

  value: Nullable<CharacteristicValue>,
  props: CharacteristicProps,
}

/**
 * @group Characteristic
 */
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
   * @private
   */
  SUBSCRIBE = "subscribe",
  /**
   * @private
   */
  UNSUBSCRIBE = "unsubscribe",
  /**
   * @private
   */
  CHARACTERISTIC_WARNING = "characteristic-warning",
}

/**
 * @group Characteristic
 */
export type CharacteristicContext = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * @group Characteristic
 */
export type CharacteristicGetCallback = (status?: HAPStatus | null | Error, value?: Nullable<CharacteristicValue>) => void;
/**
 * @group Characteristic
 */
export type CharacteristicSetCallback = (error?: HAPStatus | null | Error, writeResponse?: Nullable<CharacteristicValue>) => void;
/**
 * @group Characteristic
 */
export type CharacteristicGetHandler = (context: CharacteristicContext, connection?: HAPConnection)
  => Promise<Nullable<CharacteristicValue>> | Nullable<CharacteristicValue>;
/**
 * @group Characteristic
 */
export type CharacteristicSetHandler = (value: CharacteristicValue, context: CharacteristicContext, connection?: HAPConnection)
  => Promise<Nullable<CharacteristicValue> | void> | Nullable<CharacteristicValue> | void;

/**
 * @group Characteristic
 */
export type AdditionalAuthorizationHandler = (additionalAuthorizationData: string | undefined) => boolean;

/**
 * @group Characteristic
 */
export declare interface Characteristic {

  on(event: "get", listener: (callback: CharacteristicGetCallback, context: CharacteristicContext, connection?: HAPConnection) => void): this;
  on(
    event: "set",
    listener: (value: CharacteristicValue, callback: CharacteristicSetCallback, context: CharacteristicContext, connection?: HAPConnection) => void
  ): this
  on(event: "change", listener: (change: CharacteristicChange) => void): this;
  /**
   * @private
   */
  on(event: "subscribe", listener: VoidCallback): this;
  /**
   * @private
   */
  on(event: "unsubscribe", listener: VoidCallback): this;
  /**
   * @private
   */
  on(event: "characteristic-warning", listener: (type: CharacteristicWarningType, message: string, stack?: string) => void): this;

  /**
   * @private
   */
  emit(event: "get", callback: CharacteristicGetCallback, context: CharacteristicContext, connection?: HAPConnection): boolean;
  /**
   * @private
   */
  emit(event: "set", value: CharacteristicValue, callback: CharacteristicSetCallback, context: CharacteristicContext, connection?: HAPConnection): boolean;
  /**
   * @private
   */
  emit(event: "change", change: CharacteristicChange): boolean;
  /**
   * @private
   */
  emit(event: "subscribe"): boolean;
  /**
   * @private
   */
  emit(event: "unsubscribe"): boolean;
  /**
   * @private
   */
  emit(event: "characteristic-warning", type: CharacteristicWarningType, message: string, stack?: string): boolean;

}

/**
 * @group Characteristic
 */
class ValidValuesIterable implements Iterable<number> {

  private readonly props: CharacteristicProps;

  constructor(props: CharacteristicProps) {
    assert(isNumericFormat(props.format), "Cannot instantiate valid values iterable when format is not numeric. Found " + props.format);
    this.props = props;
  }

  *[Symbol.iterator](): Iterator<number> {
    if (this.props.validValues) {
      for (const value of this.props.validValues) {
        yield value;
      }
    } else {
      let min = 0; // default is zero for all the uint types
      let max: number;
      let stepValue = 1;

      if (this.props.validValueRanges) {
        min = this.props.validValueRanges[0];
        max = this.props.validValueRanges[1];
      } else if (this.props.minValue != null && this.props.maxValue != null) {
        min = this.props.minValue;
        max = this.props.maxValue;
        if (this.props.minStep != null) {
          stepValue = this.props.minStep;
        }
      } else if (isUnsignedNumericFormat(this.props.format)) {
        max = numericUpperBound(this.props.format);
      } else {
        throw new Error("Could not find valid iterator strategy for props: " + JSON.stringify(this.props));
      }

      for (let i = min; i <= max; i += stepValue) {
        yield i;
      }
    }
  }

}

const numberPattern = /^-?\d+$/;
function extractHAPStatusFromError(error: Error) {
  let errorValue = HAPStatus.SERVICE_COMMUNICATION_FAILURE;

  if (numberPattern.test(error.message)) {
    const value = parseInt(error.message, 10);

    if (IsKnownHAPStatusError(value)) {
      errorValue = value;
    }
  }

  return errorValue;
}

function maxWithUndefined(a?: number, b?: number): number | undefined {
  if (a == null) {
    return b;
  } else if (b == null) {
    return a;
  } else {
    return Math.max(a, b);
  }
}

function minWithUndefined(a?: number, b?: number): number | undefined {
  if (a == null) {
    return b;
  } else if (b == null) {
    return a;
  } else {
    return Math.min(a, b);
  }
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
 *
 * @group Characteristic
 */
export class Characteristic extends EventEmitter {

  /**
   * @deprecated Please use the Formats const enum above.
   */
  // @ts-expect-error: forceConsistentCasingInFileNames compiler option
  static Formats = Formats;
  /**
   * @deprecated Please use the Units const enum above.
   */
  // @ts-expect-error: forceConsistentCasingInFileNames compiler option
  static Units = Units;
  /**
   * @deprecated Please use the Perms const enum above.
   */
  // @ts-expect-error: forceConsistentCasingInFileNames compiler option
  static Perms = Perms;

  // Pattern below is for automatic detection of the section of defined characteristics. Used by the generator
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  /**
   * @group Characteristic Definitions
   */
  public static AccessCodeControlPoint: typeof AccessCodeControlPoint;
  /**
   * @group Characteristic Definitions
   */
  public static AccessCodeSupportedConfiguration: typeof AccessCodeSupportedConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static AccessControlLevel: typeof AccessControlLevel;
  /**
   * @group Characteristic Definitions
   */
  public static AccessoryFlags: typeof AccessoryFlags;
  /**
   * @group Characteristic Definitions
   */
  public static AccessoryIdentifier: typeof AccessoryIdentifier;
  /**
   * @group Characteristic Definitions
   */
  public static Active: typeof Active;
  /**
   * @group Characteristic Definitions
   */
  public static ActiveIdentifier: typeof ActiveIdentifier;
  /**
   * @group Characteristic Definitions
   */
  public static ActivityInterval: typeof ActivityInterval;
  /**
   * @group Characteristic Definitions
   */
  public static AdministratorOnlyAccess: typeof AdministratorOnlyAccess;
  /**
   * @group Characteristic Definitions
   */
  public static AirParticulateDensity: typeof AirParticulateDensity;
  /**
   * @group Characteristic Definitions
   */
  public static AirParticulateSize: typeof AirParticulateSize;
  /**
   * @group Characteristic Definitions
   */
  public static AirPlayEnable: typeof AirPlayEnable;
  /**
   * @group Characteristic Definitions
   */
  public static AirQuality: typeof AirQuality;
  /**
   * @group Characteristic Definitions
   */
  public static AppMatchingIdentifier: typeof AppMatchingIdentifier;
  /**
   * @group Characteristic Definitions
   */
  public static AssetUpdateReadiness: typeof AssetUpdateReadiness;
  /**
   * @group Characteristic Definitions
   */
  public static AudioFeedback: typeof AudioFeedback;
  /**
   * @group Characteristic Definitions
   */
  public static BatteryLevel: typeof BatteryLevel;
  /**
   * @group Characteristic Definitions
   */
  public static Brightness: typeof Brightness;
  /**
   * @group Characteristic Definitions
   */
  public static ButtonEvent: typeof ButtonEvent;
  /**
   * @group Characteristic Definitions
   */
  public static CameraOperatingModeIndicator: typeof CameraOperatingModeIndicator;
  /**
   * @group Characteristic Definitions
   */
  public static CarbonDioxideDetected: typeof CarbonDioxideDetected;
  /**
   * @group Characteristic Definitions
   */
  public static CarbonDioxideLevel: typeof CarbonDioxideLevel;
  /**
   * @group Characteristic Definitions
   */
  public static CarbonDioxidePeakLevel: typeof CarbonDioxidePeakLevel;
  /**
   * @group Characteristic Definitions
   */
  public static CarbonMonoxideDetected: typeof CarbonMonoxideDetected;
  /**
   * @group Characteristic Definitions
   */
  public static CarbonMonoxideLevel: typeof CarbonMonoxideLevel;
  /**
   * @group Characteristic Definitions
   */
  public static CarbonMonoxidePeakLevel: typeof CarbonMonoxidePeakLevel;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static Category: typeof Category;
  /**
   * @group Characteristic Definitions
   */
  public static CCAEnergyDetectThreshold: typeof CCAEnergyDetectThreshold;
  /**
   * @group Characteristic Definitions
   */
  public static CCASignalDetectThreshold: typeof CCASignalDetectThreshold;
  /**
   * @group Characteristic Definitions
   */
  public static CharacteristicValueActiveTransitionCount: typeof CharacteristicValueActiveTransitionCount;
  /**
   * @group Characteristic Definitions
   */
  public static CharacteristicValueTransitionControl: typeof CharacteristicValueTransitionControl;
  /**
   * @group Characteristic Definitions
   */
  public static ChargingState: typeof ChargingState;
  /**
   * @group Characteristic Definitions
   */
  public static ClosedCaptions: typeof ClosedCaptions;
  /**
   * @group Characteristic Definitions
   */
  public static ColorTemperature: typeof ColorTemperature;
  /**
   * @group Characteristic Definitions
   */
  public static ConfigurationState: typeof ConfigurationState;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static ConfigureBridgedAccessory: typeof ConfigureBridgedAccessory;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static ConfigureBridgedAccessoryStatus: typeof ConfigureBridgedAccessoryStatus;
  /**
   * @group Characteristic Definitions
   */
  public static ConfiguredName: typeof ConfiguredName;
  /**
   * @group Characteristic Definitions
   */
  public static ContactSensorState: typeof ContactSensorState;
  /**
   * @group Characteristic Definitions
   */
  public static CoolingThresholdTemperature: typeof CoolingThresholdTemperature;
  /**
   * @group Characteristic Definitions
   */
  public static CryptoHash: typeof CryptoHash;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentAirPurifierState: typeof CurrentAirPurifierState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentAmbientLightLevel: typeof CurrentAmbientLightLevel;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentDoorState: typeof CurrentDoorState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentFanState: typeof CurrentFanState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentHeaterCoolerState: typeof CurrentHeaterCoolerState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentHeatingCoolingState: typeof CurrentHeatingCoolingState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentHorizontalTiltAngle: typeof CurrentHorizontalTiltAngle;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentHumidifierDehumidifierState: typeof CurrentHumidifierDehumidifierState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentMediaState: typeof CurrentMediaState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentPosition: typeof CurrentPosition;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentRelativeHumidity: typeof CurrentRelativeHumidity;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentSlatState: typeof CurrentSlatState;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentTemperature: typeof CurrentTemperature;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentTiltAngle: typeof CurrentTiltAngle;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static CurrentTime: typeof CurrentTime;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentTransport: typeof CurrentTransport;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentVerticalTiltAngle: typeof CurrentVerticalTiltAngle;
  /**
   * @group Characteristic Definitions
   */
  public static CurrentVisibilityState: typeof CurrentVisibilityState;
  /**
   * @group Characteristic Definitions
   */
  public static DataStreamHAPTransport: typeof DataStreamHAPTransport;
  /**
   * @group Characteristic Definitions
   */
  public static DataStreamHAPTransportInterrupt: typeof DataStreamHAPTransportInterrupt;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static DayoftheWeek: typeof DayoftheWeek;
  /**
   * @group Characteristic Definitions
   */
  public static DiagonalFieldOfView: typeof DiagonalFieldOfView;
  /**
   * @group Characteristic Definitions
   */
  public static DigitalZoom: typeof DigitalZoom;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static DiscoverBridgedAccessories: typeof DiscoverBridgedAccessories;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static DiscoveredBridgedAccessories: typeof DiscoveredBridgedAccessories;
  /**
   * @group Characteristic Definitions
   */
  public static DisplayOrder: typeof DisplayOrder;
  /**
   * @group Characteristic Definitions
   */
  public static EventRetransmissionMaximum: typeof EventRetransmissionMaximum;
  /**
   * @group Characteristic Definitions
   */
  public static EventSnapshotsActive: typeof EventSnapshotsActive;
  /**
   * @group Characteristic Definitions
   */
  public static EventTransmissionCounters: typeof EventTransmissionCounters;
  /**
   * @group Characteristic Definitions
   */
  public static FilterChangeIndication: typeof FilterChangeIndication;
  /**
   * @group Characteristic Definitions
   */
  public static FilterLifeLevel: typeof FilterLifeLevel;
  /**
   * @group Characteristic Definitions
   */
  public static FirmwareRevision: typeof FirmwareRevision;
  /**
   * @group Characteristic Definitions
   */
  public static FirmwareUpdateReadiness: typeof FirmwareUpdateReadiness;
  /**
   * @group Characteristic Definitions
   */
  public static FirmwareUpdateStatus: typeof FirmwareUpdateStatus;
  /**
   * @group Characteristic Definitions
   */
  public static HardwareFinish: typeof HardwareFinish;
  /**
   * @group Characteristic Definitions
   */
  public static HardwareRevision: typeof HardwareRevision;
  /**
   * @group Characteristic Definitions
   */
  public static HeartBeat: typeof HeartBeat;
  /**
   * @group Characteristic Definitions
   */
  public static HeatingThresholdTemperature: typeof HeatingThresholdTemperature;
  /**
   * @group Characteristic Definitions
   */
  public static HoldPosition: typeof HoldPosition;
  /**
   * @group Characteristic Definitions
   */
  public static HomeKitCameraActive: typeof HomeKitCameraActive;
  /**
   * @group Characteristic Definitions
   */
  public static Hue: typeof Hue;
  /**
   * @group Characteristic Definitions
   */
  public static Identifier: typeof Identifier;
  /**
   * @group Characteristic Definitions
   */
  public static Identify: typeof Identify;
  /**
   * @group Characteristic Definitions
   */
  public static ImageMirroring: typeof ImageMirroring;
  /**
   * @group Characteristic Definitions
   */
  public static ImageRotation: typeof ImageRotation;
  /**
   * @group Characteristic Definitions
   */
  public static InputDeviceType: typeof InputDeviceType;
  /**
   * @group Characteristic Definitions
   */
  public static InputSourceType: typeof InputSourceType;
  /**
   * @group Characteristic Definitions
   */
  public static InUse: typeof InUse;
  /**
   * @group Characteristic Definitions
   */
  public static IsConfigured: typeof IsConfigured;
  /**
   * @group Characteristic Definitions
   */
  public static LeakDetected: typeof LeakDetected;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static LinkQuality: typeof LinkQuality;
  /**
   * @group Characteristic Definitions
   */
  public static ListPairings: typeof ListPairings;
  /**
   * @group Characteristic Definitions
   */
  public static LockControlPoint: typeof LockControlPoint;
  /**
   * @group Characteristic Definitions
   */
  public static LockCurrentState: typeof LockCurrentState;
  /**
   * @group Characteristic Definitions
   */
  public static LockLastKnownAction: typeof LockLastKnownAction;
  /**
   * @group Characteristic Definitions
   */
  public static LockManagementAutoSecurityTimeout: typeof LockManagementAutoSecurityTimeout;
  /**
   * @group Characteristic Definitions
   */
  public static LockPhysicalControls: typeof LockPhysicalControls;
  /**
   * @group Characteristic Definitions
   */
  public static LockTargetState: typeof LockTargetState;
  /**
   * @group Characteristic Definitions
   */
  public static Logs: typeof Logs;
  /**
   * @group Characteristic Definitions
   */
  public static MACRetransmissionMaximum: typeof MACRetransmissionMaximum;
  /**
   * @group Characteristic Definitions
   */
  public static MACTransmissionCounters: typeof MACTransmissionCounters;
  /**
   * @group Characteristic Definitions
   */
  public static ManagedNetworkEnable: typeof ManagedNetworkEnable;
  /**
   * @group Characteristic Definitions
   */
  public static ManuallyDisabled: typeof ManuallyDisabled;
  /**
   * @group Characteristic Definitions
   */
  public static Manufacturer: typeof Manufacturer;
  /**
   * @group Characteristic Definitions
   */
  public static MaximumTransmitPower: typeof MaximumTransmitPower;
  /**
   * @group Characteristic Definitions
   */
  public static MetricsBufferFullState: typeof MetricsBufferFullState;
  /**
   * @group Characteristic Definitions
   */
  public static Model: typeof Model;
  /**
   * @group Characteristic Definitions
   */
  public static MotionDetected: typeof MotionDetected;
  /**
   * @group Characteristic Definitions
   */
  public static MultifunctionButton: typeof MultifunctionButton;
  /**
   * @group Characteristic Definitions
   */
  public static Mute: typeof Mute;
  /**
   * @group Characteristic Definitions
   */
  public static Name: typeof Name;
  /**
   * @group Characteristic Definitions
   */
  public static NetworkAccessViolationControl: typeof NetworkAccessViolationControl;
  /**
   * @group Characteristic Definitions
   */
  public static NetworkClientProfileControl: typeof NetworkClientProfileControl;
  /**
   * @group Characteristic Definitions
   */
  public static NetworkClientStatusControl: typeof NetworkClientStatusControl;
  /**
   * @group Characteristic Definitions
   */
  public static NFCAccessControlPoint: typeof NFCAccessControlPoint;
  /**
   * @group Characteristic Definitions
   */
  public static NFCAccessSupportedConfiguration: typeof NFCAccessSupportedConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static NightVision: typeof NightVision;
  /**
   * @group Characteristic Definitions
   */
  public static NitrogenDioxideDensity: typeof NitrogenDioxideDensity;
  /**
   * @group Characteristic Definitions
   */
  public static ObstructionDetected: typeof ObstructionDetected;
  /**
   * @group Characteristic Definitions
   */
  public static OccupancyDetected: typeof OccupancyDetected;
  /**
   * @group Characteristic Definitions
   */
  public static On: typeof On;
  /**
   * @group Characteristic Definitions
   */
  public static OperatingStateResponse: typeof OperatingStateResponse;
  /**
   * @group Characteristic Definitions
   */
  public static OpticalZoom: typeof OpticalZoom;
  /**
   * @group Characteristic Definitions
   */
  public static OutletInUse: typeof OutletInUse;
  /**
   * @group Characteristic Definitions
   */
  public static OzoneDensity: typeof OzoneDensity;
  /**
   * @group Characteristic Definitions
   */
  public static PairingFeatures: typeof PairingFeatures;
  /**
   * @group Characteristic Definitions
   */
  public static PairSetup: typeof PairSetup;
  /**
   * @group Characteristic Definitions
   */
  public static PairVerify: typeof PairVerify;
  /**
   * @group Characteristic Definitions
   */
  public static PasswordSetting: typeof PasswordSetting;
  /**
   * @group Characteristic Definitions
   */
  public static PeriodicSnapshotsActive: typeof PeriodicSnapshotsActive;
  /**
   * @group Characteristic Definitions
   */
  public static PictureMode: typeof PictureMode;
  /**
   * @group Characteristic Definitions
   */
  public static Ping: typeof Ping;
  /**
   * @group Characteristic Definitions
   */
  public static PM10Density: typeof PM10Density;
  /**
   * @group Characteristic Definitions
   */
  public static PM2_5Density: typeof PM2_5Density;
  /**
   * @group Characteristic Definitions
   */
  public static PositionState: typeof PositionState;
  /**
   * @group Characteristic Definitions
   */
  public static PowerModeSelection: typeof PowerModeSelection;
  /**
   * @group Characteristic Definitions
   */
  public static ProductData: typeof ProductData;
  /**
   * @group Characteristic Definitions
   */
  public static ProgrammableSwitchEvent: typeof ProgrammableSwitchEvent;
  /**
   * @group Characteristic Definitions
   */
  public static ProgrammableSwitchOutputState: typeof ProgrammableSwitchOutputState;
  /**
   * @group Characteristic Definitions
   */
  public static ProgramMode: typeof ProgramMode;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static Reachable: typeof Reachable;
  /**
   * @group Characteristic Definitions
   */
  public static ReceivedSignalStrengthIndication: typeof ReceivedSignalStrengthIndication;
  /**
   * @group Characteristic Definitions
   */
  public static ReceiverSensitivity: typeof ReceiverSensitivity;
  /**
   * @group Characteristic Definitions
   */
  public static RecordingAudioActive: typeof RecordingAudioActive;
  /**
   * @group Characteristic Definitions
   */
  public static RelativeHumidityDehumidifierThreshold: typeof RelativeHumidityDehumidifierThreshold;
  /**
   * @group Characteristic Definitions
   */
  public static RelativeHumidityHumidifierThreshold: typeof RelativeHumidityHumidifierThreshold;
  /**
   * @group Characteristic Definitions
   */
  public static RelayControlPoint: typeof RelayControlPoint;
  /**
   * @group Characteristic Definitions
   */
  public static RelayEnabled: typeof RelayEnabled;
  /**
   * @group Characteristic Definitions
   */
  public static RelayState: typeof RelayState;
  /**
   * @group Characteristic Definitions
   */
  public static RemainingDuration: typeof RemainingDuration;
  /**
   * @group Characteristic Definitions
   */
  public static RemoteKey: typeof RemoteKey;
  /**
   * @group Characteristic Definitions
   */
  public static ResetFilterIndication: typeof ResetFilterIndication;
  /**
   * @group Characteristic Definitions
   */
  public static RotationDirection: typeof RotationDirection;
  /**
   * @group Characteristic Definitions
   */
  public static RotationSpeed: typeof RotationSpeed;
  /**
   * @group Characteristic Definitions
   */
  public static RouterStatus: typeof RouterStatus;
  /**
   * @group Characteristic Definitions
   */
  public static Saturation: typeof Saturation;
  /**
   * @group Characteristic Definitions
   */
  public static SecuritySystemAlarmType: typeof SecuritySystemAlarmType;
  /**
   * @group Characteristic Definitions
   */
  public static SecuritySystemCurrentState: typeof SecuritySystemCurrentState;
  /**
   * @group Characteristic Definitions
   */
  public static SecuritySystemTargetState: typeof SecuritySystemTargetState;
  /**
   * @group Characteristic Definitions
   */
  public static SelectedAudioStreamConfiguration: typeof SelectedAudioStreamConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SelectedCameraRecordingConfiguration: typeof SelectedCameraRecordingConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SelectedDiagnosticsModes: typeof SelectedDiagnosticsModes;
  /**
   * @group Characteristic Definitions
   */
  public static SelectedRTPStreamConfiguration: typeof SelectedRTPStreamConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SelectedSleepConfiguration: typeof SelectedSleepConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SerialNumber: typeof SerialNumber;
  /**
   * @group Characteristic Definitions
   */
  public static ServiceLabelIndex: typeof ServiceLabelIndex;
  /**
   * @group Characteristic Definitions
   */
  public static ServiceLabelNamespace: typeof ServiceLabelNamespace;
  /**
   * @group Characteristic Definitions
   */
  public static SetDuration: typeof SetDuration;
  /**
   * @group Characteristic Definitions
   */
  public static SetupDataStreamTransport: typeof SetupDataStreamTransport;
  /**
   * @group Characteristic Definitions
   */
  public static SetupEndpoints: typeof SetupEndpoints;
  /**
   * @group Characteristic Definitions
   */
  public static SetupTransferTransport: typeof SetupTransferTransport;
  /**
   * @group Characteristic Definitions
   */
  public static SignalToNoiseRatio: typeof SignalToNoiseRatio;
  /**
   * @group Characteristic Definitions
   */
  public static SiriEnable: typeof SiriEnable;
  /**
   * @group Characteristic Definitions
   */
  public static SiriEndpointSessionStatus: typeof SiriEndpointSessionStatus;
  /**
   * @group Characteristic Definitions
   */
  public static SiriEngineVersion: typeof SiriEngineVersion;
  /**
   * @group Characteristic Definitions
   */
  public static SiriInputType: typeof SiriInputType;
  /**
   * @group Characteristic Definitions
   */
  public static SiriLightOnUse: typeof SiriLightOnUse;
  /**
   * @group Characteristic Definitions
   */
  public static SiriListening: typeof SiriListening;
  /**
   * @group Characteristic Definitions
   */
  public static SiriTouchToUse: typeof SiriTouchToUse;
  /**
   * @group Characteristic Definitions
   */
  public static SlatType: typeof SlatType;
  /**
   * @group Characteristic Definitions
   */
  public static SleepDiscoveryMode: typeof SleepDiscoveryMode;
  /**
   * @group Characteristic Definitions
   */
  public static SleepInterval: typeof SleepInterval;
  /**
   * @group Characteristic Definitions
   */
  public static SmokeDetected: typeof SmokeDetected;
  /**
   * @group Characteristic Definitions
   */
  public static SoftwareRevision: typeof SoftwareRevision;
  /**
   * @group Characteristic Definitions
   */
  public static StagedFirmwareVersion: typeof StagedFirmwareVersion;
  /**
   * @group Characteristic Definitions
   */
  public static StatusActive: typeof StatusActive;
  /**
   * @group Characteristic Definitions
   */
  public static StatusFault: typeof StatusFault;
  /**
   * @group Characteristic Definitions
   */
  public static StatusJammed: typeof StatusJammed;
  /**
   * @group Characteristic Definitions
   */
  public static StatusLowBattery: typeof StatusLowBattery;
  /**
   * @group Characteristic Definitions
   */
  public static StatusTampered: typeof StatusTampered;
  /**
   * @group Characteristic Definitions
   */
  public static StreamingStatus: typeof StreamingStatus;
  /**
   * @group Characteristic Definitions
   */
  public static SulphurDioxideDensity: typeof SulphurDioxideDensity;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedAssetTypes: typeof SupportedAssetTypes;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedAudioRecordingConfiguration: typeof SupportedAudioRecordingConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedAudioStreamConfiguration: typeof SupportedAudioStreamConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedCameraRecordingConfiguration: typeof SupportedCameraRecordingConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedCharacteristicValueTransitionConfiguration: typeof SupportedCharacteristicValueTransitionConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedDataStreamTransportConfiguration: typeof SupportedDataStreamTransportConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedDiagnosticsModes: typeof SupportedDiagnosticsModes;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedDiagnosticsSnapshot: typeof SupportedDiagnosticsSnapshot;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedFirmwareUpdateConfiguration: typeof SupportedFirmwareUpdateConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedMetrics: typeof SupportedMetrics;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedRouterConfiguration: typeof SupportedRouterConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedRTPConfiguration: typeof SupportedRTPConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedSleepConfiguration: typeof SupportedSleepConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedTransferTransportConfiguration: typeof SupportedTransferTransportConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedVideoRecordingConfiguration: typeof SupportedVideoRecordingConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SupportedVideoStreamConfiguration: typeof SupportedVideoStreamConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static SwingMode: typeof SwingMode;
  /**
   * @group Characteristic Definitions
   */
  public static TapType: typeof TapType;
  /**
   * @group Characteristic Definitions
   */
  public static TargetAirPurifierState: typeof TargetAirPurifierState;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static TargetAirQuality: typeof TargetAirQuality;
  /**
   * @group Characteristic Definitions
   */
  public static TargetControlList: typeof TargetControlList;
  /**
   * @group Characteristic Definitions
   */
  public static TargetControlSupportedConfiguration: typeof TargetControlSupportedConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static TargetDoorState: typeof TargetDoorState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetFanState: typeof TargetFanState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetHeaterCoolerState: typeof TargetHeaterCoolerState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetHeatingCoolingState: typeof TargetHeatingCoolingState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetHorizontalTiltAngle: typeof TargetHorizontalTiltAngle;
  /**
   * @group Characteristic Definitions
   */
  public static TargetHumidifierDehumidifierState: typeof TargetHumidifierDehumidifierState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetMediaState: typeof TargetMediaState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetPosition: typeof TargetPosition;
  /**
   * @group Characteristic Definitions
   */
  public static TargetRelativeHumidity: typeof TargetRelativeHumidity;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static TargetSlatState: typeof TargetSlatState;
  /**
   * @group Characteristic Definitions
   */
  public static TargetTemperature: typeof TargetTemperature;
  /**
   * @group Characteristic Definitions
   */
  public static TargetTiltAngle: typeof TargetTiltAngle;
  /**
   * @group Characteristic Definitions
   */
  public static TargetVerticalTiltAngle: typeof TargetVerticalTiltAngle;
  /**
   * @group Characteristic Definitions
   */
  public static TargetVisibilityState: typeof TargetVisibilityState;
  /**
   * @group Characteristic Definitions
   */
  public static TemperatureDisplayUnits: typeof TemperatureDisplayUnits;
  /**
   * @group Characteristic Definitions
   */
  public static ThirdPartyCameraActive: typeof ThirdPartyCameraActive;
  /**
   * @group Characteristic Definitions
   */
  public static ThreadControlPoint: typeof ThreadControlPoint;
  /**
   * @group Characteristic Definitions
   */
  public static ThreadNodeCapabilities: typeof ThreadNodeCapabilities;
  /**
   * @group Characteristic Definitions
   */
  public static ThreadOpenThreadVersion: typeof ThreadOpenThreadVersion;
  /**
   * @group Characteristic Definitions
   */
  public static ThreadStatus: typeof ThreadStatus;
  /**
   * @group Characteristic Definitions
   * @deprecated Removed and not used anymore
   */
  public static TimeUpdate: typeof TimeUpdate;
  /**
   * @group Characteristic Definitions
   */
  public static Token: typeof Token;
  /**
   * @group Characteristic Definitions
   */
  public static TransmitPower: typeof TransmitPower;
  /**
   * @group Characteristic Definitions
   */
  public static TunnelConnectionTimeout: typeof TunnelConnectionTimeout;
  /**
   * @group Characteristic Definitions
   */
  public static TunneledAccessoryAdvertising: typeof TunneledAccessoryAdvertising;
  /**
   * @group Characteristic Definitions
   */
  public static TunneledAccessoryConnected: typeof TunneledAccessoryConnected;
  /**
   * @group Characteristic Definitions
   */
  public static TunneledAccessoryStateNumber: typeof TunneledAccessoryStateNumber;
  /**
   * @group Characteristic Definitions
   */
  public static ValveType: typeof ValveType;
  /**
   * @group Characteristic Definitions
   */
  public static Version: typeof Version;
  /**
   * @group Characteristic Definitions
   */
  public static VideoAnalysisActive: typeof VideoAnalysisActive;
  /**
   * @group Characteristic Definitions
   */
  public static VOCDensity: typeof VOCDensity;
  /**
   * @group Characteristic Definitions
   */
  public static Volume: typeof Volume;
  /**
   * @group Characteristic Definitions
   */
  public static VolumeControlType: typeof VolumeControlType;
  /**
   * @group Characteristic Definitions
   */
  public static VolumeSelector: typeof VolumeSelector;
  /**
   * @group Characteristic Definitions
   */
  public static WakeConfiguration: typeof WakeConfiguration;
  /**
   * @group Characteristic Definitions
   */
  public static WANConfigurationList: typeof WANConfigurationList;
  /**
   * @group Characteristic Definitions
   */
  public static WANStatusList: typeof WANStatusList;
  /**
   * @group Characteristic Definitions
   */
  public static WaterLevel: typeof WaterLevel;
  /**
   * @group Characteristic Definitions
   */
  public static WiFiCapabilities: typeof WiFiCapabilities;
  /**
   * @group Characteristic Definitions
   */
  public static WiFiConfigurationControl: typeof WiFiConfigurationControl;
  /**
   * @group Characteristic Definitions
   */
  public static WiFiSatelliteStatus: typeof WiFiSatelliteStatus;
  // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=

  // NOTICE: when adding/changing properties, remember to possibly adjust the serialize/deserialize functions
  public displayName: string;
  public UUID: string;
  iid: Nullable<number> = null;
  value: Nullable<CharacteristicValue> = null;
  /**
   * @deprecated replaced by {@link statusCode}
   * @private
   */
  status: Nullable<Error> = null;
  /**
   * @private
   */
  statusCode: HAPStatus = HAPStatus.SUCCESS;
  props: CharacteristicProps;

  /**
   * The {@link Characteristic.onGet} handler
   */
  private getHandler?: CharacteristicGetHandler;

  /**
   * The {@link Characteristic.onSet} handler
   */
  private setHandler?: CharacteristicSetHandler;

  private subscriptions = 0;
  /**
   * @private
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
  public onGet(handler: CharacteristicGetHandler): Characteristic {
    if (typeof handler !== "function") {
      this.characteristicWarning(".onGet handler must be a function");
      return this;
    }
    this.getHandler = handler;
    return this;
  }

  /**
   * Removes the {@link CharacteristicGetHandler} handler which was configured using {@link onGet}.
   */
  public removeOnGet(): Characteristic {
    this.getHandler = undefined;
    return this;
  }

  /**
   * Accepts a function that will be called when setting the value of a Characteristic.
   * If the characteristic supports {@link Perms.WRITE_RESPONSE} and the request requests a write-response value,
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
  public onSet(handler: CharacteristicSetHandler): Characteristic {
    if (typeof handler !== "function") {
      this.characteristicWarning(".onSet handler must be a function");
      return this;
    }
    this.setHandler = handler;
    return this;
  }

  /**
   * Removes the {@link CharacteristicSetHandler} which was configured using {@link onSet}.
   */
  public removeOnSet(): Characteristic {
    this.setHandler = undefined;
    return this;
  }

  /**
   * Updates the properties of this characteristic.
   * Properties passed via the parameter will be set. Any parameter set to null will be deleted.
   * See {@link CharacteristicProps}.
   *
   * @param props - Partial properties object with the desired updates.
   */
  public setProps(props: PartialAllowingNull<CharacteristicProps>): Characteristic {
    assert(props, "props cannot be undefined when setting props");
    // TODO calling setProps after publish doesn't lead to a increment in the current configuration number

    let formatDidChange = false;

    // for every value "null" can be used to reset props, except for required props
    if (props.format) {
      formatDidChange = this.props.format !== props.format;
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

    // check minValue is valid for the format type
    if (props.minValue !== undefined) {
      if (props.minValue === null) {
        props.minValue = undefined;
      } else if (!isNumericFormat(this.props.format)) {
        this.characteristicWarning(
          "Characteristic Property 'minValue' can only be set for characteristics with numeric format, but not for " + this.props.format,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
        props.minValue = undefined;
      } else if (typeof (props.minValue as unknown) !== "number" || !Number.isFinite(props.minValue)) {
        this.characteristicWarning(
          `Characteristic Property 'minValue' must be a finite number, received "${props.minValue}" (${typeof props.minValue})`,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
        props.minValue = undefined;
      } else {
        if (props.minValue < numericLowerBound(this.props.format)) {
          this.characteristicWarning(
            "Characteristic Property 'minValue' was set to " + props.minValue + ", but for numeric format " +
            this.props.format + " minimum possible is " + numericLowerBound(this.props.format),
            CharacteristicWarningType.ERROR_MESSAGE,
          );
          props.minValue = numericLowerBound(this.props.format);
        } else if (props.minValue > numericUpperBound(this.props.format)) {
          this.characteristicWarning(
            "Characteristic Property 'minValue' was set to " + props.minValue + ", but for numeric format " +
            this.props.format + " maximum possible is " + numericUpperBound(this.props.format),
            CharacteristicWarningType.ERROR_MESSAGE,
          );
          props.minValue = numericLowerBound(this.props.format);
        }
      }

      this.props.minValue = props.minValue;
    }

    // check maxValue is valid for the format type
    if (props.maxValue !== undefined) {
      if (props.maxValue === null) {
        props.maxValue = undefined;
      } else if (!isNumericFormat(this.props.format)) {
        this.characteristicWarning(
          "Characteristic Property 'maxValue' can only be set for characteristics with numeric format, but not for " + this.props.format,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
        props.maxValue = undefined;
      } else if (typeof (props.maxValue as unknown) !== "number" || !Number.isFinite(props.maxValue)) {
        this.characteristicWarning(
          `Characteristic Property 'maxValue' must be a finite number, received "${props.maxValue}" (${typeof props.maxValue})`,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
        props.maxValue = undefined;
      } else {
        if (props.maxValue > numericUpperBound(this.props.format)) {
          this.characteristicWarning(
            "Characteristic Property 'maxValue' was set to " + props.maxValue + ", but for numeric format " +
            this.props.format + " maximum possible is " + numericUpperBound(this.props.format),
            CharacteristicWarningType.ERROR_MESSAGE,
          );
          props.maxValue = numericUpperBound(this.props.format);
        } else if (props.maxValue < numericLowerBound(this.props.format)) {
          this.characteristicWarning(
            "Characteristic Property 'maxValue' was set to " + props.maxValue + ", but for numeric format " +
            this.props.format + " minimum possible is " + numericLowerBound(this.props.format),
            CharacteristicWarningType.ERROR_MESSAGE,
          );
          props.maxValue = numericUpperBound(this.props.format);
        }
      }

      this.props.maxValue = props.maxValue;
    }

    if (props.minStep !== undefined) {
      if (props.minStep === null) {
        this.props.minStep = undefined;
      } else if (!isNumericFormat(this.props.format)) {
        this.characteristicWarning(
          "Characteristic Property `minStep` can only be set for characteristics with numeric format, but not for " + this.props.format,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
      } else {
        if (props.minStep < 1 && isIntegerNumericFormat(this.props.format)) {
          this.characteristicWarning("Characteristic Property `minStep` was set to a value lower than 1, " +
            "this will have no effect on format `" + this.props.format);
        }

        this.props.minStep = props.minStep;
      }
    }
    if (props.maxLen !== undefined) {
      if (props.maxLen === null) {
        this.props.maxLen = undefined;
      } else if (this.props.format !== Formats.STRING) {
        this.characteristicWarning(
          "Characteristic Property `maxLen` can only be set for characteristics with format `STRING`, but not for " + this.props.format,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
      } else {
        if (props.maxLen > 256) {
          this.characteristicWarning("Characteristic Property string `maxLen` cannot be bigger than 256");
          props.maxLen = 256;
        }
        this.props.maxLen = props.maxLen;
      }
    }
    if (props.maxDataLen !== undefined) {
      if (props.maxDataLen === null) {
        this.props.maxDataLen = undefined;
      } else if (this.props.format !== Formats.DATA) {
        this.characteristicWarning(
          "Characteristic Property `maxDataLen` can only be set for characteristics with format `DATA`, but not for " + this.props.format,
          CharacteristicWarningType.ERROR_MESSAGE,
        );
      } else {
        this.props.maxDataLen = props.maxDataLen;
      }
    }
    if (props.validValues !== undefined) {
      if (props.validValues === null) {
        this.props.validValues = undefined;
      } else if (!isNumericFormat(this.props.format)) {
        this.characteristicWarning("Characteristic Property `validValues` was supplied for non numeric format " + this.props.format);
      } else {
        assert(props.validValues.length, "characteristic prop validValues cannot be empty array");
        this.props.validValues = props.validValues;
      }
    }
    if (props.validValueRanges !== undefined) {
      if (props.validValueRanges === null) {
        this.props.validValueRanges = undefined;
      } else if (!isNumericFormat(this.props.format)) {
        this.characteristicWarning("Characteristic Property `validValueRanges` was supplied for non numeric format " + this.props.format);
      } else {
        assert(props.validValueRanges.length === 2, "characteristic prop validValueRanges must have a length of 2");
        this.props.validValueRanges = props.validValueRanges;
      }
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

    if ((isNumericFormat(this.props.format) || this.props.format === Formats.STRING)
      && this.value != null
      && !formatDidChange
      && this.statusCode === HAPStatus.SUCCESS
      && this.UUID !== Characteristic.ProgrammableSwitchEvent.UUID) {
      // explaining the if statement above:
      // - We only do a check for numeric and string formats as they are the only ones affected by characteristic property restrictions.
      // - There must be a value to begin with. Otherwise, it should just stay not having a value at all (anything else is guess work).
      // - If the format is changed through `setProps` we rely on the user to supply a valid value after the `setProps` call!
      // - If the characteristic is marked as erroneous the value is not considered valid anyway, and we must not remove the `statusCode`.
      // - Special case for `ProgrammableSwitchEvent` where every change in value is considered an event which would result in ghost button presses

      // validateUserInput when called from setProps is intended to clamp value withing allowed range. It is why warnings should not be displayed.
      const correctedValue = this.validateUserInput(this.value, CharacteristicWarningType.DEBUG_MESSAGE);

      if (correctedValue !== this.value) {
        // we don't want to emit a CHANGE event if the value didn't change at all!
        this.updateValue(correctedValue);
      }
    }

    return this;
  }

  /**
   * This method can be used to gain an Iterator to loop over all valid values defined for this characteristic.
   *
   * The range of valid values can be defined using three different ways via the {@link CharacteristicProps} object
   * (set via the {@link setProps} method):
   *  * First method is to specifically list every valid value inside {@link CharacteristicProps.validValues}
   *  * Second you can specify a range via {@link CharacteristicProps.minValue} and {@link CharacteristicProps.maxValue} (with optionally defining
   *    {@link CharacteristicProps.minStep})
   *  * And lastly you can specify a range via {@link CharacteristicProps.validValueRanges}
   *  * Implicitly a valid value range is predefined for characteristics with Format {@link Formats.UINT8}, {@link Formats.UINT16},
   *    {@link Formats.UINT32} and {@link Formats.UINT64}: starting by zero to their respective maximum number
   *
   * The method will automatically detect which type of valid values definition is used and provide
   * the correct Iterator for that case.
   *
   * Note: This method is (obviously) only valid for numeric characteristics.
   *
   * @example
   * ```ts
   * // use the iterator to loop over every valid value...
   * for (const value of characteristic.validValuesIterator()) {
   *   // Insert logic to run for every
   * }
   *
   * // ... or collect them in an array for storage or manipulation
   * const validValues = Array.from(characteristic.validValuesIterator());
   * ```
   */
  public validValuesIterator(): Iterable<number> {
    return new ValidValuesIterable(this.props);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * This method can be used to set up additional authorization for a characteristic.
   * For one, it adds the {@link Perms.ADDITIONAL_AUTHORIZATION} permission to the characteristic
   * (if it wasn't already) to signal support for additional authorization to HomeKit.
   * Additionally, an {@link AdditionalAuthorizationHandler} is set up which is called
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
   * @private use to return the current value on HAP requests
   *
   * @deprecated
   */
  getValue(callback?: CharacteristicGetCallback, context?: CharacteristicContext): void {
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
   * This acts the same way as when a HomeKit controller sends a `/characteristics` request to update the characteristic.
   * An event notification will be sent to all connected HomeKit controllers which are registered
   * to receive event notifications for this characteristic.
   *
   * This method behaves like a {@link updateValue} call with the addition that the own {@link CharacteristicEventTypes.SET}
   * event handler is called.
   *
   * @param value - The new value.
   *
   * Note: If you don't want the {@link CharacteristicEventTypes.SET} to be called, refer to {@link updateValue}.
   */
  setValue(value: CharacteristicValue): Characteristic
  /**
   * Sets the state of the characteristic to an errored state.
   *
   * If a {@link onGet} or {@link CharacteristicEventTypes.GET} handler is set up,
   * the errored state will be ignored and the characteristic will always query the latest state by calling the provided handler.
   *
   * If a generic error object is supplied, the characteristic tries to extract a {@link HAPStatus} code
   * from the error message string. If not possible a generic {@link HAPStatus.SERVICE_COMMUNICATION_FAILURE} will be used.
   * If the supplied error object is an instance of {@link HapStatusError} the corresponding status will be used.
   *
   * This doesn't call any registered {@link onSet} or {@link CharacteristicEventTypes.SET} handlers.
   *
   * Have a look at the
   * {@link https://github.com/homebridge/HAP-NodeJS/wiki/Presenting-Erroneous-Accessory-State-to-the-User Presenting Erroneous Accessory State to the User}
   * guide for more information on how to present erroneous state to the user.
   *
   * @param error - The error object
   *
   * Note: Erroneous state is never **pushed** to the client side. Only, if the HomeKit client requests the current
   *  state of the Characteristic, the corresponding {@link HapStatusError} is returned. As described above,
   *  any {@link onGet} or {@link CharacteristicEventTypes.GET} handlers have precedence.
   */
  setValue(error: HapStatusError | Error): Characteristic;
  /**
   * This updates the value by calling the {@link CharacteristicEventTypes.SET} event handler associated with the characteristic.
   * This acts the same way as when a HomeKit controller sends a `/characteristics` request to update the characteristic.
   * An event notification will be sent to all connected HomeKit controllers which are registered
   * to receive event notifications for this characteristic.
   *
   * This method behaves like a {@link updateValue} call with the addition that the own {@link CharacteristicEventTypes.SET}
   * event handler is called.
   *
   * @param value - The new value.
   * @param callback - Deprecated parameter there to provide backwards compatibility. Called once the
   *   {@link CharacteristicEventTypes.SET} event handler returns.
   * @param context - Passed to the {@link CharacteristicEventTypes.SET} and {@link CharacteristicEventTypes.CHANGE} event handler.
   *
   * @deprecated Parameter `callback` is deprecated.
   */
  setValue(value: CharacteristicValue, callback?: CharacteristicSetCallback, context?: CharacteristicContext): Characteristic
  /**
   * This updates the value by calling the {@link CharacteristicEventTypes.SET} event handler associated with the characteristic.
   * This acts the same way as when a HomeKit controller sends a `/characteristics` request to update the characteristic.
   * An event notification will be sent to all connected HomeKit controllers which are registered
   * to receive event notifications for this characteristic.
   *
   * This method behaves like a {@link updateValue} call with the addition that the own {@link CharacteristicEventTypes.SET}
   * event handler is called.
   *
   * @param value - The new value.
   * @param context - Passed to the {@link CharacteristicEventTypes.SET} and {@link CharacteristicEventTypes.CHANGE} event handler.
   *
   * Note: If you don't want the {@link CharacteristicEventTypes.SET} to be called, refer to {@link updateValue}.
   */
  setValue(value: CharacteristicValue, context?: CharacteristicContext): Characteristic;
  setValue(value: CharacteristicValue | Error, callback?: CharacteristicSetCallback, context?: CharacteristicContext): Characteristic {
    if (value instanceof Error) {
      this.statusCode = value instanceof HapStatusError? value.hapStatus: extractHAPStatusFromError(value);
      // noinspection JSDeprecatedSymbols
      this.status = value;

      if (callback) {
        callback();
      }
      return this;
    }

    if (callback && !context && typeof callback !== "function") {
      context = callback;
      callback = undefined;
    }

    try {
      value = this.validateUserInput(value)!;
    } catch (error) {
      this.characteristicWarning(error?.message + "", CharacteristicWarningType.ERROR_MESSAGE, error?.stack);
      if (callback) {
        callback(error);
      }
      return this;
    }

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
   * This updates the value of the characteristic. If the value changed, an event notification will be sent to all connected
   * HomeKit controllers which are registered to receive event notifications for this characteristic.
   *
   * @param value - The new value or a `Error` or {@link HapStatusError}.
   *
   * Note: Refer to the respective overloads for {@link CharacteristicValue} or {@link HapStatusError} for respective documentation.
   */
  updateValue(value: Nullable<CharacteristicValue> | Error | HapStatusError): Characteristic;
  /**
   * This updates the value of the characteristic. If the value changed, an event notification will be sent to all connected
   * HomeKit controllers which are registered to receive event notifications for this characteristic.
   *
   * @param value - The new value.
   */
  updateValue(value: Nullable<CharacteristicValue>): Characteristic;
  /**
   * Sets the state of the characteristic to an errored state.
   * If a {@link onGet} or {@link CharacteristicEventTypes.GET} handler is set up,
   * the errored state will be ignored and the characteristic will always query the latest state by calling the provided handler.
   *
   * If a generic error object is supplied, the characteristic tries to extract a {@link HAPStatus} code
   * from the error message string. If not possible a generic {@link HAPStatus.SERVICE_COMMUNICATION_FAILURE} will be used.
   * If the supplied error object is an instance of {@link HapStatusError} the corresponding status will be used.
   *
   * Have a look at the
   * {@link https://github.com/homebridge/HAP-NodeJS/wiki/Presenting-Erroneous-Accessory-State-to-the-User Presenting Erroneous Accessory State to the User}
   * guide for more information on how to present erroneous state to the user.
   *
   * @param error - The error object
   *
   * Note: Erroneous state is never **pushed** to the client side. Only, if the HomeKit client requests the current
   *  state of the Characteristic, the corresponding {@link HapStatusError} is returned. As described above,
   *  any {@link onGet} or {@link CharacteristicEventTypes.GET} handlers have precedence.
   */
  updateValue(error: Error | HapStatusError): Characteristic;
  /**
   * This updates the value of the characteristic. If the value changed, an event notification will be sent to all connected
   * HomeKit controllers which are registered to receive event notifications for this characteristic.
   *
   * @param value - The new value.
   * @param callback - Deprecated parameter there to provide backwards compatibility. Callback is called instantly.
   * @param context - Passed to the {@link CharacteristicEventTypes.CHANGE} event handler.
   *
   * @deprecated Parameter `callback` is deprecated.
   */
  updateValue(value: Nullable<CharacteristicValue>, callback?: () => void, context?: CharacteristicContext): Characteristic;
  /**
   * This updates the value of the characteristic. If the value changed, an event notification will be sent to all connected
   * HomeKit controllers which are registered to receive event notifications for this characteristic.
   *
   * @param value - The new value.
   * @param context - Passed to the {@link CharacteristicEventTypes.CHANGE} event handler.
   */
  updateValue(value: Nullable<CharacteristicValue>, context?: CharacteristicContext): Characteristic;
  updateValue(value: Nullable<CharacteristicValue> | Error | HapStatusError, callback?: () => void, context?: CharacteristicContext): Characteristic {
    if (value instanceof Error) {
      this.statusCode = value instanceof HapStatusError? value.hapStatus: extractHAPStatusFromError(value);
      // noinspection JSDeprecatedSymbols
      this.status = value;

      if (callback) {
        callback();
      }
      return this;
    }

    if (callback && !context && typeof callback !== "function") {
      context = callback;
      callback = undefined;
    }

    try {
      value = this.validateUserInput(value);
    } catch (error) {
      this.characteristicWarning(error?.message + "", CharacteristicWarningType.ERROR_MESSAGE, error?.stack);
      if (callback) {
        callback();
      }
      return this;
    }

    this.statusCode = HAPStatus.SUCCESS;
    // noinspection JSDeprecatedSymbols
    this.status = null;

    const oldValue = this.value;
    this.value = value;

    if (callback) {
      callback();
    }

    this.emit(CharacteristicEventTypes.CHANGE, { originator: undefined, oldValue: oldValue, newValue: value, reason: ChangeReason.UPDATE, context: context });

    return this; // for chaining
  }

  /**
   * This method acts similarly to {@link updateValue} by setting the current value of the characteristic
   * without calling any {@link CharacteristicEventTypes.SET} or {@link onSet} handlers.
   * The difference is that this method forces an event notification sent (updateValue only sends one if the value changed).
   * This is especially useful for characteristics like {@link Characteristic.ButtonEvent} or {@link Characteristic.ProgrammableSwitchEvent}.
   *
   * @param value - The new value.
   * @param context - Passed to the {@link CharacteristicEventTypes.CHANGE} event handler.
   */
  public sendEventNotification(value: CharacteristicValue, context?: CharacteristicContext): Characteristic {
    this.statusCode = HAPStatus.SUCCESS;
    // noinspection JSDeprecatedSymbols
    this.status = null;

    value = this.validateUserInput(value)!;
    const oldValue = this.value;
    this.value = value;

    this.emit(CharacteristicEventTypes.CHANGE, { originator: undefined, oldValue: oldValue, newValue: value, reason: ChangeReason.EVENT, context: context });

    return this; // for chaining
  }

  /**
   * Called when a HAP requests wants to know the current value of the characteristic.
   *
   * @param connection - The HAP connection from which the request originated from.
   * @param context - Deprecated parameter. There for backwards compatibility.
   * @private Used by the Accessory to load the characteristic value
   */
  async handleGetRequest(connection?: HAPConnection, context?: CharacteristicContext): Promise<Nullable<CharacteristicValue>> {
    if (!this.props.perms.includes(Perms.PAIRED_READ)) { // check if we are allowed to read from this characteristic
      throw HAPStatus.WRITE_ONLY_CHARACTERISTIC;
    }

    if (this.UUID === Characteristic.ProgrammableSwitchEvent.UUID) {
      // special workaround for event only programmable switch event, which must always return null
      return null;
    }

    if (this.getHandler) {
      if (this.listeners(CharacteristicEventTypes.GET).length > 0) {
        this.characteristicWarning("Ignoring on('get') handler as onGet handler was defined instead");
      }

      try {
        let value = await this.getHandler(context, connection);
        this.statusCode = HAPStatus.SUCCESS;
        // noinspection JSDeprecatedSymbols
        this.status = null;

        try {
          value = this.validateUserInput(value);
        } catch (error) {
          this.characteristicWarning(`An illegal value was supplied by the read handler for characteristic: ${error?.message}`,
            CharacteristicWarningType.WARN_MESSAGE, error?.stack);
          this.statusCode = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
          // noinspection JSDeprecatedSymbols
          this.status = error;
          return Promise.reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }

        const oldValue = this.value;
        this.value = value;

        if (oldValue !== value) { // emit a change event if necessary
          this.emit(
            CharacteristicEventTypes.CHANGE,
            { originator: connection, oldValue: oldValue, newValue: value, reason: ChangeReason.READ, context: context },
          );
        }

        return value;
      } catch (error) {
        if (typeof error === "number") {
          const hapStatusError = new HapStatusError(error);
          this.statusCode = hapStatusError.hapStatus;
          // noinspection JSDeprecatedSymbols
          this.status = hapStatusError;
        } else if (error instanceof HapStatusError) {
          this.statusCode = error.hapStatus;
          // noinspection JSDeprecatedSymbols
          this.status = error;
        } else {
          this.characteristicWarning(`Unhandled error thrown inside read handler for characteristic: ${error?.message}`,
            CharacteristicWarningType.ERROR_MESSAGE, error?.stack);
          this.statusCode = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
          // noinspection JSDeprecatedSymbols
          this.status = error;
        }
        throw this.statusCode;
      }
    }

    if (this.listeners(CharacteristicEventTypes.GET).length === 0) {
      if (this.statusCode) {
        throw this.statusCode;
      }

      try {
        return this.validateUserInput(this.value);
      } catch (error) {
        this.characteristicWarning(`An illegal value was supplied by setting \`value\` for characteristic: ${error?.message}`,
          CharacteristicWarningType.WARN_MESSAGE, error?.stack);
        return Promise.reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        this.emit(CharacteristicEventTypes.GET, once((status, value) => {
          if (status) {
            if (typeof status === "number") {
              const hapStatusError = new HapStatusError(status);
              this.statusCode = hapStatusError.hapStatus;
              // noinspection JSDeprecatedSymbols
              this.status = hapStatusError;
            } else if (status instanceof HapStatusError) {
              this.statusCode = status.hapStatus;
              // noinspection JSDeprecatedSymbols
              this.status = status;
            } else {
              debug("[%s] Received error from get handler %s", this.displayName, status.stack);
              this.statusCode = extractHAPStatusFromError(status);
              // noinspection JSDeprecatedSymbols
              this.status = status;
            }
            reject(this.statusCode);
            return;
          }

          this.statusCode = HAPStatus.SUCCESS;
          // noinspection JSDeprecatedSymbols
          this.status = null;

          value = this.validateUserInput(value);
          const oldValue = this.value;
          this.value = value;

          resolve(value);

          if (oldValue !== value) { // emit a change event if necessary
            this.emit(
              CharacteristicEventTypes.CHANGE,
              { originator: connection, oldValue: oldValue, newValue: value, reason: ChangeReason.READ, context: context },
            );
          }
        }), context, connection);
      } catch (error) {
        this.characteristicWarning(`Unhandled error thrown inside read handler for characteristic: ${error?.message}`,
          CharacteristicWarningType.ERROR_MESSAGE, error?.stack);
        this.statusCode = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
        // noinspection JSDeprecatedSymbols
        this.status = error;
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
   * @returns Promise resolve to void in normal operation. When characteristic supports write-response, HAP
   *  requests a write-response and the set handler returns a write-response value, the respective
   *  write response value is resolved.
   * @private
   */
  async handleSetRequest(value: CharacteristicValue, connection?: HAPConnection, context?: CharacteristicContext): Promise<CharacteristicValue | void> {
    this.statusCode = HAPStatus.SUCCESS;
    // noinspection JSDeprecatedSymbols
    this.status = null;

    if (connection !== undefined) {
      // if connection is undefined, the set "request" comes from the setValue method.
      // for setValue a value of "null" is allowed and checked via validateUserInput.
      try {
        value = this.validateClientSuppliedValue(value);
      } catch (e) {
        debug(`[${this.displayName}]`, e.message);
        return Promise.reject(HAPStatus.INVALID_VALUE_IN_REQUEST);
      }
    }

    const oldValue = this.value;

    if (this.setHandler) {
      if (this.listeners(CharacteristicEventTypes.SET).length > 0) {
        this.characteristicWarning("Ignoring on('set') handler as onSet handler was defined instead");
      }

      try {
        const writeResponse = await this.setHandler(value, context, connection);
        this.statusCode = HAPStatus.SUCCESS;
        // noinspection JSDeprecatedSymbols
        this.status = null;

        if (writeResponse != null && this.props.perms.includes(Perms.WRITE_RESPONSE)) {
          this.value = this.validateUserInput(writeResponse);
          return this.value!;
        } else {
          if (writeResponse != null) {
            this.characteristicWarning("SET handler returned write response value, though the characteristic doesn't support write response",
              CharacteristicWarningType.DEBUG_MESSAGE);
          }
          this.value = value;

          this.emit(
            CharacteristicEventTypes.CHANGE,
            { originator: connection, oldValue: oldValue, newValue: value, reason: ChangeReason.WRITE, context: context },
          );
          return;
        }
      } catch (error) {
        if (typeof error === "number") {
          const hapStatusError = new HapStatusError(error);
          this.statusCode = hapStatusError.hapStatus;
          // noinspection JSDeprecatedSymbols
          this.status = hapStatusError;
        } else if (error instanceof HapStatusError) {
          this.statusCode = error.hapStatus;
          // noinspection JSDeprecatedSymbols
          this.status = error;
        } else {
          this.characteristicWarning(`Unhandled error thrown inside write handler for characteristic: ${error?.message}`,
            CharacteristicWarningType.ERROR_MESSAGE, error?.stack);
          this.statusCode = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
          // noinspection JSDeprecatedSymbols
          this.status = error;
        }
        throw this.statusCode;
      }
    }

    if (this.listeners(CharacteristicEventTypes.SET).length === 0) {
      this.value = value;
      this.emit(CharacteristicEventTypes.CHANGE, { originator: connection, oldValue: oldValue, newValue: value, reason: ChangeReason.WRITE, context: context });
      return Promise.resolve();
    } else {
      return new Promise((resolve, reject) => {
        try {
          this.emit(CharacteristicEventTypes.SET, value, once((status, writeResponse) => {
            if (status) {
              if (typeof status === "number") {
                const hapStatusError = new HapStatusError(status);
                this.statusCode = hapStatusError.hapStatus;
                // noinspection JSDeprecatedSymbols
                this.status = hapStatusError;
              } else if (status instanceof HapStatusError) {
                this.statusCode = status.hapStatus;
                // noinspection JSDeprecatedSymbols
                this.status = status;
              } else {
                debug("[%s] Received error from set handler %s", this.displayName, status.stack);
                this.statusCode = extractHAPStatusFromError(status);
                // noinspection JSDeprecatedSymbols
                this.status = status;
              }
              reject(this.statusCode);
              return;
            }

            this.statusCode = HAPStatus.SUCCESS;
            // noinspection JSDeprecatedSymbols
            this.status = null;

            if (writeResponse != null && this.props.perms.includes(Perms.WRITE_RESPONSE)) {
              // support write response simply by letting the implementor pass the response as second argument to the callback
              this.value = this.validateUserInput(writeResponse);
              resolve(this.value!);
            } else {
              if (writeResponse != null) {
                this.characteristicWarning("SET handler returned write response value, though the characteristic doesn't support write response",
                  CharacteristicWarningType.DEBUG_MESSAGE);
              }
              this.value = value;
              resolve();

              this.emit(
                CharacteristicEventTypes.CHANGE,
                { originator: connection, oldValue: oldValue, newValue: value, reason: ChangeReason.WRITE, context: context },
              );
            }
          }), context, connection);
        } catch (error) {
          this.characteristicWarning(`Unhandled error thrown inside write handler for characteristic: ${error?.message}`,
            CharacteristicWarningType.ERROR_MESSAGE, error?.stack);
          this.statusCode = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
          // noinspection JSDeprecatedSymbols
          this.status = error;
          reject(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
    }
  }

  /**
   * Called once a HomeKit controller subscribes to events of this characteristic.
   * @private
   */
  subscribe(): void {
    if (this.subscriptions === 0) {
      this.emit(CharacteristicEventTypes.SUBSCRIBE);
    }
    this.subscriptions++;
  }

  /**
   * Called once a HomeKit controller unsubscribe to events of this characteristic or a HomeKit controller
   * which was subscribed to this characteristic disconnects.
   * @private
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
      return ""; // who knows!
    case Formats.TLV8:
      return ""; // who knows!
    case Formats.DICTIONARY:
      return {};
    case Formats.ARRAY:
      return [];
    case Formats.INT:
    case Formats.FLOAT:
    case Formats.UINT8:
    case Formats.UINT16:
    case Formats.UINT32:
    case Formats.UINT64:
      switch(this.UUID) {
      case Characteristic.CurrentTemperature.UUID:
        return 0; // some existing integrations expect this to be 0 by default
      default: {
        if (this.props.validValues?.length && typeof this.props.validValues[0] === "number") {
          return this.props.validValues[0];
        }
        if (typeof this.props.minValue === "number" && Number.isFinite(this.props.minValue)) {
          return this.props.minValue;
        }
        return 0;
      }
      }
    default:
      return 0;
    }
  }

  /**
   * Checks if the value received from the HAP request is valid.
   * If returned false the received value is not valid and {@link HAPStatus.INVALID_VALUE_IN_REQUEST}
   * must be returned.
   * @param value - Value supplied by the HomeKit controller
   */
  private validateClientSuppliedValue(value?: Nullable<CharacteristicValue>): CharacteristicValue {
    if (value == null) {
      throw new Error(`Client supplied invalid value for ${this.props.format}: ${value}`);
    }

    switch (this.props.format) {
    case Formats.BOOL: {
      if (typeof value === "boolean") {
        return value;
      }

      if (typeof value === "number" && (value === 1 || value === 0)) {
        return Boolean(value);
      }

      throw new Error(`Client supplied invalid type for ${this.props.format}: "${value}" (${typeof value})`);
    }
    case Formats.INT:
    case Formats.FLOAT:
    case Formats.UINT8:
    case Formats.UINT16:
    case Formats.UINT32:
    case Formats.UINT64: {
      if (typeof value === "boolean") {
        value = value ? 1 : 0;
      }

      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Client supplied invalid type for ${this.props.format}: "${value}" (${typeof value})`);
      }

      const numericMin = maxWithUndefined(this.props.minValue, numericLowerBound(this.props.format));
      const numericMax = minWithUndefined(this.props.maxValue, numericUpperBound(this.props.format));

      if (typeof numericMin === "number" && value < numericMin) {
        throw new Error(`Client supplied value of ${value} is less than the minimum allowed value of ${numericMin}`);
      }

      if (typeof numericMax === "number" && value > numericMax) {
        throw new Error(`Client supplied value of ${value} is greater than the maximum allowed value of ${numericMax}`);
      }

      if (this.props.validValues && !this.props.validValues.includes(value)) {
        throw new Error(`Client supplied value of ${value} is not in ${this.props.validValues.toString()}`);
      }

      if (this.props.validValueRanges && this.props.validValueRanges.length === 2) {
        if (value < this.props.validValueRanges[0]) {
          throw new Error(`Client supplied value of ${value} is less than the minimum allowed value of ${this.props.validValueRanges[0]}`);
        }
        if (value > this.props.validValueRanges[1]) {
          throw new Error(`Client supplied value of ${value} is greater than the maximum allowed value of ${this.props.validValueRanges[1]}`);
        }
      }

      return value;
    }
    case Formats.STRING: {
      if (typeof value !== "string") {
        throw new Error(`Client supplied invalid type for ${this.props.format}: "${value}" (${typeof value})`);
      }

      const maxLength = this.props.maxLen != null? this.props.maxLen: 64; // default is 64; max is 256 which is set in setProps
      if (value.length > maxLength) {
        throw new Error(`Client supplied value length of ${value.length} exceeds maximum length allowed of ${maxLength}`);
      }

      return value;
    }
    case Formats.DATA: {
      if (typeof value !== "string") {
        throw new Error(`Client supplied invalid type for ${this.props.format}: "${value}" (${typeof value})`);
      }

      // we don't validate base64 here

      const maxLength = this.props.maxDataLen != null? this.props.maxDataLen: 0x200000; // default is 0x200000
      if (value.length > maxLength) {
        throw new Error(`Client supplied value length of ${value.length} exceeds maximum length allowed of ${maxLength}`);
      }

      return value;
    }
    case Formats.TLV8:
      if (typeof value !== "string") {
        throw new Error(`Client supplied invalid type for ${this.props.format}: "${value}" (${typeof value})`);
      }

      return value;
    }

    return value;
  }

  /**
   * Checks if the value received from the API call is valid.
   * It adjusts the value where it makes sense, prints a warning where values may be rejected with an error
   * in the future and throws an error which can't be converted to a valid value.
   *
   * @param value - The value received from the API call
   * @param warningType - Optionally defines the warning type to use when raising a {@link CharacteristicEventTypes.CHARACTERISTIC_WARNING}.
   */
  private validateUserInput(value?: Nullable<CharacteristicValue>, warningType = CharacteristicWarningType.WARN_MESSAGE): Nullable<CharacteristicValue> {
    if (value === null) {
      if (this.UUID === Characteristic.Model.UUID || this.UUID === Characteristic.SerialNumber.UUID) { // mirrors the statement in case: Formats.STRING
        this.characteristicWarning("characteristic must have a non null value otherwise HomeKit will reject this accessory, ignoring new value",
          CharacteristicWarningType.ERROR_MESSAGE);
        return this.value; // don't change the value
      }

      if (this.props.format === Formats.DATA || this.props.format === Formats.TLV8) {
        return value; // TLV8 and DATA formats are allowed to have null as a value
      }

      /**
       * A short disclaimer here.
       * null is actually a perfectly valid value for characteristics to have.
       * The Home app will show "no response" for some characteristics for which it can't handle null
       * but ultimately its valid and the developers decision what the return.
       * BUT: out of history hap-nodejs did replace null with the last known value and thus
       * homebridge devs started to adopting this method as a way of not changing the value in a GET handler.
       * As an intermediate step we kept the behavior but added a warning printed to the console.
       * In a future update we will do the breaking change of return null below!
       */

      if (this.UUID.endsWith(BASE_UUID)) { // we have an apple defined characteristic (at least assuming nobody else uses the UUID namespace)
        if (this.UUID === Characteristic.ProgrammableSwitchEvent.UUID) {
          return value; // null is allowed as a value for ProgrammableSwitchEvent
        }

        this.characteristicWarning("characteristic was supplied illegal value: null! Home App will reject null for Apple defined characteristics",
          warningType);

        // if the value has been set previously, return it now, otherwise continue with validation to have a default value set.
        if (this.value !== null) {
          return this.value;
        }
      } else {
        // we currently allow null for any non-custom defined characteristics
        return value;
      }
    }

    switch (this.props.format) {
    case Formats.BOOL: {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value === 1;
      }
      if (typeof value === "string") {
        return value === "1" || value === "true";
      }

      this.characteristicWarning("characteristic value expected boolean and received " + typeof value, warningType);
      return false;
    }
    case Formats.INT:
    case Formats.FLOAT:
    case Formats.UINT8:
    case Formats.UINT16:
    case Formats.UINT32:
    case Formats.UINT64: {
      if (typeof value === "boolean") {
        value = value ? 1 : 0;
      }
      if (typeof value === "string") {
        value = this.props.format === Formats.FLOAT ? parseFloat(value) : parseInt(value, 10);
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
        this.characteristicWarning(`characteristic value expected valid finite number and received "${value}" (${typeof value})`, warningType);
        value = typeof this.value === "number" ? this.value : this.props.minValue || 0;
      }

      const numericMin = maxWithUndefined(this.props.minValue, numericLowerBound(this.props.format));
      const numericMax = minWithUndefined(this.props.maxValue, numericUpperBound(this.props.format));

      let stepValue: number | undefined = undefined;
      if (this.props.format === Formats.FLOAT) {
        stepValue = this.props.minStep;
      } else {
        stepValue = maxWithUndefined(this.props.minStep, 1);
      }

      if (stepValue != null && stepValue > 0) {
        const minValue = this.props.minValue != null ? this.props.minValue : 0;
        value = stepValue * Math.round((value - minValue) / stepValue) + minValue;
      }

      if (numericMin != null && value < numericMin) {
        this.characteristicWarning(`characteristic was supplied illegal value: number ${value} exceeded minimum of ${numericMin}`, warningType);
        value = numericMin;
      }
      if (numericMax != null && value > numericMax) {
        this.characteristicWarning(`characteristic was supplied illegal value: number ${value} exceeded maximum of ${numericMax}`, warningType);
        value = numericMax;
      }

      if (this.props.validValues && !this.props.validValues.includes(value)) {
        this.characteristicWarning(`characteristic value ${value} is not contained in valid values array`, warningType);
        return this.props.validValues.includes(this.value as number) ? this.value : (this.props.validValues[0] || 0);
      }

      if (this.props.validValueRanges && this.props.validValueRanges.length === 2) {
        if (value < this.props.validValueRanges[0]) {
          this.characteristicWarning(`characteristic was supplied illegal value: number ${value} not contained in valid value range of \
          ${this.props.validValueRanges}, supplying illegal values will throw errors in the future`, warningType);
          value = this.props.validValueRanges[0];
        } else if (value > this.props.validValueRanges[1]) {
          this.characteristicWarning(`characteristic was supplied illegal value: number ${value} not contained in valid value range of \
          ${this.props.validValueRanges}, supplying illegal values will throw errors in the future`, warningType);
          value = this.props.validValueRanges[1];
        }
      }

      return value;
    }
    case Formats.STRING: {
      if (typeof value === "number") {
        this.characteristicWarning("characteristic was supplied illegal value: number instead of string, " +
          "supplying illegal values will throw errors in the future", warningType);
        value = String(value);
      }
      if (typeof value !== "string") {
        this.characteristicWarning("characteristic value expected string and received " + (typeof value), warningType);
        value = typeof this.value === "string" ? this.value : value + "";
      }

      // mirrors the case value = null at the beginning
      if (value.length <= 1 && (this.UUID === Characteristic.Model.UUID || this.UUID === Characteristic.SerialNumber.UUID)) {
        this.characteristicWarning(`[${this.displayName}] characteristic must have a length of more than 1 character otherwise \
        HomeKit will reject this accessory, ignoring new value`, warningType);
        return this.value; // just return the current value
      }

      const maxLength = this.props.maxLen ?? 64; // default is 64 (max is 256 which is set in setProps)
      if (value.length > maxLength) {
        this.characteristicWarning(`characteristic was supplied illegal value: string '${value}' exceeded max length of ${maxLength}`, warningType);
        value = value.substring(0, maxLength);
      }

      return value;
    }
    case Formats.DATA:
      if (typeof value !== "string") {
        throw new Error("characteristic with DATA format must have string value");
      }

      if (this.props.maxDataLen != null && value.length > this.props.maxDataLen) {
        // can't cut it as we would basically set binary rubbish afterwards
        throw new Error("characteristic with DATA format exceeds specified maxDataLen");
      }
      return value;
    case Formats.TLV8:
      if (value === undefined) {
        this.characteristicWarning("characteristic was supplied illegal value: undefined", warningType);
        return this.value;
      }
      return value; // we trust that this is valid tlv8
    }

    // hopefully it shouldn't get to this point
    if (value === undefined) {
      this.characteristicWarning("characteristic was supplied illegal value: undefined", CharacteristicWarningType.ERROR_MESSAGE);
      return this.value;
    }

    return value;
  }

  /**
   * @private used to assign iid to characteristic
   */
  _assignID(identifierCache: IdentifierCache, accessoryName: string, serviceUUID: string, serviceSubtype?: string): void {
    // generate our IID based on our UUID
    this.iid = identifierCache.getIID(accessoryName, serviceUUID, serviceSubtype, this.UUID);
  }

  private characteristicWarning(message: string, type = CharacteristicWarningType.WARN_MESSAGE, stack = new Error().stack): void {
    this.emit(CharacteristicEventTypes.CHARACTERISTIC_WARNING, type, message, stack);
  }

  /**
   * @param event
   * @private
   */
  removeAllListeners(event?: string | symbol): this {
    if (!event) {
      this.removeOnGet();
      this.removeOnSet();
    }
    return super.removeAllListeners(event);
  }

  /**
   * @param characteristic
   * @private
   */
  replaceBy(characteristic: Characteristic): void {
    this.props = characteristic.props;
    this.updateValue(characteristic.value);

    const getListeners = characteristic.listeners(CharacteristicEventTypes.GET);
    if (getListeners.length) {
      // the callback can only be called once, so we remove all old listeners
      this.removeAllListeners(CharacteristicEventTypes.GET);
      // @ts-expect-error: force type
      getListeners.forEach(listener => this.addListener(CharacteristicEventTypes.GET, listener));
    }

    this.removeOnGet();
    if (characteristic.getHandler) {
      this.onGet(characteristic.getHandler);
    }

    const setListeners = characteristic.listeners(CharacteristicEventTypes.SET);
    if (setListeners.length) {
      // the callback can only be called once, so we remove all old listeners
      this.removeAllListeners(CharacteristicEventTypes.SET);
      // @ts-expect-error: force type
      setListeners.forEach(listener => this.addListener(CharacteristicEventTypes.SET, listener));
    }

    this.removeOnSet();
    if (characteristic.setHandler) {
      this.onSet(characteristic.setHandler);
    }
  }

  /**
   * Returns a JSON representation of this characteristic suitable for delivering to HAP clients.
   * @private used to generate response to /accessories query
   */
  async toHAP(connection: HAPConnection, contactGetHandlers = true): Promise<CharacteristicJsonObject> {
    const object = this.internalHAPRepresentation();

    if (!this.props.perms.includes(Perms.PAIRED_READ)) {
      object.value = undefined;
    } else if (this.UUID === Characteristic.ProgrammableSwitchEvent.UUID) {
      // special workaround for event only programmable switch event, which must always return null
      object.value = null;
    } else { // query the current value
      const value = contactGetHandlers
        ? await this.handleGetRequest(connection).catch(() => {
          const value = this.getDefaultValue();
          debug("[%s] Error getting value for characteristic on /accessories request. Returning default value instead: %s", this.displayName, `${value}`);
          return value; // use default value
        })
        : this.value;

      object.value = formatOutgoingCharacteristicValue(value, this.props);
    }

    return object;
  }

  /**
   * Returns a JSON representation of this characteristic without the value.
   * @private used to generate the config hash
   */
  internalHAPRepresentation(): CharacteristicJsonObject {
    assert(this.iid,"iid cannot be undefined for characteristic '" + this.displayName + "'");
    // TODO include the value for characteristics of the AccessoryInformation service
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
    };
  }

  /**
   * Serialize characteristic into json string.
   *
   * @param characteristic - Characteristic object.
   * @private used to store characteristic on disk
   */
  static serialize(characteristic: Characteristic): SerializedCharacteristic {
    let constructorName: string | undefined;
    if (characteristic.constructor.name !== "Characteristic") {
      constructorName = characteristic.constructor.name;
    }

    return {
      displayName: characteristic.displayName,
      UUID: characteristic.UUID,
      eventOnlyCharacteristic: characteristic.UUID === Characteristic.ProgrammableSwitchEvent.UUID, // support downgrades for now
      constructorName: constructorName,
      value: characteristic.value,
      props: clone({}, characteristic.props),
    };
  }

  /**
   * Deserialize characteristic from json string.
   *
   * @param json - Json string representing a characteristic.
   * @private used to recreate characteristic from disk
   */
  static deserialize(json: SerializedCharacteristic): Characteristic {
    let characteristic: Characteristic;

    if (json.constructorName && json.constructorName.charAt(0).toUpperCase() === json.constructorName.charAt(0)
      && Characteristic[json.constructorName as keyof (typeof Characteristic)]) { // MUST start with uppercase character and must exist on Characteristic object
      const constructor = Characteristic[json.constructorName as keyof (typeof Characteristic)] as { new(): Characteristic };
      characteristic = new constructor();
      characteristic.displayName = json.displayName;
      characteristic.setProps(json.props);
    } else {
      characteristic = new Characteristic(json.displayName, json.UUID, json.props);
    }

    characteristic.value = json.value;

    return characteristic;
  }

}

// We have a cyclic dependency problem. Within this file we have the definitions of "./definitions" as
// type imports only (in order to define the static properties). Setting those properties is done outside
// this file, within the definition files. Therefore, we import it at the end of this file. Seems weird, but is important.
import "./definitions/CharacteristicDefinitions";
