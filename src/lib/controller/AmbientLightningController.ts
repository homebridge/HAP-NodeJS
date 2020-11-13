import assert from "assert";
import createDebug from "debug";
import { EventEmitter } from "events";
import { ColorUtils, epochMillisFromMillisSince2001_01_01Buffer, HAPStatus, HapStatusError } from "../..";
import { CharacteristicValue } from "../../types";
import {
  ChangeReason,
  Characteristic,
  CharacteristicChange,
  CharacteristicEventTypes,
  CharacteristicOperationContext
} from "../Characteristic";
import {
  Brightness,
  CharacteristicValueActiveTransitionCount,
  CharacteristicValueTransitionControl,
  ColorTemperature,
  Hue,
  Lightbulb,
  Saturation,
  SupportedCharacteristicValueTransitionConfiguration
} from "../definitions";
import * as tlv from "../util/tlv";
import {
  ControllerIdentifier,
  ControllerServiceMap,
  DefaultControllerType,
  SerializableController,
  StateChangeDelegate
} from "./Controller";
import Timeout = NodeJS.Timeout;

const debug = createDebug("HAP-NodeJS:Controller:TransitionControl");

const enum SupportedCharacteristicValueTransitionConfigurationsTypes {
  SUPPORTED_TRANSITION_CONFIGURATION = 0x01,
}

const enum SupportedValueTransitionConfigurationTypes {
  CHARACTERISTIC_IID = 0x01,
  TRANSITION_TYPE = 0x02, // assumption
}

const enum TransitionType {
  BRIGHTNESS = 0x01, // uncertain
  COLOR_TEMPERATURE = 0x02,
}


const enum TransitionControlTypes {
  // noinspection JSUnusedGlobalSymbols
  UNKNOWN_1 = 0x01,
  COLOR_TEMPERATURE = 0x02,
}

const enum ValueTransitionConfigurationsTypes {
  VALUE_TRANSITION_CONFIGURATION = 0x01,
}

const enum ValueTransitionConfigurationTypes {
  // noinspection JSUnusedGlobalSymbols
  CHARACTERISTIC_IID = 0x01, // 1 byte
  TRANSITION_PARAMETERS = 0x02,
  UNKNOWN_3 = 0x03, // sent with value = 1 (1 byte)
  UNKNOWN_4 = 0x04, // not sent yet by anyone
  TRANSITION_CURVE_CONFIGURATION = 0x05,
  UPDATE_INTERVAL = 0x06, // 16 bit uint
  UNKNOWN_7 = 0x07, // not sent yet by anyone
  NOTIFY_INTERVAL_THRESHOLD = 0x08, // 32 bit uint
}

const enum ValueTransitionParametersTypes {
  UNKNOWN_1 = 0x01, // 16 bytes id or something (same for multiple writes)
  START_TIME = 0x02, // 8 bytes the start time for the provided schedule, millis since 2001/01/01 00:00:000
  UNKNOWN_3 = 0x03, // 8 bytes, id or something (same for multiple writes)
}

const enum TransitionCurveConfigurationTypes {
  TRANSITION_ENTRY = 0x01,
  ADJUSTMENT_CHARACTERISTIC_IID = 0x02,
  ADJUSTMENT_MULTIPLIER_RANGE = 0x03,
}

const enum TransitionEntryTypes {
  ADJUSTMENT_FACTOR = 0x01,
  VALUE = 0x02,
  TRANSITION_OFFSET = 0x03, // the time in milliseconds from the previous transition, interpolation happens here
  DURATION = 0x04, // optional, default 0, sets how long the previous value will stay the same (non interpolation time section)
}

const enum TransitionAdjustmentMultiplierRange {
  MINIMUM_ADJUSTMENT_MULTIPLIER = 0x01, // brightness 10
  MAXIMUM_ADJUSTMENT_MULTIPLIER = 0x02, // brightness 100
}

const enum ValueTransitionConfigurationResponseTypes { // read format for control point
  VALUE_CONFIGURATION_STATUS = 0x01,
}

const enum ValueTransitionConfigurationStatusTypes {
  CHARACTERISTIC_IID = 0x01,
  TRANSITION_PARAMETERS = 0x02,
  TIME_SINCE_START = 0x03, // milliseconds since start of transition
}

interface AmbientLightningCharacteristicContext extends CharacteristicOperationContext {
  controller: AmbientLightningController;
}

function isAmbientLightningContext(context: any): context is AmbientLightningCharacteristicContext {
  return context && "controller" in context;
}

export interface ActiveAmbientLightningTransition {
  iid: number; // color temperature characteristic

  transitionStartMillis: number; // start of transition in epoch time millis

  id1: string; // unknown hex
  transitionStartBuffer: string; // start of transition in milliseconds from 2001-01-01 00:00:00; unsigned 64 bit LE integer
  id3: string; // unknown hex

  transitionCurve: AmbientLightningTransitionCurveEntry[];

  brightnessCharacteristicIID: number;
  brightnessAdjustmentRange: BrightnessAdjustmentMultiplierRange;

  /**
   * Interval in milliseconds specifies how often the accessory should update the color temperature (internally).
   * Typically this is 60000 aka 60 seconds aka 1 minute.
   * Note {@link notifyIntervalThreshold}
   */
  updateInterval: number,
  /**
   * Defines the interval in milliseconds on how often the accessory may send even notifications
   * to subscribed HomeKit controllers (aka call {@link Characteristic.updateValue}.
   * Typically this is 600000 aka 600 seconds aka 10 minutes.
   */
  notifyIntervalThreshold: number;
}

export interface AmbientLightningTransitionCurveEntry {
  /**
   * The color temperature in mired.
   */
  temperature: number,
  /**
   * The color temperature actually set to the color temperature characteristic is dependent
   * on the current brightness value of the lightbulb.
   * This means you will always need to query the current brightness when updating the color temperature
   * for the next transition step.
   * Additionally you will also need to correct the color temperature when the end user changes the
   * brightness of the Lightbulb.
   *
   * The brightnessAdjustmentFactor is always a negative floating point value.
   *
   * To calculate the resulting color temperature you will need to do the following.
   *
   * In short: temperature + brightnessAdjustmentFactor * currentBrightness
   *
   * Complete example:
   * ```js
   * const temperature = ...; // next transition value, the above property
   * // below query the current brightness while staying the the min/max brightness range (typically between 10-100 percent)
   * const currentBrightness = Math.max(minBrightnessValue, Math.min(maxBrightnessValue, CHARACTERISTIC_BRIGHTNESS_VALUE));
   *
   * // as both temperature and brightnessAdjustmentFactor are floating point values it is advised to round to the next integer
   * const resultTemperature = Math.round(temperature + brightnessAdjustmentFactor * currentBrightness);
   * ```
   */
  brightnessAdjustmentFactor: number;
  /**
   * The duration in milliseconds this exact temperature value stays the same.
   * When we transition to to the temperature value represented by this entry, it stays for the specified
   * duration on the exact same value (with respect to brightness adjustment) until we transition
   * to the next entry (see {@link transitionTime}).
   */
  duration?: number;
  /**
   * The time in milliseconds the color temperature should transition from the previous
   * entry to this one.
   * For example if we got the two values A and B, with A.temperature = 300 and B.temperature = 400 and
   * for the current time we are at temperature value 300. Then we need to transition smoothly
   * within the B.transitionTime to the B.temperature value.
   * If this is the first entry in the Curve (this value is probably zero) and is the offset to the transitionStartMillis
   * (the Date/Time were this transition curve was set up).
   */
  transitionTime: number;
}

export interface BrightnessAdjustmentMultiplierRange {
  minBrightnessValue: number;
  maxBrightnessValue: number;
}

export interface AmbientLightningOptions {
  /**
   * Defines how the controller will operate.
   * You can choose between automatic and manual mode.
   * See {@link AmbientLightningControllerMode}.
   */
  controllerMode: AmbientLightningControllerMode,
}

/**
 * Defines in which mode the {@link AmbientLightningController} will operate in.
 */
export const enum AmbientLightningControllerMode {
  /**
   * In automatic mode pretty much everything from setup to transition scheduling is done by the controller.
   */
  AUTOMATIC = 1,
  /**
   * In manual mode setup is done by the controller but the actual transition must be done by the user.
   * This is useful for lights which natively support transitions.
   */
  MANUAL = 2,
}

export const enum AmbientLightningControllerEvents {
  /**
   * This event is called once a HomeKit controller enables Ambient Lightning
   * or a HomeHub sends a updated transition schedule for the next 24 hours.
   * This is also called on startup when AmbientLightning was previously enabled.
   */
  UPDATE = "update",
  /**
   * In yet unknown circumstances HomeKit may also send a dedicated disable command
   * via the control point characteristic. You may want to handle that in manual mode as well.
   * The current transition will still be associated with the controller object when this event is called.
   */
  DISABLED = "disable",
}

export declare interface AmbientLightningController {
  /**
   * See {@link AmbientLightningControllerEvents.UPDATE}
   *
   * @param event
   * @param listener
   */
  on(event: "update", listener: () => void): this;
  /**
   * See {@link AmbientLightningControllerEvents.DISABLED}
   *
   * @param event
   * @param listener
   */
  on(event: "disable", listener: () => void): this;

  emit(event: "update"): boolean;
  emit(event: "disable"): boolean;
}

interface SerializedAmbientLightningControllerState {
  activeTransition: ActiveAmbientLightningTransition;
}

/**
 * This class allows adding Ambient Lightning support to Lightbulb services.
 * The Lightbulb service MUST have the {@link Characteristic.ColorTemperature} characteristic AND
 * the {@link Characteristic.Brightness} characteristic added.
 * The light may also expose {@link Characteristic.Hue} and {@link Characteristic.Saturation} characteristics
 * (though additional work is required to keep them in sync with the color temperature characteristic. see below)
 *
 * How Ambient Lightning works:
 *  When enabling AmbientLightning the iDevice will send a transition schedule for the next 24 hours.
 *  This schedule will be renewed all 24 hours by a HomeHub in your home
 *  (updating the schedule according to your current day/night situation).
 *  Once enabled the lightbulb will execute the provided transitions. The color temperature value set is always
 *  dependent on the current brightness value. Meaning brighter light will be colder and darker light will be warmer.
 *  HomeKit considers Ambient Lightning to be disabled as soon a write happens to either the
 *  Hue/Saturation or the ColorTemperature characteristics.
 *  The AmbientLightning state must persist across reboots.
 *
 * The AmbientLightningController can be operated in two modes: {@link AmbientLightningControllerMode.AUTOMATIC} and
 * {@link AmbientLightningControllerMode.MANUAL} with AUTOMATIC being the default.
 * The goal would be that the color transition is done DIRECTLY on the light itself, thus not creating any
 * additional/heavy traffic on the network.
 * So if your light hardware/API supports transitions please go the extra mile and use MANUAL mode.
 *
 *
 *
 * Below is an overview what you need to or consider when enabling AmbientLighting (categorized by mode).
 * The {@link AmbientLightningControllerMode} can be defined with the second constructor argument.
 *
 * <b>AUTOMATIC (Default mode):</b>
 *
 *  This is the easiest mode to setup and needs less to no work form your side for AmbientLightning to work.
 *  The AmbientLightningController will go through setup procedure with HomeKit and automatically update
 *  the color temperature characteristic base on the current transition schedule.
 *  It is also adjusting the color temperature when a write to the brightness characteristic happens.
 *  It will also handle turning of AmbientLightning when it detects a write happening to the
 *  ColorTemperature, Hue or Saturation characteristic.
 *
 *  So what do you need to consider in automatic mode:
 *   - Brightness and ColorTemperature characteristics MUST be set up. Hue and Saturation may be added for color support.
 *   - Color temperature will be updated all 60 seconds by calling the SET handler of the ColorTemperature characteristic.
 *    So every transition behaves like a regular write to the ColorTemperature characteristic.
 *   - Every transition step is dependent on the current brightness value. Try to keep the internal cache updated
 *    as the controller won't call the GET handler every 60 seconds.
 *    (The cache value is updated on SET/GET operations or by manually calling {@link Characteristic.updateValue}).
 *   - Detecting changes on the lightbulb side:
 *    Any manual change to ColorTemperature or Hue/Saturation is considered as a signal to turn AmbientLightning off.
 *    In order to notify the AmbientLightningController of such an event happening OUTSIDE of HomeKit
 *    (like changing stuff on the physical Lightbulb) you can call {@link Characteristic.setValue} manually
 *    (keep in mind, this will fire call your SET handler) or call {@link disableAmbientLightning} directly.
 *   - Be aware that even when the light is turned off the transition will continue to call the SET handler
 *    of the ColorTemperature characteristic.
 *   - When using Hue/Saturation:
 *    When using Hue/Saturation in combination with the ColorTemperature characteristic you need to update the
 *    respective other in a particular way depending if being in "color mode" or "color temperature mode".
 *    When a write happens to Hue/Saturation characteristic in is advised to set the internal value of the
 *    ColorTemperature to the minimal (NOT RAISING a event).
 *    When a write happens to the ColorTemperature characteristic just MUST convert to a proper representation
 *    in hue and saturation values, with RAISING a event.
 *    As noted above you MUST NOT call the {@link Characteristic.setValue} method for this, as this will be considered
 *    a write to the characteristic and will turn off AmbientLightning. Instead you should use
 *    {@link Characteristic.updateValue} for this.
 *    You can and SHOULD use the supplied utility method {@link ColorUtils.colorTemperatureToHueAndSaturation}
 *    for converting mired to hue and saturation values.
 *
 *
 * <b>MANUAL mode:</b>
 *
 *  Manual mode is recommended for any accessories which support transitions natively on the devices end.
 *  Like for example ZigBee lights which support sending transitions directly to the lightbulb which
 *  then get executed ON the lightbulb itself reducing unnecessary network traffic.
 *  Here is a quick overview what you have to consider to successfully implement AmbientLightning support.
 *  The AmbientLightningController will also in manual mode do all of the setup procedure.
 *  It will also save the transition schedule to disk to keep AmbientLightning enabled across reboots.
 *  The "only" thing you have to do yourself is handling the actual transitions, check that event notifications
 *  are only sent in the defined interval threshold, adjust the color temperature when brightness is changed
 *  and signal that ambient lightning should be disabled if ColorTemperature, Hue or Saturation is changed manually.
 *
 *  First step is to setup up a event handler for the {@link AmbientLightningControllerEvents.UPDATE}, which is called
 *  when AmbientLightning is enabled, the HomeHub updates the schedule for the next 24 hours or AmbientLightning
 *  is restored from disk on startup.
 *  In the event handler you can get the current schedule via {@link AmbientLightningController.getAmbientLightningTransitionCurve},
 *  retrieve current intervals like {@link AmbientLightningController.getAmbientLightningUpdateInterval} or
 *  {@link AmbientLightningController.getAmbientLightningNotifyIntervalThreshold} and get the date in epoch millis
 *  when the current transition curve started using {@link AmbientLightningController.getAmbientLightningStartTimeOfTransition}.
 *  Additionally {@link AmbientLightningController.getAmbientLightningBrightnessMultiplierRange} can be used
 *  to get the valid range for the brightness value to calculate the brightness adjustment factor.
 *  The method {@link AmbientLightningController.isAmbientLightningActive} can be used to check if AmbientLightning is enabled.
 *  Besides actually running the transition (see {@link AmbientLightningTransitionCurveEntry}) you must
 *  correctly update the color temperature when the brightness of the lightbulb changes (see {@link AmbientLightningTransitionCurveEntry.brightnessAdjustmentFactor}),
 *  and signal when AmbientLightning got disabled by calling {@link AmbientLightningController.disableAmbientLightning}
 *  when ColorTemperature, Hue or Saturation where changed manually.
 *  Lastly you should set up a event handler for the {@link AmbientLightningControllerEvents.DISABLED} event.
 *  In yet unknown circumstances HomeKit may also send a dedicated disable command via the control point characteristic.
 *  Be prepared to handle that.
 */
export class AmbientLightningController extends EventEmitter implements SerializableController<ControllerServiceMap, SerializedAmbientLightningControllerState> {

  private stateChangeDelegate?: StateChangeDelegate;

  private readonly lightbulb: Lightbulb;
  private readonly mode: AmbientLightningControllerMode;

  private readonly adjustmentFactorChangedListener: (change: CharacteristicChange) => void;
  private readonly characteristicManualWrittenChangeListener: (change: CharacteristicChange) => void;

  private supportedTransitionConfiguration?: SupportedCharacteristicValueTransitionConfiguration;
  private transitionControl?: CharacteristicValueTransitionControl;
  private activeTransitionCount?: CharacteristicValueActiveTransitionCount;

  private colorTemperatureCharacteristic?: ColorTemperature;
  private brightnessCharacteristic?: Brightness;
  private saturationCharacteristic?: Saturation;
  private hueCharacteristic?: Hue;

  private activeTransition?: ActiveAmbientLightningTransition;
  private didRunFirstInitializationStep = false;
  private updateTimeout?: Timeout;

  private lastEventNotificationSent: number = 0;
  private lastNotifiedTemperatureValue: number = 0;
  private lastNotifiedSaturationValue: number = 0;
  private lastNotifiedHueValue: number = 0;

  /**
   * Creates a new instance of the AmbientLightningController.
   * Refer to the {@link AmbientLightningController} documentation on how to use it.
   *
   * @param service - The lightbulb to which ambient lightning support should be added.
   * @param options - Optional options to define the operating mode (automatic vs manual).
   */
  constructor(service: Lightbulb, options?: AmbientLightningOptions) {
    super();
    this.lightbulb = service;
    this.mode = options?.controllerMode ?? AmbientLightningControllerMode.AUTOMATIC;

    assert(this.lightbulb.testCharacteristic(Characteristic.ColorTemperature), "Lightbulb must have the ColorTemperature characteristic added!");
    assert(this.lightbulb.testCharacteristic(Characteristic.Brightness), "Lightbulb must have the Brightness characteristic added!");

    this.adjustmentFactorChangedListener = this.handleAdjustmentFactorChanged.bind(this);
    this.characteristicManualWrittenChangeListener = this.handleCharacteristicManualWritten.bind(this);
  }

  /**
   * @private
   */
  controllerId(): ControllerIdentifier {
    return DefaultControllerType.CHARACTERISTIC_TRANSITION + "-" + this.lightbulb.getServiceId();
  }

  // ----------- PUBLIC API START -----------

  /**
   * Returns if a Ambient Lightning transition is currently active.
   */
  public isAmbientLightningActive(): boolean {
    return !!this.activeTransition;
  }

  /**
   * This method can be called to manually disable the current active Ambient Lightning transition.
   * When using {@link AmbientLightningControllerMode.AUTOMATIC} you won't need to call this method.
   * In {@link AmbientLightningControllerMode.MANUAL} you must call this method when Ambient Lightning should be disabled.
   * This is the case when the user manually changes the value of Hue, Saturation or ColorTemperature characteristics
   * (or if any of those values is changed by physical interaction with the lightbulb).
   */
  public disableAmbientLightning(triggerStateChange: boolean = true) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    if (this.activeTransition) {
      this.colorTemperatureCharacteristic!.removeListener(CharacteristicEventTypes.CHANGE, this.characteristicManualWrittenChangeListener);
      this.brightnessCharacteristic!.removeListener(CharacteristicEventTypes.CHANGE, this.adjustmentFactorChangedListener);

      if (this.hueCharacteristic) {
        this.hueCharacteristic.removeListener(CharacteristicEventTypes.CHANGE, this.characteristicManualWrittenChangeListener);
      }
      if (this.saturationCharacteristic) {
        this.saturationCharacteristic.removeListener(CharacteristicEventTypes.CHANGE, this.characteristicManualWrittenChangeListener);
      }

      if (triggerStateChange) {
        this.stateChangeDelegate && this.stateChangeDelegate();
      }
    }

    this.activeTransition = undefined;
    this.colorTemperatureCharacteristic = undefined;
    this.brightnessCharacteristic = undefined;
    this.hueCharacteristic = undefined;
    this.saturationCharacteristic = undefined;

    this.lastEventNotificationSent = 0;
    this.lastNotifiedTemperatureValue = 0;
    this.lastNotifiedSaturationValue = 0;
    this.lastNotifiedHueValue = 0;

    this.didRunFirstInitializationStep = false;

    this.activeTransitionCount!.sendEventNotification(0);

    debug("[%s] Disabling ambient lightning", this.lightbulb.displayName);
  }

  /**
   * Returns the time where the current transition curve was started in epoch time millis.
   * A transition curves is active for 24 hours typically and is renewed every 24 hours by a HomeHub.
   */
  public getAmbientLightningStartTimeOfTransition(): number {
    if (!this.activeTransition) {
      throw new Error("There is no active transition!");
    }
    return this.activeTransition.transitionStartMillis;
  }

  public getAmbientLightningTransitionCurve(): AmbientLightningTransitionCurveEntry[] {
    if (!this.activeTransition) {
      throw new Error("There is no active transition!");
    }
    return this.activeTransition.transitionCurve;
  }

  public getAmbientLightningBrightnessMultiplierRange(): BrightnessAdjustmentMultiplierRange {
    if (!this.activeTransition) {
      throw new Error("There is no active transition!");
    }
    return this.activeTransition.brightnessAdjustmentRange;
  }

  /**
   * This method returns the interval (in milliseconds) in which the light should update its internal color temperature
   * (aka changes it physical color).
   * A lightbulb should ideally change this also when turned of in oder to have a smooth transition when turning the light on.
   *
   * Typically this evaluates to 60000 milliseconds (60 seconds).
   */
  public getAmbientLightningUpdateInterval(): number {
    if (!this.activeTransition) {
      throw new Error("There is no active transition!");
    }
    return this.activeTransition.updateInterval;
  }

  /**
   * Returns the minimum interval threshold (in milliseconds) a accessory may notify HomeKit controllers about a new
   * color temperature value via event notifications (what happens when you call {@link Characteristic.updateValue}).
   * Meaning the accessory should only send event notifications to subscribed HomeKit controllers at the specified interval.
   *
   * Typically this evaluates to 600000 milliseconds (10 minutes).
   */
  public getAmbientLightningNotifyIntervalThreshold(): number {
    if (!this.activeTransition) {
      throw new Error("There is no active transition!");
    }
    return this.activeTransition.notifyIntervalThreshold;
  }

  // ----------- PUBLIC API END -----------

  private handleActiveTransitionUpdated(calledFromDeserializer: boolean = false): void {
    this.activeTransitionCount!.sendEventNotification(1);

    if (this.mode === AmbientLightningControllerMode.AUTOMATIC) {
      this.scheduleNextUpdate();
    } else if (this.mode === AmbientLightningControllerMode.MANUAL) {
      this.emit(AmbientLightningControllerEvents.UPDATE);
    } else {
      throw new Error("Unsupported ambient lightning controller mode: " + this.mode);
    }

    if (!calledFromDeserializer) {
      this.stateChangeDelegate && this.stateChangeDelegate();
    }
  }

  private handleAmbientLightningEnabled(): void { // this method is run when the initial curve was sent
    if (!this.activeTransition) {
      throw new Error("There is no active transition!");
    }

    this.colorTemperatureCharacteristic = this.lightbulb.getCharacteristic(Characteristic.ColorTemperature);
    this.brightnessCharacteristic = this.lightbulb.getCharacteristic(Characteristic.Brightness);

    this.colorTemperatureCharacteristic.on(CharacteristicEventTypes.CHANGE, this.characteristicManualWrittenChangeListener);
    this.brightnessCharacteristic.on(CharacteristicEventTypes.CHANGE, this.adjustmentFactorChangedListener);

    if (this.lightbulb.testCharacteristic(Characteristic.Hue)) {
      this.hueCharacteristic = this.lightbulb.getCharacteristic(Characteristic.Hue)
        .on(CharacteristicEventTypes.CHANGE, this.characteristicManualWrittenChangeListener);
    }
    if (this.lightbulb.testCharacteristic(Characteristic.Saturation)) {
      this.saturationCharacteristic = this.lightbulb.getCharacteristic(Characteristic.Saturation)
        .on(CharacteristicEventTypes.CHANGE, this.characteristicManualWrittenChangeListener);
    }
  }

  private handleAmbientLightningDisabled(calledFromResetHandler: boolean = false): void {
    if (this.mode === AmbientLightningControllerMode.MANUAL && this.activeTransition) { // only emit the event if a transition is actually enabled
      this.emit(AmbientLightningControllerEvents.DISABLED);
    }
    this.disableAmbientLightning(!calledFromResetHandler);
  }

  private handleAdjustmentFactorChanged(change: CharacteristicChange): void {
    if (change.newValue === change.oldValue) {
      return;
    }

    this.scheduleNextUpdate(true); // run a dry scheduleNextUpdate to adjust the colorTemperature using the new brightness value
  }

  /**
   * This method is called when a change happens to the Hue/Saturation or ColorTemperature characteristic.
   * When such a write happens (caused by the user changing the color/temperature) Ambient Lightning must be disabled.
   *
   * @param change
   */
  private handleCharacteristicManualWritten(change: CharacteristicChange): void {
    if (change.reason === ChangeReason.EVENT || change.reason === ChangeReason.UPDATE
      ||(isAmbientLightningContext(change.context) && change.context.controller === this)) {
      // we ignore write request which are the result of calls made to updateValue or sendEventNotification
      // or the change was done by us
      return;
    }

    debug("[%s] Receive a manual write to an characteristic (newValue: %d). Thus disabling ambient lightning!", this.lightbulb.displayName, change.newValue);
    this.disableAmbientLightning();
  }

  private scheduleNextUpdate(dryRun: boolean = false): void {
    if (!this.activeTransition) {
      throw new Error("tried scheduling transition when no transition was active!");
    }

    if (!dryRun) {
      this.updateTimeout = undefined;
    }

    if (!this.didRunFirstInitializationStep) {
      this.didRunFirstInitializationStep = true;
      this.handleAmbientLightningEnabled();
    }

    const now = Date.now();
    const offset = now - this.activeTransition.transitionStartMillis;

    let lowerBoundTimeOffset = 0; // time offset to the lowerBound transition entry
    let lowerBound: AmbientLightningTransitionCurveEntry | undefined = undefined;
    let upperBound: AmbientLightningTransitionCurveEntry | undefined = undefined;

    for (let i = 0; i + 1 < this.activeTransition.transitionCurve.length; i++) {
      const lowerBound0 = this.activeTransition.transitionCurve[i];
      const upperBound0 = this.activeTransition.transitionCurve[i + 1];

      const lowerBoundDuration = lowerBound0.duration ?? 0;
      lowerBoundTimeOffset += lowerBound0.transitionTime;

      if (offset >= lowerBoundTimeOffset && offset <= lowerBoundTimeOffset + lowerBoundDuration + upperBound0.transitionTime) {
        lowerBound = lowerBound0;
        upperBound = upperBound0;
        break;
      }

      lowerBoundTimeOffset += lowerBoundDuration;
    }

    if (!lowerBound || !upperBound) {
      debug("[%s] Reached end of transition curve!", this.lightbulb.displayName);
      if (!dryRun) {
        // the transition schedule is only for 24 hours, we reached the end?
        this.disableAmbientLightning();
      }
      return;
    }

    const adjustmentMultiplier = Math.max(
      this.activeTransition.brightnessAdjustmentRange.minBrightnessValue,
      Math.min(
        this.activeTransition.brightnessAdjustmentRange.maxBrightnessValue,
        this.brightnessCharacteristic!.value as number // get handler is not called for optimal performance
      )
    );

    let transitionOffset = offset - lowerBoundTimeOffset;

    let interpolatedTemperature: number;
    let interpolatedAdjustmentFactor: number;
    if (lowerBound.duration && transitionOffset  <= lowerBound.duration) {
      interpolatedTemperature = lowerBound.temperature;
      interpolatedAdjustmentFactor = lowerBound.brightnessAdjustmentFactor;
    } else {
      transitionOffset -= lowerBound.duration ?? 0;
      const timePercentage = transitionOffset / upperBound.transitionTime;
      interpolatedTemperature = lowerBound.temperature + (upperBound.temperature - lowerBound.temperature) * timePercentage;
      interpolatedAdjustmentFactor = lowerBound.brightnessAdjustmentFactor + (upperBound.brightnessAdjustmentFactor - lowerBound.brightnessAdjustmentFactor) * timePercentage;
    }

    let temperature = Math.round(interpolatedTemperature + interpolatedAdjustmentFactor * adjustmentMultiplier);

    const min = this.colorTemperatureCharacteristic?.props.minValue ?? 140;
    const max = this.colorTemperatureCharacteristic?.props.maxValue ?? 500;
    temperature = Math.max(min, Math.min(max, temperature));
    const color = ColorUtils.colorTemperatureToHueAndSaturation(temperature);

    debug("[%s] Next temperature value is %d (for brightness %d)", this.lightbulb.displayName, temperature, adjustmentMultiplier);

    const context: AmbientLightningCharacteristicContext = {
      controller: this,
      omitEventUpdate: true,
    };

    /*
     * We set saturation and hue values BEFORE we call the ColorTemperature SET handler (via setValue).
     * First thought was so the API user could get the values in the SET handler of the color temperature characteristic.
     * Do this is probably not really elegant cause this would only work when AmbientLightning is turned on
     * an the accessory MUST in any case update the Hue/Saturation values on a ColorTemperature write
     * (obviously only if Hue/Saturation characteristics are added to the service).
     *
     * The clever thing about this though is that, that it prevents notifications from being sent for Hue and Saturation
     * outside the specified notifyIntervalThreshold (see below where notifications are manually sent).
     * As the dev will or must call something like updateValue to propagate the updated hue and saturation values
     * to all HomeKit clients (so that the color is reflected in the UI), HAP-NodeJS won't send notifications
     * as the values are the same.
     * This of course only works if the plugin uses the exact same algorithm of "converting" the color temperature
     * value to the hue and saturation representation.
     */
    if (this.saturationCharacteristic) {
      this.saturationCharacteristic.value = color.saturation;
    }
    if (this.hueCharacteristic) {
      this.hueCharacteristic.value = color.hue;
    }

    this.colorTemperatureCharacteristic!.setValue(temperature, context); // TODO maybe ensure this call actually succeeds?

    if (!this.activeTransition) {
      console.warn("[" + this.lightbulb.displayName + "] Ambient Lightning was probably disable my mistake by some call in the SET handler of the ColorTemperature characteristic! " +
        "Please check that you don't call setValue/setCharacteristic on the Hue, Saturation or ColorTemperature characteristic!");
      return;
    }

    if (now - this.lastEventNotificationSent >= this.activeTransition.notifyIntervalThreshold) {
      this.lastEventNotificationSent = now;

      const eventContext: AmbientLightningCharacteristicContext = {
        controller: this,
      };

      if (this.lastNotifiedTemperatureValue !== temperature) {
        this.colorTemperatureCharacteristic!.sendEventNotification(temperature, eventContext);
        this.lastNotifiedTemperatureValue = temperature;
      }
      if (this.saturationCharacteristic && this.lastNotifiedSaturationValue !== color.saturation) {
        this.saturationCharacteristic.sendEventNotification(color.saturation, eventContext);
        this.lastNotifiedSaturationValue = color.saturation;
      }
      if (this.hueCharacteristic && this.lastNotifiedHueValue !== color.hue) {
        this.hueCharacteristic.sendEventNotification(color.hue, eventContext);
        this.lastNotifiedHueValue = color.hue;
      }
    }

    if (!dryRun) {
      this.updateTimeout = setTimeout(this.scheduleNextUpdate.bind(this), this.activeTransition.updateInterval);
    }
  }

  /**
   * @private
   */
  constructServices(): ControllerServiceMap {
    return {};
  }

  /**
   * @private
   */
  initWithServices(serviceMap: ControllerServiceMap): void | ControllerServiceMap {
    // do nothing
  }

  /**
   * @private
   */
  configureServices(): void {
    this.supportedTransitionConfiguration = this.lightbulb.getCharacteristic(Characteristic.SupportedCharacteristicValueTransitionConfiguration);
    this.transitionControl = this.lightbulb.getCharacteristic(Characteristic.CharacteristicValueTransitionControl)
      .updateValue("");
    this.activeTransitionCount = this.lightbulb.getCharacteristic(Characteristic.CharacteristicValueActiveTransitionCount)
      .updateValue(0);

    this.supportedTransitionConfiguration
      .onGet(this.handleSupportedTransitionConfigurationRead.bind(this));
    this.transitionControl
      .onGet(() => {
        return this.buildTransitionControlResponseBuffer().toString("base64");
      })
      .onSet(value => {
        try {
          return this.handleTransitionControlWrite(value);
        } catch (error) {
          console.warn("[%s] Encountered error on CharacteristicValueTransitionControl characteristic: " + error.stack);
          this.disableAmbientLightning();
          throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
  }

  /**
   * @private
   */
  handleControllerRemoved(): void {
    this.handleAmbientLightningDisabled(true);

    this.lightbulb.removeCharacteristic(this.supportedTransitionConfiguration!);
    this.lightbulb.removeCharacteristic(this.transitionControl!);
    this.lightbulb.removeCharacteristic(this.activeTransitionCount!);

    this.removeAllListeners();
  }

  /**
   * @private
   */
  handleFactoryReset(): void {
    this.handleAmbientLightningDisabled();
  }

  /**
   * @private
   */
  serialize(): SerializedAmbientLightningControllerState | undefined {
    if (!this.activeTransition) {
      return undefined;
    }

    return {
      activeTransition: this.activeTransition,
    };
  }

  /**
   * @private
   */
  deserialize(serialized: SerializedAmbientLightningControllerState): void {
    this.activeTransition = serialized.activeTransition;
    try {
      this.handleActiveTransitionUpdated(true);
    } catch (error) {
      console.log("Could not enable ambient lightning when restoring from disk: " + error.stack);
      this.disableAmbientLightning(); // ensure it's disabled
    }
  }

  /**
   * @private
   */
  setupStateChangeDelegate(delegate?: StateChangeDelegate): void {
    this.stateChangeDelegate = delegate;
  }

  private handleSupportedTransitionConfigurationRead(): string {
    const brightnessIID = this.lightbulb!.getCharacteristic(Characteristic.Brightness).iid;
    const temperatureIID = this.lightbulb!.getCharacteristic(Characteristic.ColorTemperature).iid;
    assert(brightnessIID, "iid for brightness characteristic is undefined");
    assert(temperatureIID, "iid for temperature characteristic is undefined");

    return tlv.encode(SupportedCharacteristicValueTransitionConfigurationsTypes.SUPPORTED_TRANSITION_CONFIGURATION, [
      tlv.encode(
        SupportedValueTransitionConfigurationTypes.CHARACTERISTIC_IID, brightnessIID!,
        SupportedValueTransitionConfigurationTypes.TRANSITION_TYPE, TransitionType.BRIGHTNESS,
      ),
      tlv.encode(
        SupportedValueTransitionConfigurationTypes.CHARACTERISTIC_IID, temperatureIID!,
        SupportedValueTransitionConfigurationTypes.TRANSITION_TYPE, TransitionType.COLOR_TEMPERATURE,
      ),
    ]).toString("base64");
  }

  private buildTransitionControlResponseBuffer(time?: number): Buffer {
    if (!this.activeTransition) {
      return Buffer.alloc(0);
    }

    const active = this.activeTransition;

    const timeSinceStart = time ?? (Date.now() - active.transitionStartMillis);
    const timeSinceStartBuffer = Buffer.alloc(4);
    timeSinceStartBuffer.writeUInt32LE(timeSinceStart, 0); // we could use dynamic buffer sizes depending on the size needed

    const status = tlv.encode(
      ValueTransitionConfigurationStatusTypes.CHARACTERISTIC_IID, active.iid!,
      ValueTransitionConfigurationStatusTypes.TRANSITION_PARAMETERS, tlv.encode(
        ValueTransitionParametersTypes.UNKNOWN_1, Buffer.from(active.id1, "hex"),
        ValueTransitionParametersTypes.START_TIME, Buffer.from(active.transitionStartBuffer, "hex"),
        ValueTransitionParametersTypes.UNKNOWN_3, Buffer.from(active.id3, "hex"),
      ),
      ValueTransitionConfigurationStatusTypes.TIME_SINCE_START, timeSinceStartBuffer, // TODO maybe this is actually the last transition time?
    );

    return tlv.encode(
      ValueTransitionConfigurationResponseTypes.VALUE_CONFIGURATION_STATUS, status,
    );
  }

  private handleTransitionControlWrite(value: CharacteristicValue): string {
    if (typeof value !== "string") {
      throw new HapStatusError(HAPStatus.INVALID_VALUE_IN_REQUEST);
    }

    const tlvData = tlv.decode(Buffer.from(value, "base64"));
    const valueTransitionConfigurations = tlv.decode(tlvData[TransitionControlTypes.COLOR_TEMPERATURE]);

    const transitionConfiguration = tlv.decode(valueTransitionConfigurations[ValueTransitionConfigurationsTypes.VALUE_TRANSITION_CONFIGURATION]);

    const iid = transitionConfiguration[ValueTransitionConfigurationTypes.CHARACTERISTIC_IID].readUInt8(0);
    if (!this.lightbulb.getCharacteristicByIID(iid)) {
      throw new HapStatusError(HAPStatus.INVALID_VALUE_IN_REQUEST);
    }

    const param3 = transitionConfiguration[ValueTransitionConfigurationTypes.UNKNOWN_3]?.readUInt8(0); // when present it is always 1
    if (!param3) { // if HomeKit just sends the iid, we consider that as "disable ambient lightning" (assumption)
      this.handleAmbientLightningDisabled();
      return tlv.encode(TransitionControlTypes.COLOR_TEMPERATURE, Buffer.alloc(0)).toString("base64");
    }

    const parametersTLV = tlv.decode(transitionConfiguration[ValueTransitionConfigurationTypes.TRANSITION_PARAMETERS]);
    const curveConfiguration = tlv.decodeWithLists(transitionConfiguration[ValueTransitionConfigurationTypes.TRANSITION_CURVE_CONFIGURATION]);
    const updateInterval = transitionConfiguration[ValueTransitionConfigurationTypes.UPDATE_INTERVAL].readUInt16LE(0);
    const notifyIntervalThreshold = transitionConfiguration[ValueTransitionConfigurationTypes.NOTIFY_INTERVAL_THRESHOLD].readUInt32LE(0);

    const id1 = parametersTLV[ValueTransitionParametersTypes.UNKNOWN_1];
    const startTime = parametersTLV[ValueTransitionParametersTypes.START_TIME];
    const id3 = parametersTLV[ValueTransitionParametersTypes.UNKNOWN_3];

    const startTimeMillis = epochMillisFromMillisSince2001_01_01Buffer(startTime);

    const transitionCurve: AmbientLightningTransitionCurveEntry[] = [];
    let previous: AmbientLightningTransitionCurveEntry | undefined = undefined;

    const transitions = curveConfiguration[TransitionCurveConfigurationTypes.TRANSITION_ENTRY] as Buffer[];
    for (const entry of transitions) {
      const tlvEntry = tlv.decode(entry);

      const adjustmentFactor = tlvEntry[TransitionEntryTypes.ADJUSTMENT_FACTOR].readFloatLE(0);
      const value = tlvEntry[TransitionEntryTypes.VALUE].readFloatLE(0);

      const transitionOffsetBuffer = tlvEntry[TransitionEntryTypes.TRANSITION_OFFSET];
      let transitionOffset = -1;
      if (transitionOffsetBuffer.length === 1) {
        transitionOffset = transitionOffsetBuffer.readUInt8(0);
      } else if (transitionOffsetBuffer.length === 2) {
        transitionOffset = transitionOffsetBuffer.readUInt16LE(0);
      } else if (transitionOffsetBuffer.length === 4) {
        transitionOffset = transitionOffsetBuffer.readUInt32LE(0);
      }
      const duration = tlvEntry[TransitionEntryTypes.DURATION]?.readUInt32LE(0);

      if (previous) {
        previous.duration = duration;
      }

      previous = {
        temperature: value,
        brightnessAdjustmentFactor: adjustmentFactor,
        transitionTime: transitionOffset,
      };
      transitionCurve.push(previous);
    }

    const adjustmentIID = (curveConfiguration[TransitionCurveConfigurationTypes.ADJUSTMENT_CHARACTERISTIC_IID] as Buffer).readUInt8(0);
    const adjustmentMultiplierRange = tlv.decode(curveConfiguration[TransitionCurveConfigurationTypes.ADJUSTMENT_MULTIPLIER_RANGE] as Buffer);
    const minAdjustmentMultiplier = adjustmentMultiplierRange[TransitionAdjustmentMultiplierRange.MINIMUM_ADJUSTMENT_MULTIPLIER].readUInt32LE(0);
    const maxAdjustmentMultiplier = adjustmentMultiplierRange[TransitionAdjustmentMultiplierRange.MAXIMUM_ADJUSTMENT_MULTIPLIER].readUInt32LE(0);

    this.activeTransition = {
      iid: iid,

      transitionStartMillis: startTimeMillis,

      id1: id1.toString("hex"),
      transitionStartBuffer: startTime.toString("hex"),
      id3: id3.toString("hex"),

      brightnessCharacteristicIID: adjustmentIID,
      brightnessAdjustmentRange: {
        minBrightnessValue: minAdjustmentMultiplier,
        maxBrightnessValue: maxAdjustmentMultiplier,
      },

      transitionCurve: transitionCurve,

      updateInterval: updateInterval,
      notifyIntervalThreshold: notifyIntervalThreshold,
    };

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
      debug("[%s] Ambient lightning was renewed.", this.lightbulb.displayName);
    } else {
      debug("[%s] Ambient lightning was enabled.", this.lightbulb.displayName);
    }

    this.handleActiveTransitionUpdated();

    return tlv.encode(
      TransitionControlTypes.COLOR_TEMPERATURE, this.buildTransitionControlResponseBuffer(0),
    ).toString("base64");
  }

}
