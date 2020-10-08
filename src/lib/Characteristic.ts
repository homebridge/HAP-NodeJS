import assert from "assert";
import createDebug from "debug";
import { EventEmitter } from "events";
import { CharacteristicJsonObject } from "../internal-types";
import { CharacteristicValue, Nullable, VoidCallback, } from '../types';
import * as HomeKitTypes from './gen';
import { HAPStatus } from "./HAPServer";
import { IdentifierCache } from './model/IdentifierCache';
import { clone } from "./util/clone";
import { HAPConnection } from "./util/eventedhttp";
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
  validValueRanges?: [number, number];
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

  static AccessControlLevel: typeof HomeKitTypes.Generated.AccessControlLevel;
  static AccessoryFlags: typeof HomeKitTypes.Generated.AccessoryFlags;
  static AccessoryIdentifier: typeof HomeKitTypes.Bridged.AccessoryIdentifier;
  static Active: typeof HomeKitTypes.Generated.Active;
  static ActiveIdentifier: typeof HomeKitTypes.TV.ActiveIdentifier;
  static AdministratorOnlyAccess: typeof HomeKitTypes.Generated.AdministratorOnlyAccess;
  static AirParticulateDensity: typeof HomeKitTypes.Generated.AirParticulateDensity;
  static AirParticulateSize: typeof HomeKitTypes.Generated.AirParticulateSize;
  static AirQuality: typeof HomeKitTypes.Generated.AirQuality;
  static AppMatchingIdentifier: typeof HomeKitTypes.Bridged.AppMatchingIdentifier;
  static AudioFeedback: typeof HomeKitTypes.Generated.AudioFeedback;
  static BatteryLevel: typeof HomeKitTypes.Generated.BatteryLevel;
  static Brightness: typeof HomeKitTypes.Generated.Brightness;
  static ButtonEvent: typeof HomeKitTypes.Remote.ButtonEvent;
  static CarbonDioxideDetected: typeof HomeKitTypes.Generated.CarbonDioxideDetected;
  static CarbonDioxideLevel: typeof HomeKitTypes.Generated.CarbonDioxideLevel;
  static CarbonDioxidePeakLevel: typeof HomeKitTypes.Generated.CarbonDioxidePeakLevel;
  static CarbonMonoxideDetected: typeof HomeKitTypes.Generated.CarbonMonoxideDetected;
  static CarbonMonoxideLevel: typeof HomeKitTypes.Generated.CarbonMonoxideLevel;
  static CarbonMonoxidePeakLevel: typeof HomeKitTypes.Generated.CarbonMonoxidePeakLevel;
  static Category: typeof HomeKitTypes.Bridged.Category;
  static ChargingState: typeof HomeKitTypes.Generated.ChargingState;
  static ClosedCaptions: typeof HomeKitTypes.TV.ClosedCaptions;
  static ColorTemperature: typeof HomeKitTypes.Generated.ColorTemperature;
  static ConfigureBridgedAccessory: typeof HomeKitTypes.Bridged.ConfigureBridgedAccessory;
  static ConfigureBridgedAccessoryStatus: typeof HomeKitTypes.Bridged.ConfigureBridgedAccessoryStatus;
  static ConfiguredName: typeof HomeKitTypes.TV.ConfiguredName;
  static ContactSensorState: typeof HomeKitTypes.Generated.ContactSensorState;
  static CoolingThresholdTemperature: typeof HomeKitTypes.Generated.CoolingThresholdTemperature;
  static CurrentAirPurifierState: typeof HomeKitTypes.Generated.CurrentAirPurifierState;
  static CurrentAmbientLightLevel: typeof HomeKitTypes.Generated.CurrentAmbientLightLevel;
  static CurrentDoorState: typeof HomeKitTypes.Generated.CurrentDoorState;
  static CurrentFanState: typeof HomeKitTypes.Generated.CurrentFanState;
  static CurrentHeaterCoolerState: typeof HomeKitTypes.Generated.CurrentHeaterCoolerState;
  static CurrentHeatingCoolingState: typeof HomeKitTypes.Generated.CurrentHeatingCoolingState;
  static CurrentHorizontalTiltAngle: typeof HomeKitTypes.Generated.CurrentHorizontalTiltAngle;
  static CurrentHumidifierDehumidifierState: typeof HomeKitTypes.Generated.CurrentHumidifierDehumidifierState;
  static CurrentMediaState: typeof HomeKitTypes.TV.CurrentMediaState;
  static CurrentPosition: typeof HomeKitTypes.Generated.CurrentPosition;
  static CurrentRelativeHumidity: typeof HomeKitTypes.Generated.CurrentRelativeHumidity;
  static CurrentSlatState: typeof HomeKitTypes.Generated.CurrentSlatState;
  static CurrentTemperature: typeof HomeKitTypes.Generated.CurrentTemperature;
  static CurrentTiltAngle: typeof HomeKitTypes.Generated.CurrentTiltAngle;
  static CurrentTime: typeof HomeKitTypes.Bridged.CurrentTime;
  static CurrentVerticalTiltAngle: typeof HomeKitTypes.Generated.CurrentVerticalTiltAngle;
  static CurrentVisibilityState: typeof HomeKitTypes.TV.CurrentVisibilityState;
  static DayoftheWeek: typeof HomeKitTypes.Bridged.DayoftheWeek;
  static DigitalZoom: typeof HomeKitTypes.Generated.DigitalZoom;
  static DiscoverBridgedAccessories: typeof HomeKitTypes.Bridged.DiscoverBridgedAccessories;
  static DiscoveredBridgedAccessories: typeof HomeKitTypes.Bridged.DiscoveredBridgedAccessories;
  static DisplayOrder: typeof HomeKitTypes.TV.DisplayOrder;
  static FilterChangeIndication: typeof HomeKitTypes.Generated.FilterChangeIndication;
  static FilterLifeLevel: typeof HomeKitTypes.Generated.FilterLifeLevel;
  static FirmwareRevision: typeof HomeKitTypes.Generated.FirmwareRevision;
  static HardwareRevision: typeof HomeKitTypes.Generated.HardwareRevision;
  static HeatingThresholdTemperature: typeof HomeKitTypes.Generated.HeatingThresholdTemperature;
  static HoldPosition: typeof HomeKitTypes.Generated.HoldPosition;
  static Hue: typeof HomeKitTypes.Generated.Hue;
  static Identifier: typeof HomeKitTypes.TV.Identifier;
  static Identify: typeof HomeKitTypes.Generated.Identify;
  static ImageMirroring: typeof HomeKitTypes.Generated.ImageMirroring;
  static ImageRotation: typeof HomeKitTypes.Generated.ImageRotation;
  static InUse: typeof HomeKitTypes.Generated.InUse;
  static InputDeviceType: typeof HomeKitTypes.TV.InputDeviceType;
  static InputSourceType: typeof HomeKitTypes.TV.InputSourceType;
  static IsConfigured: typeof HomeKitTypes.Generated.IsConfigured;
  static LeakDetected: typeof HomeKitTypes.Generated.LeakDetected;
  static LinkQuality: typeof HomeKitTypes.Bridged.LinkQuality;
  static LockControlPoint: typeof HomeKitTypes.Generated.LockControlPoint;
  static LockCurrentState: typeof HomeKitTypes.Generated.LockCurrentState;
  static LockLastKnownAction: typeof HomeKitTypes.Generated.LockLastKnownAction;
  static LockManagementAutoSecurityTimeout: typeof HomeKitTypes.Generated.LockManagementAutoSecurityTimeout;
  static LockPhysicalControls: typeof HomeKitTypes.Generated.LockPhysicalControls;
  static LockTargetState: typeof HomeKitTypes.Generated.LockTargetState;
  static Logs: typeof HomeKitTypes.Generated.Logs;
  static Manufacturer: typeof HomeKitTypes.Generated.Manufacturer;
  static Model: typeof HomeKitTypes.Generated.Model;
  static MotionDetected: typeof HomeKitTypes.Generated.MotionDetected;
  static Mute: typeof HomeKitTypes.Generated.Mute;
  static Name: typeof HomeKitTypes.Generated.Name;
  static NightVision: typeof HomeKitTypes.Generated.NightVision;
  static NitrogenDioxideDensity: typeof HomeKitTypes.Generated.NitrogenDioxideDensity;
  static ObstructionDetected: typeof HomeKitTypes.Generated.ObstructionDetected;
  static OccupancyDetected: typeof HomeKitTypes.Generated.OccupancyDetected;
  static On: typeof HomeKitTypes.Generated.On;
  static OpticalZoom: typeof HomeKitTypes.Generated.OpticalZoom;
  static OutletInUse: typeof HomeKitTypes.Generated.OutletInUse;
  static OzoneDensity: typeof HomeKitTypes.Generated.OzoneDensity;
  static PM10Density: typeof HomeKitTypes.Generated.PM10Density;
  static PM2_5Density: typeof HomeKitTypes.Generated.PM2_5Density;
  static PairSetup: typeof HomeKitTypes.Generated.PairSetup;
  static PairVerify: typeof HomeKitTypes.Generated.PairVerify;
  static PairingFeatures: typeof HomeKitTypes.Generated.PairingFeatures;
  static PairingPairings: typeof HomeKitTypes.Generated.PairingPairings;
  static PasswordSetting: typeof HomeKitTypes.Generated.PasswordSetting;
  static PictureMode: typeof HomeKitTypes.TV.PictureMode;
  static PositionState: typeof HomeKitTypes.Generated.PositionState;
  static PowerModeSelection: typeof HomeKitTypes.TV.PowerModeSelection;
  static ProgramMode: typeof HomeKitTypes.Generated.ProgramMode;
  static ProgrammableSwitchEvent: typeof HomeKitTypes.Generated.ProgrammableSwitchEvent;
  static ProductData: typeof HomeKitTypes.Generated.ProductData;
  static ProgrammableSwitchOutputState: typeof HomeKitTypes.Bridged.ProgrammableSwitchOutputState;
  static Reachable: typeof HomeKitTypes.Bridged.Reachable;
  static RelativeHumidityDehumidifierThreshold: typeof HomeKitTypes.Generated.RelativeHumidityDehumidifierThreshold;
  static RelativeHumidityHumidifierThreshold: typeof HomeKitTypes.Generated.RelativeHumidityHumidifierThreshold;
  static RelayControlPoint: typeof HomeKitTypes.Bridged.RelayControlPoint;
  static RelayEnabled: typeof HomeKitTypes.Bridged.RelayEnabled;
  static RelayState: typeof HomeKitTypes.Bridged.RelayState;
  static RemainingDuration: typeof HomeKitTypes.Generated.RemainingDuration;
  static RemoteKey: typeof HomeKitTypes.TV.RemoteKey;
  static ResetFilterIndication: typeof HomeKitTypes.Generated.ResetFilterIndication;
  static RotationDirection: typeof HomeKitTypes.Generated.RotationDirection;
  static RotationSpeed: typeof HomeKitTypes.Generated.RotationSpeed;
  static Saturation: typeof HomeKitTypes.Generated.Saturation;
  static SecuritySystemAlarmType: typeof HomeKitTypes.Generated.SecuritySystemAlarmType;
  static SecuritySystemCurrentState: typeof HomeKitTypes.Generated.SecuritySystemCurrentState;
  static SecuritySystemTargetState: typeof HomeKitTypes.Generated.SecuritySystemTargetState;
  static SelectedAudioStreamConfiguration: typeof HomeKitTypes.Remote.SelectedAudioStreamConfiguration;
  static SelectedRTPStreamConfiguration: typeof HomeKitTypes.Generated.SelectedRTPStreamConfiguration;
  static SerialNumber: typeof HomeKitTypes.Generated.SerialNumber;
  static ServiceLabelIndex: typeof HomeKitTypes.Generated.ServiceLabelIndex;
  static ServiceLabelNamespace: typeof HomeKitTypes.Generated.ServiceLabelNamespace;
  static SetDuration: typeof HomeKitTypes.Generated.SetDuration;
  static SetupDataStreamTransport: typeof HomeKitTypes.DataStream.SetupDataStreamTransport;
  static SetupEndpoints: typeof HomeKitTypes.Generated.SetupEndpoints;
  static SiriInputType: typeof HomeKitTypes.Remote.SiriInputType;
  static SlatType: typeof HomeKitTypes.Generated.SlatType;
  static SleepDiscoveryMode: typeof HomeKitTypes.TV.SleepDiscoveryMode;
  static SmokeDetected: typeof HomeKitTypes.Generated.SmokeDetected;
  static SoftwareRevision: typeof HomeKitTypes.Bridged.SoftwareRevision;
  static StatusActive: typeof HomeKitTypes.Generated.StatusActive;
  static StatusFault: typeof HomeKitTypes.Generated.StatusFault;
  static StatusJammed: typeof HomeKitTypes.Generated.StatusJammed;
  static StatusLowBattery: typeof HomeKitTypes.Generated.StatusLowBattery;
  static StatusTampered: typeof HomeKitTypes.Generated.StatusTampered;
  static StreamingStatus: typeof HomeKitTypes.Generated.StreamingStatus;
  static SulphurDioxideDensity: typeof HomeKitTypes.Generated.SulphurDioxideDensity;
  static SupportedAudioStreamConfiguration: typeof HomeKitTypes.Generated.SupportedAudioStreamConfiguration;
  static SupportedDataStreamTransportConfiguration: typeof HomeKitTypes.DataStream.SupportedDataStreamTransportConfiguration;
  static SupportedRTPConfiguration: typeof HomeKitTypes.Generated.SupportedRTPConfiguration;
  static SupportedVideoStreamConfiguration: typeof HomeKitTypes.Generated.SupportedVideoStreamConfiguration;
  static SwingMode: typeof HomeKitTypes.Generated.SwingMode;
  static TargetAirPurifierState: typeof HomeKitTypes.Generated.TargetAirPurifierState;
  static TargetAirQuality: typeof HomeKitTypes.Generated.TargetAirQuality;
  static TargetControlList: typeof HomeKitTypes.Remote.TargetControlList;
  static TargetControlSupportedConfiguration: typeof HomeKitTypes.Remote.TargetControlSupportedConfiguration;
  static TargetDoorState: typeof HomeKitTypes.Generated.TargetDoorState;
  static TargetFanState: typeof HomeKitTypes.Generated.TargetFanState;
  static TargetHeaterCoolerState: typeof HomeKitTypes.Generated.TargetHeaterCoolerState;
  static TargetHeatingCoolingState: typeof HomeKitTypes.Generated.TargetHeatingCoolingState;
  static TargetHorizontalTiltAngle: typeof HomeKitTypes.Generated.TargetHorizontalTiltAngle;
  static TargetHumidifierDehumidifierState: typeof HomeKitTypes.Generated.TargetHumidifierDehumidifierState;
  static TargetMediaState: typeof HomeKitTypes.TV.TargetMediaState;
  static TargetPosition: typeof HomeKitTypes.Generated.TargetPosition;
  static TargetRelativeHumidity: typeof HomeKitTypes.Generated.TargetRelativeHumidity;
  static TargetSlatState: typeof HomeKitTypes.Generated.TargetSlatState;
  static TargetTemperature: typeof HomeKitTypes.Generated.TargetTemperature;
  static TargetTiltAngle: typeof HomeKitTypes.Generated.TargetTiltAngle;
  static TargetVerticalTiltAngle: typeof HomeKitTypes.Generated.TargetVerticalTiltAngle;
  static TargetVisibilityState: typeof HomeKitTypes.TV.TargetVisibilityState;
  static TemperatureDisplayUnits: typeof HomeKitTypes.Generated.TemperatureDisplayUnits;
  static TimeUpdate: typeof HomeKitTypes.Bridged.TimeUpdate;
  static TunnelConnectionTimeout: typeof HomeKitTypes.Bridged.TunnelConnectionTimeout;
  static TunneledAccessoryAdvertising: typeof HomeKitTypes.Bridged.TunneledAccessoryAdvertising;
  static TunneledAccessoryConnected: typeof HomeKitTypes.Bridged.TunneledAccessoryConnected;
  static TunneledAccessoryStateNumber: typeof HomeKitTypes.Bridged.TunneledAccessoryStateNumber;
  static VOCDensity: typeof HomeKitTypes.Generated.VOCDensity;
  static ValveType: typeof HomeKitTypes.Generated.ValveType;
  static Version: typeof HomeKitTypes.Generated.Version;
  static Volume: typeof HomeKitTypes.Generated.Volume;
  static VolumeControlType: typeof HomeKitTypes.TV.VolumeControlType;
  static VolumeSelector: typeof HomeKitTypes.TV.VolumeSelector;
  static WaterLevel: typeof HomeKitTypes.Generated.WaterLevel;
  static ManuallyDisabled: typeof HomeKitTypes.Generated.ManuallyDisabled;
  static ThirdPartyCameraActive: typeof HomeKitTypes.Generated.ThirdPartyCameraActive;
  static PeriodicSnapshotsActive: typeof HomeKitTypes.Generated.PeriodicSnapshotsActive;
  static EventSnapshotsActive: typeof HomeKitTypes.Generated.EventSnapshotsActive;
  static HomeKitCameraActive: typeof HomeKitTypes.Generated.HomeKitCameraActive;
  static RecordingAudioActive: typeof HomeKitTypes.Generated.RecordingAudioActive;
  static SupportedCameraRecordingConfiguration: typeof HomeKitTypes.Generated.SupportedCameraRecordingConfiguration;
  static SupportedVideoRecordingConfiguration: typeof HomeKitTypes.Generated.SupportedVideoRecordingConfiguration;
  static SupportedAudioRecordingConfiguration: typeof HomeKitTypes.Generated.SupportedAudioRecordingConfiguration;
  static SelectedCameraRecordingConfiguration: typeof HomeKitTypes.Generated.SelectedCameraRecordingConfiguration;
  static CameraOperatingModeIndicator: typeof HomeKitTypes.Generated.CameraOperatingModeIndicator;
  static DiagonalFieldOfView: typeof HomeKitTypes.Generated.DiagonalFieldOfView;
  static NetworkClientProfileControl: typeof HomeKitTypes.Generated.NetworkClientProfileControl;
  static NetworkClientStatusControl: typeof HomeKitTypes.Generated.NetworkClientStatusControl;
  static RouterStatus: typeof HomeKitTypes.Generated.RouterStatus;
  static SupportedRouterConfiguration: typeof HomeKitTypes.Generated.SupportedRouterConfiguration;
  static WANConfigurationList: typeof HomeKitTypes.Generated.WANConfigurationList;
  static WANStatusList: typeof HomeKitTypes.Generated.WANStatusList;
  static ManagedNetworkEnable: typeof HomeKitTypes.Generated.ManagedNetworkEnable;
  static NetworkAccessViolationControl: typeof HomeKitTypes.Generated.NetworkAccessViolationControl;
  static WiFiSatelliteStatus: typeof HomeKitTypes.Generated.WiFiSatelliteStatus;
  static WakeConfiguration: typeof HomeKitTypes.Generated.WakeConfiguration;
  static SupportedTransferTransportConfiguration: typeof HomeKitTypes.Generated.SupportedTransferTransportConfiguration;
  static SetupTransferTransport: typeof HomeKitTypes.Generated.SetupTransferTransport;


  static ActivityInterval: typeof HomeKitTypes.Generated.ActivityInterval;
  static CCAEnergyDetectThreshold: typeof HomeKitTypes.Generated.CCAEnergyDetectThreshold;
  static CCASignalDetectThreshold: typeof HomeKitTypes.Generated.CCASignalDetectThreshold;
  static CharacteristicValueTransitionControl: typeof HomeKitTypes.Generated.CharacteristicValueTransitionControl;
  static SupportedCharacteristicValueTransitionConfiguration: typeof HomeKitTypes.Generated.SupportedCharacteristicValueTransitionConfiguration;
  static CharacteristicValueActiveTransitionCount: typeof HomeKitTypes.Generated.CharacteristicValueActiveTransitionCount;
  static CurrentTransport: typeof HomeKitTypes.Generated.CurrentTransport;
  static DataStreamHAPTransport: typeof HomeKitTypes.Generated.DataStreamHAPTransport;
  static DataStreamHAPTransportInterrupt: typeof HomeKitTypes.Generated.DataStreamHAPTransportInterrupt;
  static EventRetransmissionMaximum: typeof HomeKitTypes.Generated.EventRetransmissionMaximum;
  static EventTransmissionCounters: typeof HomeKitTypes.Generated.EventTransmissionCounters;
  static HeartBeat: typeof HomeKitTypes.Generated.HeartBeat;
  static MACRetransmissionMaximum: typeof HomeKitTypes.Generated.MACRetransmissionMaximum;
  static MACTransmissionCounters: typeof HomeKitTypes.Generated.MACTransmissionCounters;
  static OperatingStateResponse: typeof HomeKitTypes.Generated.OperatingStateResponse;
  static Ping: typeof HomeKitTypes.Generated.Ping;
  static ReceiverSensitivity: typeof HomeKitTypes.Generated.ReceiverSensitivity;
  static ReceivedSignalStrengthIndication: typeof HomeKitTypes.Generated.ReceivedSignalStrengthIndication;
  static SleepInterval: typeof HomeKitTypes.Generated.SleepInterval;
  static SignalToNoiseRatio: typeof HomeKitTypes.Generated.SignalToNoiseRatio;
  static SupportedDiagnosticsSnapshot: typeof HomeKitTypes.Generated.SupportedDiagnosticsSnapshot;
  static TransmitPower: typeof HomeKitTypes.Generated.TransmitPower;
  static TransmitPowerMaximum: typeof HomeKitTypes.Generated.TransmitPowerMaximum;
  static VideoAnalysisActive: typeof HomeKitTypes.Generated.VideoAnalysisActive;
  static WiFiCapabilities: typeof HomeKitTypes.Generated.WiFiCapabilities;
  static WiFiConfigurationControl: typeof HomeKitTypes.Generated.WiFiConfigurationControl;

  // NOTICE: when adding/changing properties, remember to possibly adjust the serialize/deserialize functions
  public displayName: string;
  public UUID: string;
  iid: Nullable<number> = null;
  value: Nullable<CharacteristicValue> = null;
  status: HAPStatus = HAPStatus.SUCCESS;
  props: CharacteristicProps;

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
      assert(props.perms, "characteristic prop perms cannot be empty array");
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
  handleGetRequest(connection?: HAPConnection, context?: any): Promise<Nullable<CharacteristicValue>> {
    if (!this.props.perms.includes(Perms.PAIRED_READ)) { // check if we are allowed to read from this characteristic
      return Promise.reject(HAPStatus.WRITE_ONLY_CHARACTERISTIC);
    }

    if (this.UUID === Characteristic.ProgrammableSwitchEvent.UUID) {
      // special workaround for event only programmable switch event, which must always return null
      return Promise.resolve(null);
    }

    if (this.listeners(CharacteristicEventTypes.GET).length === 0) {
      return this.status? Promise.reject(this.status): Promise.resolve(this.value);
    }

    return new Promise((resolve, reject) => {
      try {
        this.emit(CharacteristicEventTypes.GET, once((status?: Error | HAPStatus | null, value?: Nullable<CharacteristicValue>) => {
          if (status) {
            if (typeof status === "number") {
              this.status = status;
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
  handleSetRequest(value: CharacteristicValue, connection?: HAPConnection, context?: any): Promise<CharacteristicValue | void> {
    this.status = HAPStatus.SUCCESS;

    if (!this.validClientSuppliedValue(value)) {
      return Promise.reject(HAPStatus.INVALID_VALUE_IN_REQUEST);
    }

    if (isNumericFormat(this.props.format)) {
      value = this.roundNumericValue(value as number);
    }

    const oldValue = this.value;

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
        return "";
      case Formats.DATA:
        return null; // who knows!
      case Formats.TLV8:
        return null; // who knows!
      case Formats.DICTIONARY:
        return {};
      case Formats.ARRAY:
        return [];
      default:
        return this.props.minValue || 0;
    }
  }

  private roundNumericValue(value: number): number {
    if (!this.props.minStep) {
      return Math.round(value); // round to 0 decimal places
    }
    const base = this.props.minValue || 0;
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
      console.warn(`[${this.displayName}] characteristic was supplied illegal value: undefined. Supplying illegal values will throw errors in the future!`);
      return this.getDefaultValue();
    } else if (value === null) {
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

        const maxLength = this.props.maxLen != null? this.props.maxLen: 64; // default is 64 (max is 256 which is set in setProps)
        if (value.length > maxLength) {
          console.warn(`[${this.displayName}] characteristic was supplied illegal value: string '${value}' exceeded max length of ${maxLength}. Supplying illegal values will throw errors in the future!`);
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
        console.warn(`[${this.displayName}] characteristic was supplied illegal value: number ${value} exceeded minimum of ${numericMin}. Supplying illegal values will throw errors in the future!`);
        value = numericMin;
      }
      if (numericMax != null && value > numericMax) {
        console.warn(`[${this.displayName}] characteristic was supplied illegal value: number ${value} exceeded maximum of ${numericMax}. Supplying illegal values will throw errors in the future!`);
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
      type: toShortForm(this.UUID, HomeKitTypes.BASE_UUID),
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
