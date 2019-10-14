import Decimal from 'decimal.js';
import bufferShim from 'buffer-shims';

import { once } from './util/once';
import { IdentifierCache } from './model/IdentifierCache';
import {
  CharacteristicChange,
  CharacteristicValue,
  HapCharacteristic,
  Nullable,
  ToHAPOptions,
  VoidCallback,
} from '../types';
import { EventEmitter } from './EventEmitter';
import * as HomeKitTypes from './gen';

// Known HomeKit formats
export enum Formats {
  BOOL = 'bool',
  INT = 'int',
  FLOAT = 'float',
  STRING = 'string',
  UINT8 = 'uint8',
  UINT16 = 'uint16',
  UINT32 = 'uint32',
  UINT64 = 'uint64',
  DATA = 'data',
  TLV8 = 'tlv8',
  ARRAY = 'array', //Not in HAP Spec
  DICTIONARY = 'dict' //Not in HAP Spec
}

// Known HomeKit unit types
export enum Units {
  // HomeKit only defines Celsius, for Fahrenheit, it requires iOS app to do the conversion.
  CELSIUS = 'celsius',
  PERCENTAGE = 'percentage',
  ARC_DEGREE = 'arcdegrees',
  LUX = 'lux',
  SECONDS = 'seconds'
}

// Known HomeKit permission types
export enum Perms {
  READ = 'pr', //Kept for backwards compatability
  PAIRED_READ = 'pr', //Added to match HAP's terminology
  WRITE = 'pw', //Kept for backwards compatability
  PAIRED_WRITE = 'pw', //Added to match HAP's terminology
  NOTIFY = 'ev', //Kept for backwards compatability
  EVENTS = 'ev', //Added to match HAP's terminology
  ADDITIONAL_AUTHORIZATION = 'aa',
  TIMED_WRITE = 'tw', //Not currently supported by IP
  HIDDEN = 'hd',
  WRITE_RESPONSE = 'wr'
}

export interface CharacteristicProps {
  format: Formats;
  unit?: Units;
  perms: Perms[];
  ev?: boolean;
  description?: string;
  minValue?: number;
  maxValue?: number;
  minStep?: number;
  maxLen?: number;
  maxDataLen?: number;
  validValues?: number[];
  validValueRanges?: [number, number];
}

export enum Access {
  READ = 0x00,
  WRITE = 0x01,
  NOTIFY = 0x02
}

export enum CharacteristicEventTypes {
  GET = "get",
  SET = "set",
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",
  CHANGE = "change",
}

export type CharacteristicGetCallback<T = Nullable<CharacteristicValue>> = (error?: Error | null , value?: T) => void
export type CharacteristicSetCallback = (error?: Error | null, value?: CharacteristicValue) => void

type Events = {
  [CharacteristicEventTypes.CHANGE]: (change: CharacteristicChange) => void;
  [CharacteristicEventTypes.GET]: (cb: CharacteristicGetCallback, context?: any, connectionID?: string) => void;
  [CharacteristicEventTypes.SET]: (value: CharacteristicValue, cb: CharacteristicSetCallback, context?: any, connectionID?: string) => void;
  [CharacteristicEventTypes.SUBSCRIBE]: VoidCallback;
  [CharacteristicEventTypes.UNSUBSCRIBE]: VoidCallback;
}

/**
 * @deprecated Use CharacteristicEventTypes instead
 */
export type EventCharacteristic = CharacteristicEventTypes.GET | CharacteristicEventTypes.SET | CharacteristicEventTypes.SUBSCRIBE | CharacteristicEventTypes.UNSUBSCRIBE | CharacteristicEventTypes.CHANGE;

/**
 * Characteristic represents a particular typed variable that can be assigned to a Service. For instance, a
 * "Hue" Characteristic might store a 'float' value of type 'arcdegrees'. You could add the Hue Characteristic
 * to a Service in order to store that value. A particular Characteristic is distinguished from others by its
 * UUID. HomeKit provides a set of known Characteristic UUIDs defined in HomeKit.ts along with a
 * corresponding concrete subclass.
 *
 * You can also define custom Characteristics by providing your own UUID. Custom Characteristics can be added
 * to any native or custom Services, but Siri will likely not be able to work with these.
 *
 * Note that you can get the "value" of a Characteristic by accessing the "value" property directly, but this
 * is really a "cached value". If you want to fetch the latest value, which may involve doing some work, then
 * call getValue().
 *
 * @event 'get' => function(callback(err, newValue), context) { }
 *        Emitted when someone calls getValue() on this Characteristic and desires the latest non-cached
 *        value. If there are any listeners to this event, one of them MUST call the callback in order
 *        for the value to ever be delivered. The `context` object is whatever was passed in by the initiator
 *        of this event (for instance whomever called `getValue`).
 *
 * @event 'set' => function(newValue, callback(err), context) { }
 *        Emitted when someone calls setValue() on this Characteristic with a desired new value. If there
 *        are any listeners to this event, one of them MUST call the callback in order for this.value to
 *        actually be set. The `context` object is whatever was passed in by the initiator of this change
 *        (for instance, whomever called `setValue`).
 *
 * @event 'change' => function({ oldValue, newValue, context }) { }
 *        Emitted after a change in our value has occurred. The new value will also be immediately accessible
 *        in this.value. The event object contains the new value as well as the context object originally
 *        passed in by the initiator of this change (if known).
 */
export class Characteristic extends EventEmitter<Events> {

  static Formats = Formats;
  static Units = Units;
  static Perms = Perms;

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
  /**
   * @deprecated Removed in iOS 11. Use ServiceLabelIndex instead.
   */
  static LabelIndex: typeof HomeKitTypes.Generated.ServiceLabelIndex;
  /**
   * @deprecated Removed in iOS 11. Use ServiceLabelNamespace instead.
   */
  static LabelNamespace: typeof HomeKitTypes.Generated.ServiceLabelNamespace;
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
  static PictureMode: typeof HomeKitTypes.TV.PictureMode;
  static PositionState: typeof HomeKitTypes.Generated.PositionState;
  static PowerModeSelection: typeof HomeKitTypes.TV.PowerModeSelection;
  static ProgramMode: typeof HomeKitTypes.Generated.ProgramMode;
  static ProgrammableSwitchEvent: typeof HomeKitTypes.Generated.ProgrammableSwitchEvent;
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
  /**
   * @deprecated Removed in iOS 11. Use SelectedRTPStreamConfiguration instead.
   */
  static SelectedStreamConfiguration: typeof HomeKitTypes.Generated.SelectedRTPStreamConfiguration;
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
  static Version: typeof HomeKitTypes.Bridged.Version;
  static Volume: typeof HomeKitTypes.Generated.Volume;
  static VolumeControlType: typeof HomeKitTypes.TV.VolumeControlType;
  static VolumeSelector: typeof HomeKitTypes.TV.VolumeSelector;
  static WaterLevel: typeof HomeKitTypes.Generated.WaterLevel;

  iid: Nullable<number> = null;
  value: Nullable<CharacteristicValue> = null;
  status: Nullable<Error> = null;
  eventOnlyCharacteristic: boolean = false;
  accessRestrictedToAdmins: Access[] = [];
  props: CharacteristicProps;
  subscriptions: number = 0;

  'valid-values': number[];
  'valid-values-range': [number, number];

  constructor(public displayName?: string, public UUID?: string, props?: CharacteristicProps) {
    super();
    // @ts-ignore
    this.props = props || {
      format: null,
      unit: null,
      minValue: null,
      maxValue: null,
      minStep: null,
      perms: []
    };
  }

  /**
   * Copies the given properties to our props member variable,
   * and returns 'this' for chaining.
   *
   * @param 'props' {
   *   format: <one of Formats>,
   *   unit: <one of Characteristic.Units>,
   *   perms: array of [Characteristic.Perms] like [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
   *   ev: <Event Notifications Enabled Boolean>, (Optional)
   *   description: <String of description>, (Optional)
   *   minValue: <minimum value for numeric characteristics>, (Optional)
   *   maxValue: <maximum value for numeric characteristics>, (Optional)
   *   minStep: <smallest allowed increment for numeric characteristics>, (Optional)
   *   maxLen: <max length of string up to 256>, (Optional default: 64)
   *   maxDataLen: <max length of data>, (Optional default: 2097152)
   *   valid-values: <array of numbers>, (Optional)
   *   valid-values-range: <array of two numbers for start and end range> (Optional)
   * }
   */
  setProps = (props: CharacteristicProps) => {
    for (var key in (props || {}))
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        // @ts-ignore
        this.props[key] = props[key];
      }
    return this;
  }

  subscribe = () => {
    if (this.subscriptions === 0) {
      this.emit(CharacteristicEventTypes.SUBSCRIBE);
    }
    this.subscriptions++;
  }

  unsubscribe = () => {
    var wasOne = this.subscriptions === 1;
    this.subscriptions--;
    this.subscriptions = Math.max(this.subscriptions, 0);
    if (wasOne) {
      this.emit(CharacteristicEventTypes.UNSUBSCRIBE);
    }
  }

  getValue = (callback?: CharacteristicGetCallback, context?: any, connectionID?: string) => {
    // Handle special event only characteristics.
    if (this.eventOnlyCharacteristic === true) {
      if (callback) {
        callback(null, null);
      }
      return;
    }
    if (this.listeners(CharacteristicEventTypes.GET).length > 0) {
      // allow a listener to handle the fetching of this value, and wait for completion
      this.emit(CharacteristicEventTypes.GET, once((err: Error, newValue: Nullable<CharacteristicValue>) => {
        this.status = err;
        if (err) {
          // pass the error along to our callback
          if (callback)
            callback(err);
        } else {
          newValue = this.validateValue(newValue); //validateValue returns a value that has be cooerced into a valid value.
          if (newValue === undefined || newValue === null)
            newValue = this.getDefaultValue();
          // getting the value was a success; we can pass it along and also update our cached value
          var oldValue = this.value;
          this.value = newValue;
          if (callback)
            callback(null, newValue);
          // emit a change event if necessary
          if (oldValue !== newValue)
            this.emit(CharacteristicEventTypes.CHANGE, {oldValue: oldValue, newValue: newValue, context: context});
        }
      }), context, connectionID);
    } else {
      // no one is listening to the 'get' event, so just return the cached value
      if (callback)
        callback(this.status, this.value);
    }
  }

  validateValue = (newValue: Nullable<CharacteristicValue>): Nullable<CharacteristicValue> => {
    let isNumericType = false;
    let minValue_resolved: number | undefined = 0;
    let maxValue_resolved: number | undefined = 0;
    let minStep_resolved = undefined;
    let stepDecimals = 0;
    switch (this.props.format) {
      case Formats.INT:
        minStep_resolved = 1;
        minValue_resolved = -2147483648;
        maxValue_resolved = 2147483647;
        isNumericType = true;
        break;
      case Formats.FLOAT:
        minStep_resolved = undefined;
        minValue_resolved = undefined;
        maxValue_resolved = undefined;
        isNumericType = true;
        break;
      case Formats.UINT8:
        minStep_resolved = 1;
        minValue_resolved = 0;
        maxValue_resolved = 255;
        isNumericType = true;
        break;
      case Formats.UINT16:
        minStep_resolved = 1;
        minValue_resolved = 0;
        maxValue_resolved = 65535;
        isNumericType = true;
        break;
      case Formats.UINT32:
        minStep_resolved = 1;
        minValue_resolved = 0;
        maxValue_resolved = 4294967295;
        isNumericType = true;
        break;
      case Formats.UINT64:
        minStep_resolved = 1;
        minValue_resolved = 0;
        maxValue_resolved = 18446744073709551615;
        isNumericType = true;
        break;
      //All of the following datatypes return from this switch.
      case Formats.BOOL:
        // @ts-ignore
        return (newValue == true); //We don't need to make sure this returns true or false
        break;
      case Formats.STRING:
        let myString = newValue as string || ''; //If null or undefined or anything odd, make it a blank string
        myString = String(myString);
        var maxLength = this.props.maxLen;
        if (maxLength === undefined)
          maxLength = 64; //Default Max Length is 64.
        if (myString.length > maxLength)
          myString = myString.substring(0, maxLength); //Truncate strings that are too long
        return myString; //We don't need to do any validation after having truncated the string
        break;
      case Formats.DATA:
        var maxLength = this.props.maxDataLen;
        if (maxLength === undefined)
          maxLength = 2097152; //Default Max Length is 2097152.
        //if (newValue.length>maxLength) //I don't know the best way to handle this since it's unknown binary data.
        //I suspect that it will crash HomeKit for this bridge if the length is too long.
        return newValue;
        break;
      case Formats.TLV8:
        //Should we parse this to make sure the tlv8 is valid?
        break;
      default: //Datatype out of HAP Spec encountered. We'll assume the developer knows what they're doing.
        return newValue;
    };

    if (isNumericType) {
      if (newValue === false) {
        return 0;
      }
      if (newValue === true) {
        return 1;
      }
      if (isNaN(Number.parseInt(newValue as string, 10))) {
        return this.value!;
      } //This is not a number so we'll just pass out the last value.
      if ((this.props.maxValue && !isNaN(this.props.maxValue)) && (this.props.maxValue !== null))
        maxValue_resolved = this.props.maxValue;
      if ((this.props.minValue && !isNaN(this.props.minValue)) && (this.props.minValue !== null))
        minValue_resolved = this.props.minValue;
      if ((this.props.minStep && !isNaN(this.props.minStep)) && (this.props.minStep !== null))
        minStep_resolved = this.props.minStep;
      if (newValue! < minValue_resolved!)
        newValue = minValue_resolved!; //Fails Minimum Value Test
      if (newValue! > maxValue_resolved!)
        newValue = maxValue_resolved!; //Fails Maximum Value Test
      if (minStep_resolved !== undefined) {
        //Determine how many decimals we need to display
        if (Math.floor(minStep_resolved) === minStep_resolved)
          stepDecimals = 0;
        else
          stepDecimals = minStep_resolved.toString().split(".")[1].length || 0;
        //Use Decimal to detemine the lowest value within the step.
        try {
          var decimalVal = new Decimal(Number.parseInt(newValue as string));
          var decimalDiff = decimalVal.mod(minStep_resolved);
          decimalVal = decimalVal.minus(decimalDiff);
          if (stepDecimals === 0) {
            newValue = parseInt(decimalVal.toFixed(0));
          } else {
            newValue = parseFloat(decimalVal.toFixed(stepDecimals)); //Convert it to a fixed decimal
          }
        } catch (e) {
          return this.value!; //If we had an error, return the current value.
        }
      }
      if (this['valid-values'] !== undefined)
        if (!this['valid-values'].includes(newValue as number))
          return this.value!; //Fails Valid Values Test
      if (this['valid-values-range'] !== undefined) { //This is another way Apple has to handle min/max
        if (newValue! < this['valid-values-range'][0])
          newValue = this['valid-values-range'][0];
        if (newValue! > this['valid-values-range'][1])
          newValue = this['valid-values-range'][1];
      }
    }
    return newValue;
  }

  setValue = (newValue: Nullable<CharacteristicValue | Error>, callback?: CharacteristicSetCallback, context?: any, connectionID?: string): Characteristic => {
    if (newValue instanceof Error) {
      this.status = newValue;
    } else {
      this.status = null;
    }
    newValue = this.validateValue(newValue as Nullable<CharacteristicValue>); //validateValue returns a value that has be cooerced into a valid value.
    var oldValue = this.value;
    if (this.listeners(CharacteristicEventTypes.SET).length > 0) {
      // allow a listener to handle the setting of this value, and wait for completion
      this.emit(CharacteristicEventTypes.SET, newValue, once((err: Error, writeResponse?: CharacteristicValue) => {
        this.status = err;
        if (err) {
          // pass the error along to our callback
          if (callback)
            callback(err);
        } else {
          if (writeResponse !== undefined && this.props.perms.includes(Perms.WRITE_RESPONSE))
            newValue = writeResponse; // support write response simply by letting the implementor pass the response as second argument to the callback

          if (newValue === undefined || newValue === null)
            newValue = this.getDefaultValue() as CharacteristicValue;
          // setting the value was a success; so we can cache it now
          this.value = newValue as CharacteristicValue;
          if (callback)
            callback();
          if (this.eventOnlyCharacteristic === true || oldValue !== newValue)
            this.emit(CharacteristicEventTypes.CHANGE, {oldValue: oldValue, newValue: newValue, context: context});
        }
      }), context, connectionID);
    } else {
      if (newValue === undefined || newValue === null)
        newValue = this.getDefaultValue() as CharacteristicValue;
      // no one is listening to the 'set' event, so just assign the value blindly
      this.value = newValue as string | number;
      if (callback)
        callback();
      if (this.eventOnlyCharacteristic === true || oldValue !== newValue)
        this.emit(CharacteristicEventTypes.CHANGE, {oldValue: oldValue, newValue: newValue, context: context});
    }
    return this; // for chaining
  }

  updateValue = (newValue: Nullable<CharacteristicValue | Error>, callback?: () => void, context?: any): Characteristic => {
    if (newValue instanceof Error) {
      this.status = newValue;
    } else {
      this.status = null;
    }
    newValue = this.validateValue(newValue as Nullable<CharacteristicValue>); //validateValue returns a value that has be cooerced into a valid value.
    if (newValue === undefined || newValue === null)
      newValue = this.getDefaultValue() as CharacteristicValue;
    // no one is listening to the 'set' event, so just assign the value blindly
    var oldValue = this.value;
    this.value = newValue;
    if (callback)
      callback();
    if (this.eventOnlyCharacteristic === true || oldValue !== newValue)
      this.emit(CharacteristicEventTypes.CHANGE, {oldValue: oldValue, newValue: newValue, context: context});
    return this; // for chaining
  }

  getDefaultValue = (): Nullable<CharacteristicValue> => {
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

  _assignID = (identifierCache: IdentifierCache, accessoryName: string, serviceUUID: string, serviceSubtype: string) => {
    // generate our IID based on our UUID
    this.iid = identifierCache.getIID(accessoryName, serviceUUID, serviceSubtype, this.UUID);
  }

  /**
   * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
   */
  toHAP = (opt?: ToHAPOptions) => {
    // ensure our value fits within our constraints if present
    var value = this.value;

    if (this.props.minValue != null && value! < this.props.minValue)
      value = this.props.minValue;
    if (this.props.maxValue != null && value! > this.props.maxValue)
      value = this.props.maxValue;
    if (this.props.format != null) {
      if (this.props.format === Formats.INT)
        value = parseInt(value as string);
      else if (this.props.format === Formats.UINT8)
        value = parseInt(value as string);
      else if (this.props.format === Formats.UINT16)
        value = parseInt(value as string);
      else if (this.props.format === Formats.UINT32)
        value = parseInt(value as string);
      else if (this.props.format === Formats.UINT64)
        value = parseInt(value as string);
      else if (this.props.format === Formats.FLOAT) {
        value = parseFloat(value as string);
        if (this.props.minStep != null) {
          var pow = Math.pow(10, decimalPlaces(this.props.minStep));
          value = Math.round(value * pow) / pow;
        }
      }
    }
    if (this.eventOnlyCharacteristic === true) {
      // @ts-ignore
      value = null;
    }

    const hap: Partial<HapCharacteristic> = {
      iid: this.iid!,
      type: this.UUID,
      perms: this.props.perms,
      format: this.props.format,
      value: value,
      description: this.displayName,
      // These properties used to be sent but do not seem to be used:
      //
      // events: false,
      // bonjour: false
    };
    if (this.props.validValues != null && this.props.validValues.length > 0) {
      hap['valid-values'] = this.props.validValues;
    }
    if (this.props.validValueRanges != null && this.props.validValueRanges.length > 0 && !(this.props.validValueRanges.length & 1)) {
      hap['valid-values-range'] = this.props.validValueRanges;
    }
    // extra properties
    if (this.props.unit != null)
      hap.unit = this.props.unit;
    if (this.props.maxValue != null)
      hap.maxValue = this.props.maxValue;
    if (this.props.minValue != null)
      hap.minValue = this.props.minValue;
    if (this.props.minStep != null)
      hap.minStep = this.props.minStep;
    // add maxLen if string length is > 64 bytes and trim to max 256 bytes
    if (this.props.format === Formats.STRING) {
      var str = bufferShim.from(value as string, 'utf8'), len = str.byteLength;
      if (len > 256) { // 256 bytes is the max allowed length
        hap.value = str.toString('utf8', 0, 256);
        hap.maxLen = 256;
      } else if (len > 64) { // values below can be ommited
        hap.maxLen = len;
      }
    }
    // if we're not readable, omit the "value" property - otherwise iOS will complain about non-compliance
    if (this.props.perms.indexOf(Perms.READ) == -1)
      delete hap.value;
    // delete the "value" property anyway if we were asked to
    if (opt && opt.omitValues)
      delete hap.value;
    return hap as HapCharacteristic;
  }
}


// Mike Samuel
// http://stackoverflow.com/questions/10454518/javascript-how-to-retrieve-the-number-of-decimals-of-a-string-number
function decimalPlaces(num: number) {
  var match = (''+num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) { return 0; }
  return Math.max(
       0,
       // Number of digits right of decimal point.
       (match[1] ? match[1].length : 0)
       // Adjust for scientific notation.
       - (match[2] ? +match[2] : 0));
}
