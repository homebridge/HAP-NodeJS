import {Characteristic, CharacteristicEventTypes, SerializedCharacteristic} from './Characteristic';
import {clone} from './util/clone';
import {EventEmitter} from './EventEmitter';
import {IdentifierCache} from './model/IdentifierCache';
import {CharacteristicChange, CharacteristicValue, HapService, Nullable, ToHAPOptions, WithUUID,} from '../types';
import * as HomeKitTypes from './gen';

export interface SerializedService {
  displayName: string,
  UUID: string,
  subtype?: string,

  hiddenService?: boolean,
  primaryService?: boolean,

  characteristics: SerializedCharacteristic[],
  optionalCharacteristics?: SerializedCharacteristic[],
}

export type ServiceId = string; // string with the format: UUID + (subtype | "")

export enum ServiceEventTypes {
  CHARACTERISTIC_CHANGE = "characteristic-change",
  SERVICE_CONFIGURATION_CHANGE = "service-configurationChange",
}

export type ServiceConfigurationChange = {
  service: Service;
};

type Events = {
  [ServiceEventTypes.CHARACTERISTIC_CHANGE]: (change: CharacteristicChange) => void;
  [ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE]: (change: ServiceConfigurationChange) => void;
}

/**
 * @deprecated Use ServiceEventTypes instead
 */
export type EventService = ServiceEventTypes.CHARACTERISTIC_CHANGE | ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE;

/**
 * Service represents a set of grouped values necessary to provide a logical function. For instance, a
 * "Door Lock Mechanism" service might contain two values, one for the "desired lock state" and one for the
 * "current lock state". A particular Service is distinguished from others by its "type", which is a UUID.
 * HomeKit provides a set of known Service UUIDs defined in HomeKit.ts along with a corresponding
 * concrete subclass that you can instantiate directly to setup the necessary values. These natively-supported
 * Services are expected to contain a particular set of Characteristics.
 *
 * Unlike Characteristics, where you cannot have two Characteristics with the same UUID in the same Service,
 * you can actually have multiple Services with the same UUID in a single Accessory. For instance, imagine
 * a Garage Door Opener with both a "security light" and a "backlight" for the display. Each light could be
 * a "Lightbulb" Service with the same UUID. To account for this situation, we define an extra "subtype"
 * property on Service, that can be a string or other string-convertible object that uniquely identifies the
 * Service among its peers in an Accessory. For instance, you might have `service1.subtype = 'security_light'`
 * for one and `service2.subtype = 'backlight'` for the other.
 *
 * You can also define custom Services by providing your own UUID for the type that you generate yourself.
 * Custom Services can contain an arbitrary set of Characteristics, but Siri will likely not be able to
 * work with these.
 *
 * @event 'characteristic-change' => function({characteristic, oldValue, newValue, context}) { }
 *        Emitted after a change in the value of one of our Characteristics has occurred.
 */
export class Service extends EventEmitter<Events> {

  static AccessControl: typeof HomeKitTypes.Generated.AccessControl;
  static AccessoryInformation: typeof HomeKitTypes.Generated.AccessoryInformation;
  static AirPurifier: typeof HomeKitTypes.Generated.AirPurifier;
  static AirQualitySensor: typeof HomeKitTypes.Generated.AirQualitySensor;
  static AudioStreamManagement: typeof HomeKitTypes.Remote.AudioStreamManagement;
  static BatteryService: typeof HomeKitTypes.Generated.BatteryService;
  static BridgeConfiguration: typeof HomeKitTypes.Bridged.BridgeConfiguration;
  static BridgingState: typeof HomeKitTypes.Bridged.BridgingState;
  static CameraControl: typeof HomeKitTypes.Bridged.CameraControl;
  static CameraRTPStreamManagement: typeof HomeKitTypes.Generated.CameraRTPStreamManagement;
  static CarbonDioxideSensor: typeof HomeKitTypes.Generated.CarbonDioxideSensor;
  static CarbonMonoxideSensor: typeof HomeKitTypes.Generated.CarbonMonoxideSensor;
  static ContactSensor: typeof HomeKitTypes.Generated.ContactSensor;
  static DataStreamTransportManagement: typeof HomeKitTypes.DataStream.DataStreamTransportManagement;
  static Door: typeof HomeKitTypes.Generated.Door;
  static Doorbell: typeof HomeKitTypes.Generated.Doorbell;
  static Fan: typeof HomeKitTypes.Generated.Fan;
  static Fanv2: typeof HomeKitTypes.Generated.Fanv2;
  static Faucet: typeof HomeKitTypes.Generated.Faucet;
  static FilterMaintenance: typeof HomeKitTypes.Generated.FilterMaintenance;
  static GarageDoorOpener: typeof HomeKitTypes.Generated.GarageDoorOpener;
  static HeaterCooler: typeof HomeKitTypes.Generated.HeaterCooler;
  static HumidifierDehumidifier: typeof HomeKitTypes.Generated.HumidifierDehumidifier;
  static HumiditySensor: typeof HomeKitTypes.Generated.HumiditySensor;
  static InputSource: typeof HomeKitTypes.TV.InputSource;
  static IrrigationSystem: typeof HomeKitTypes.Generated.IrrigationSystem;
  /**
   * @deprecated Removed in iOS 11. Use ServiceLabel instead.
   */
  static Label: typeof HomeKitTypes.Generated.ServiceLabel;
  static LeakSensor: typeof HomeKitTypes.Generated.LeakSensor;
  static LightSensor: typeof HomeKitTypes.Generated.LightSensor;
  static Lightbulb: typeof HomeKitTypes.Generated.Lightbulb;
  static LockManagement: typeof HomeKitTypes.Generated.LockManagement;
  static LockMechanism: typeof HomeKitTypes.Generated.LockMechanism;
  static Microphone: typeof HomeKitTypes.Generated.Microphone;
  static MotionSensor: typeof HomeKitTypes.Generated.MotionSensor;
  static OccupancySensor: typeof HomeKitTypes.Generated.OccupancySensor;
  static Outlet: typeof HomeKitTypes.Generated.Outlet;
  static Pairing: typeof HomeKitTypes.Bridged.Pairing;
  static ProtocolInformation: typeof HomeKitTypes.Bridged.ProtocolInformation;
  static Relay: typeof HomeKitTypes.Bridged.Relay;
  static SecuritySystem: typeof HomeKitTypes.Generated.SecuritySystem;
  static ServiceLabel: typeof HomeKitTypes.Generated.ServiceLabel;
  static Siri: typeof HomeKitTypes.Remote.Siri;
  static Slat: typeof HomeKitTypes.Generated.Slat;
  static SmokeSensor: typeof HomeKitTypes.Generated.SmokeSensor;
  static SmartSpeaker: typeof HomeKitTypes.Generated.SmartSpeaker;
  static Speaker: typeof HomeKitTypes.Generated.Speaker;
  static StatefulProgrammableSwitch: typeof HomeKitTypes.Bridged.StatefulProgrammableSwitch;
  static StatelessProgrammableSwitch: typeof HomeKitTypes.Generated.StatelessProgrammableSwitch;
  static Switch: typeof HomeKitTypes.Generated.Switch;
  static TargetControl: typeof HomeKitTypes.Remote.TargetControl;
  static TargetControlManagement: typeof HomeKitTypes.Remote.TargetControlManagement;
  static Television: typeof HomeKitTypes.TV.Television;
  static TelevisionSpeaker: typeof HomeKitTypes.TV.TelevisionSpeaker;
  static TemperatureSensor: typeof HomeKitTypes.Generated.TemperatureSensor;
  static Thermostat: typeof HomeKitTypes.Generated.Thermostat;
  static TimeInformation: typeof HomeKitTypes.Bridged.TimeInformation;
  static TunneledBTLEAccessoryService: typeof HomeKitTypes.Bridged.TunneledBTLEAccessoryService;
  static Valve: typeof HomeKitTypes.Generated.Valve;
  static Window: typeof HomeKitTypes.Generated.Window;
  static WindowCovering: typeof HomeKitTypes.Generated.WindowCovering;
  static CameraOperatingMode: typeof HomeKitTypes.Generated.CameraOperatingMode;
  static CameraEventRecordingManagement: typeof HomeKitTypes.Generated.CameraEventRecordingManagement;
  static WiFiRouter: typeof HomeKitTypes.Generated.WiFiRouter;
  static WiFiSatellite: typeof HomeKitTypes.Generated.WiFiSatellite;
  static PowerManagement: typeof HomeKitTypes.Generated.PowerManagement;
  static TransferTransportManagement: typeof HomeKitTypes.Generated.TransferTransportManagement;

  // NOTICE: when adding/changing properties, remember to possibly adjust the serialize/deserialize functions
  iid: Nullable<number> = null; // assigned later by our containing Accessory
  name: Nullable<string> = null;
  characteristics: Characteristic[] = [];
  optionalCharacteristics: Characteristic[] = [];
  isHiddenService: boolean = false;
  isPrimaryService: boolean = false; // do not write to this directly
  linkedServices: Service[] = [];

  constructor(public displayName: string = "", public UUID: string, public subtype?: string) {
    super();
    if (!UUID) throw new Error("Services must be created with a valid UUID.");

    // every service has an optional Characteristic.Name property - we'll set it to our displayName
    // if one was given
    // if you don't provide a display name, some HomeKit apps may choose to hide the device.
    if (displayName) {
      // create the characteristic if necessary
      var nameCharacteristic =
        this.getCharacteristic(Characteristic.Name) ||
        this.addCharacteristic(Characteristic.Name);

      nameCharacteristic.setValue(displayName);
    }
  }

  /**
   * Returns an id which uniquely identifies an service on the associated accessory.
   * The serviceId is a concatenation of the UUID for the service (defined by HAP) and the subtype (could be empty)
   * which is programmatically defined by the programmer.
   *
   * @returns the serviceId
   */
  getServiceId(): ServiceId {
    return this.UUID + (this.subtype || "");
  }

  addCharacteristic = (characteristic: typeof Characteristic | Characteristic, ...constructorArgs: any[]) => {
    // characteristic might be a constructor like `Characteristic.Brightness` instead of an instance
    // of Characteristic. Coerce if necessary.
    if (typeof characteristic === 'function') {
      characteristic = new characteristic(constructorArgs[0], constructorArgs[1], constructorArgs[2]) as Characteristic;
    }
    // check for UUID conflict
    for (var index in this.characteristics) {
      var existing = this.characteristics[index];
      if (existing.UUID === characteristic.UUID) {
        if (characteristic.UUID === '00000052-0000-1000-8000-0026BB765291') {
          //This is a special workaround for the Firmware Revision characteristic.
          return existing;
        }
        throw new Error("Cannot add a Characteristic with the same UUID as another Characteristic in this Service: " + existing.UUID);
      }
    }

    // listen for changes in characteristics and bubble them up
    characteristic.on(CharacteristicEventTypes.CHANGE, (change: CharacteristicChange) => {
      // make a new object with the relevant characteristic added, and bubble it up
      this.emit(ServiceEventTypes.CHARACTERISTIC_CHANGE, clone(change, { characteristic: characteristic }));
    });

    this.characteristics.push(characteristic);

    this.emit(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ service: this }));

    return characteristic;
  }

  /**
   * Sets this service as the new primary service.
   * Any currently active primary service will be reset to be not primary.
   * This will happen immediately, if the service was already added to an accessory, or later
   * when the service gets added to an accessory.
   *
   * @param isPrimary {boolean} - optional boolean (default true) if the service should be the primary service
   */
  setPrimaryService = (isPrimary: boolean = true) => {
    this.isPrimaryService = isPrimary;
    this.emit(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ service: this }));
  };

  /**
   * Marks the service as hidden
   *
   * @param isHidden {boolean} - optional boolean (default true) if the service should be marked hidden
   */
  setHiddenService = (isHidden: boolean = true) => {
    this.isHiddenService = isHidden;
    this.emit(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ service: this }));
  }

//Allows setting other services that link to this one.
  addLinkedService = (newLinkedService: Service) => {
    //TODO: Add a check if the service is on the same accessory.
    if (!this.linkedServices.includes(newLinkedService))
      this.linkedServices.push(newLinkedService);
    this.emit(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ service: this }));
  }

  removeLinkedService = (oldLinkedService: Service) => {
    //TODO: Add a check if the service is on the same accessory.
    if (this.linkedServices.includes(oldLinkedService))
      this.linkedServices.splice(this.linkedServices.indexOf(oldLinkedService), 1);
    this.emit(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ service: this }));
  }

  removeCharacteristic = (characteristic: Characteristic) => {
    var targetCharacteristicIndex;

    for (var index in this.characteristics) {
      var existingCharacteristic = this.characteristics[index];

      if (existingCharacteristic === characteristic) {
        targetCharacteristicIndex = index;
        break;
      }
    }

    if (targetCharacteristicIndex) {
      this.characteristics.splice(Number.parseInt(targetCharacteristicIndex), 1);
      characteristic.removeAllListeners();

      this.emit(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ service: this }));
    }
  }

  getCharacteristic = <T extends WithUUID<typeof Characteristic>>(name: string | T) => {

    // returns a characteristic object from the service
    // If  Service.prototype.getCharacteristic(Characteristic.Type)  does not find the characteristic,
    // but the type is in optionalCharacteristics, it adds the characteristic.type to the service and returns it.

    var index, characteristic: Characteristic;
    for (index in this.characteristics) {
      characteristic = this.characteristics[index] as Characteristic;
      if (typeof name === 'string' && characteristic.displayName === name) {
        return characteristic;
      } else if (typeof name === 'function' && ((characteristic instanceof name) || (name.UUID === characteristic.UUID))) {
        return characteristic;
      }
    }
    if (typeof name === 'function') {
      for (index in this.optionalCharacteristics) {
        characteristic = this.optionalCharacteristics[index];
        if ((characteristic instanceof name) || (name.UUID === characteristic.UUID)) {
          return this.addCharacteristic(name);
        }
      }
      //Not found in optional Characteristics. Adding anyway, but warning about it if it isn't the Name.
      if (name.UUID !== Characteristic.Name.UUID) {
        console.warn("HAP Warning: Characteristic %s not in required or optional characteristics for service %s. Adding anyway.", name.UUID, this.UUID);
        return this.addCharacteristic(name);
      }
    }
  }

  testCharacteristic = <T extends WithUUID<typeof Characteristic>>(name: string | T) => {
    // checks for the existence of a characteristic object in the service
    var index, characteristic;
    for (index in this.characteristics) {
      characteristic = this.characteristics[index];
      if (typeof name === 'string' && characteristic.displayName === name) {
        return true;
      } else if (typeof name === 'function' && ((characteristic instanceof name) || (name.UUID === characteristic.UUID))) {
        return true;
      }
    }
    return false;
  }

  setCharacteristic = <T extends WithUUID<typeof Characteristic>>(name: string | T, value: CharacteristicValue) => {
    this.getCharacteristic(name)!.setValue(value);
    return this; // for chaining
  }

// A function to only updating the remote value, but not firing the 'set' event.
  updateCharacteristic = <T extends WithUUID<typeof Characteristic>>(name: string | T, value: CharacteristicValue) => {
    this.getCharacteristic(name)!.updateValue(value);
    return this;
  }

  addOptionalCharacteristic = (characteristic: Characteristic | typeof Characteristic) => {
    // characteristic might be a constructor like `Characteristic.Brightness` instead of an instance
    // of Characteristic. Coerce if necessary.
    if (typeof characteristic === 'function') {
      // @ts-ignore we are dealing with predefined characteristics here
      characteristic = new characteristic() as Characteristic;
    }

    this.optionalCharacteristics.push(characteristic);
  }

  replaceCharacteristicsFromService(service: Service) {
    if (this.UUID !== service.UUID) {
      throw new Error(`Incompatible services. Tried replacing characteristics of ${this.UUID} with characteristics from ${service.UUID}`);
    }

    const foreignCharacteristics: Record<string, Characteristic> = {}; // index foreign characteristics by UUID
    service.characteristics.forEach(characteristic => foreignCharacteristics[characteristic.UUID] = characteristic);

    this.characteristics.forEach(characteristic => {
      const foreignCharacteristic = foreignCharacteristics[characteristic.UUID];
      if (foreignCharacteristic) {
        delete foreignCharacteristics[characteristic.UUID];

        characteristic.props = foreignCharacteristic.props;
        characteristic.accessRestrictedToAdmins = foreignCharacteristic.accessRestrictedToAdmins;
        characteristic.updateValue(foreignCharacteristic.value);

        const getListeners = foreignCharacteristic.listeners(CharacteristicEventTypes.GET);
        getListeners.forEach(listener => characteristic.addListener(CharacteristicEventTypes.GET, listener));

        const setListeners = foreignCharacteristic.listeners(CharacteristicEventTypes.SET);
        setListeners.forEach(listener => characteristic.addListener(CharacteristicEventTypes.SET, listener));
      }
    });

    // add all additional characteristics which where not present already
    Object.values(foreignCharacteristics).forEach(characteristic => this.addCharacteristic(characteristic));
  }

  getCharacteristicByIID = (iid: number) => {
    for (var index in this.characteristics) {
      var characteristic = this.characteristics[index];
      if (characteristic.iid === iid)
        return characteristic;
    }
  }

  _assignIDs = (identifierCache: IdentifierCache, accessoryName: string, baseIID: number = 0) => {
    // the Accessory Information service must have a (reserved by IdentifierCache) ID of 1
    if (this.UUID === '0000003E-0000-1000-8000-0026BB765291') {
      this.iid = 1;
    } else {
      // assign our own ID based on our UUID
      this.iid = baseIID + identifierCache.getIID(accessoryName, this.UUID, this.subtype);
    }

    // assign IIDs to our Characteristics
    for (var index in this.characteristics) {
      var characteristic = this.characteristics[index];
      characteristic._assignID(identifierCache, accessoryName, this.UUID, this.subtype);
    }
  }

  /**
   * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
   */
  toHAP = (opt?: ToHAPOptions) => {

    var characteristicsHAP = [];

    for (var index in this.characteristics) {
      var characteristic = this.characteristics[index];
      characteristicsHAP.push(characteristic.toHAP(opt));
    }

    const hap: Partial<HapService> = {
      iid: this.iid!,
      type: this.UUID,
      characteristics: characteristicsHAP
    };

    if (this.isPrimaryService) {
      hap['primary'] = this.isPrimaryService;
    }

    if (this.isHiddenService) {
      hap['hidden'] = this.isHiddenService;
    }

    if (this.linkedServices.length > 0) {
      hap['linked'] = [];
      for (var index in this.linkedServices) {
        var otherService = this.linkedServices[index];
        hap['linked'].push(otherService.iid!);
      }
    }

    return hap as HapService;
  }

  _setupCharacteristic = (characteristic: Characteristic) => {
    // listen for changes in characteristics and bubble them up
    characteristic.on(CharacteristicEventTypes.CHANGE, (change: CharacteristicChange) => {
      // make a new object with the relevant characteristic added, and bubble it up
      this.emit(ServiceEventTypes.CHARACTERISTIC_CHANGE, clone(change, { characteristic: characteristic }));
    });
  }

  _sideloadCharacteristics = (targetCharacteristics: Characteristic[]) => {
    for (var index in targetCharacteristics) {
      var target = targetCharacteristics[index];
      this._setupCharacteristic(target);
    }

    this.characteristics = targetCharacteristics.slice();
  }

  static serialize = (service: Service): SerializedService => {
    return {
      displayName: service.displayName,
      UUID: service.UUID,
      subtype: service.subtype,

      hiddenService: service.isHiddenService,
      primaryService: service.isPrimaryService,

      characteristics: service.characteristics.map(characteristic => Characteristic.serialize(characteristic)),
      optionalCharacteristics: service.optionalCharacteristics.map(characteristic => Characteristic.serialize(characteristic)),
    };
  };

  static deserialize = (json: SerializedService): Service => {
    const service = new Service(json.displayName, json.UUID, json.subtype);

    service.isHiddenService = !!json.hiddenService;
    service.isPrimaryService = !!json.primaryService;

    const characteristics = json.characteristics.map(serialized => Characteristic.deserialize(serialized));
    service._sideloadCharacteristics(characteristics);

    if (json.optionalCharacteristics) {
      service.optionalCharacteristics = json.optionalCharacteristics.map(serialized => Characteristic.deserialize(serialized));
    }

    return service;
  };

}
