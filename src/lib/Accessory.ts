import { MDNSServerOptions } from "@homebridge/ciao";
import crypto from 'crypto';
import createDebug from 'debug';
import assert from "assert";

import * as uuid from './util/uuid';
import { clone } from './util/clone';
import { SerializedService, Service, ServiceConfigurationChange, ServiceEventTypes, ServiceId } from './Service';
import { Access, Characteristic, CharacteristicEventTypes, CharacteristicSetCallback, Perms } from './Characteristic';
import { Advertiser, AdvertiserEvent } from './Advertiser';
import { CharacteristicsWriteRequest, Codes, HAPServer, HAPServerEventTypes, Status } from './HAPServer';
import { AccessoryInfo, PairingInformation, PermissionTypes } from './model/AccessoryInfo';
import { IdentifierCache } from './model/IdentifierCache';
import {
  CharacteristicChange,
  CharacteristicData,
  CharacteristicValue, MacAddress,
  NodeCallback,
  Nullable,
  PairingsCallback,
  SessionIdentifier,
  ToHAPOptions,
  VoidCallback,
  WithUUID,
} from '../types';
// noinspection JSDeprecatedSymbols
import { LegacyCameraSource, LegacyCameraSourceAdapter, StreamController } from './camera';
import { EventEmitter } from './EventEmitter';
import { Session } from "./util/eventedhttp";
import {
  CameraController,
  CameraControllerOptions,
  Controller,
  ControllerConstructor,
  ControllerServiceMap, ControllerType,
  isSerializableController,
} from "./controller";
import {
  CameraEventRecordingManagement,
  CameraOperatingMode,
  CameraRTPStreamManagement,
} from "./gen/HomeKit";
import { ControllerStorage } from "./model/ControllerStorage";

const debug = createDebug('HAP-NodeJS:Accessory');
const MAX_ACCESSORIES = 149; // Maximum number of bridged accessories per bridge.
const MAX_SERVICES = 100;

// Known category values. Category is a hint to iOS clients about what "type" of Accessory this represents, for UI only.
export const enum Categories {
  // noinspection JSUnusedGlobalSymbols
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
  SECURITY_SYSTEM = 11, //Added to conform to HAP naming
  DOOR = 12,
  WINDOW = 13,
  WINDOW_COVERING = 14,
  PROGRAMMABLE_SWITCH = 15,
  RANGE_EXTENDER = 16,
  CAMERA = 17,
  IP_CAMERA = 17, //Added to conform to HAP naming
  VIDEO_DOORBELL = 18,
  AIR_PURIFIER = 19,
  AIR_HEATER = 20,
  AIR_CONDITIONER = 21,
  AIR_HUMIDIFIER = 22,
  AIR_DEHUMIDIFIER = 23,
  APPLE_TV = 24,
  HOMEPOD = 25,
  SPEAKER = 26,
  AIRPORT = 27,
  SPRINKLER = 28,
  FAUCET = 29,
  SHOWER_HEAD = 30,
  TELEVISION = 31,
  TARGET_CONTROLLER = 32, // Remote Control
  ROUTER = 33,
  AUDIO_RECEIVER = 34,
  TV_SET_TOP_BOX = 35,
  TV_STREAMING_STICK = 36,
}

export interface SerializedAccessory {
  displayName: string,
  UUID: string,
  lastKnownUsername?: MacAddress,
  category: Categories,

  services: SerializedService[],
  linkedServices?: Record<ServiceId, ServiceId[]>,
  controllers?: SerializedControllerContext[],
}

export interface SerializedControllerContext {
  type: ControllerType,
  services: SerializedServiceMap,
}

export type SerializedServiceMap = Record<string, ServiceId>; // maps controller defined name (from the ControllerServiceMap) to serviceId

export interface ControllerContext {
  controller: Controller
  serviceMap: ControllerServiceMap,
}


export const enum AccessoryEventTypes {
  IDENTIFY = "identify",
  LISTENING = "listening",
  SERVICE_CONFIGURATION_CHANGE = "service-configurationChange",
  SERVICE_CHARACTERISTIC_CHANGE = "service-characteristic-change",
  PAIRED = "paired",
  UNPAIRED = "unpaired",
}

type Events = {
  identify: (paired:boolean, cb: VoidCallback) => void;
  listening: (port: number) => void;
  "service-configurationChange": VoidCallback;
  "service-characteristic-change": (change: ServiceCharacteristicChange) => void;
  [AccessoryEventTypes.PAIRED]: () => void;
  [AccessoryEventTypes.UNPAIRED]: () => void;
}

/**
 * @deprecated Use AccessoryEventTypes instead
 */
export type EventAccessory = "identify" | "listening" | "service-configurationChange" | "service-characteristic-change";

export type CharacteristicEvents = Record<string, any>;

export interface PublishInfo {
  username: MacAddress;
  pincode: string;
  category?: Categories;
  setupID?: string;
  port?: number;
  mdns?: MDNSServerOptions;
}

export type ServiceCharacteristicChange = CharacteristicChange &  {
  accessory: Accessory;
  service: Service;
};

export const enum ResourceTypes {
  IMAGE = 'image',
}

export type Resource = {
  'aid'?: number;
  'image-height': number;
  'image-width': number;
  'resource-type': ResourceTypes;
}

const enum WriteRequestState {
  REGULAR_REQUEST,
  TIMED_WRITE_AUTHENTICATED,
  TIMED_WRITE_REJECTED
}

type IdentifyCallback = VoidCallback;
type PairCallback = VoidCallback;
type AddPairingCallback = PairingsCallback<void>;
type RemovePairingCallback = PairingsCallback<void>;
type ListPairingsCallback = PairingsCallback<PairingInformation[]>;
type HandleAccessoriesCallback = NodeCallback<{ accessories: any[] }>;
type HandleGetCharacteristicsCallback = NodeCallback<CharacteristicData[]>;
type HandleSetCharacteristicsCallback = NodeCallback<CharacteristicData[]>;

/**
 * Accessory is a virtual HomeKit device. It can publish an associated HAP server for iOS devices to communicate
 * with - or it can run behind another "Bridge" Accessory server.
 *
 * Bridged Accessories in this implementation must have a UUID that is unique among all other Accessories that
 * are hosted by the Bridge. This UUID must be "stable" and unchanging, even when the server is restarted. This
 * is required so that the Bridge can provide consistent "Accessory IDs" (aid) and "Instance IDs" (iid) for all
 * Accessories, Services, and Characteristics for iOS clients to reference later.
 *
 * @event 'identify' => function(paired, callback(err)) { }
 *        Emitted when an iOS device wishes for this Accessory to identify itself. If `paired` is false, then
 *        this device is currently browsing for Accessories in the system-provided "Add Accessory" screen. If
 *        `paired` is true, then this is a device that has already paired with us. Note that if `paired` is true,
 *        listening for this event is a shortcut for the underlying mechanism of setting the `Identify` Characteristic:
 *        `getService(Service.AccessoryInformation).getCharacteristic(Characteristic.Identify).on('set', ...)`
 *        You must call the callback for identification to be successful.
 *
 * @event 'service-characteristic-change' => function({service, characteristic, oldValue, newValue, context}) { }
 *        Emitted after a change in the value of one of the provided Service's Characteristics.
 */
export class Accessory extends EventEmitter<Events> {

  /**
   * @deprecated Please use the Categories const enum above. Scheduled to be removed in 2021-06.
   */
  // @ts-ignore
  static Categories = Categories;

  // NOTICE: when adding/changing properties, remember to possibly adjust the serialize/deserialize functions
  aid: Nullable<number> = null; // assigned by us in assignIDs() or by a Bridge
  _isBridge: boolean = false; // true if we are a Bridge (creating a new instance of the Bridge subclass sets this to true)
  bridged: boolean = false; // true if we are hosted "behind" a Bridge Accessory
  bridge?: Accessory; // if accessory is bridged, this property points to the bridge which bridges this accessory
  bridgedAccessories: Accessory[] = []; // If we are a Bridge, these are the Accessories we are bridging
  reachable: boolean = true;
  lastKnownUsername?: MacAddress;
  category: Categories = Categories.OTHER;
  services: Service[] = [];
  private primaryService?: Service;
  shouldPurgeUnusedIDs: boolean = true; // Purge unused ids by default
  private controllers: Record<ControllerType, ControllerContext> = {};
  private serializedControllers?: Record<ControllerType, ControllerServiceMap>; // store uninitialized controller data after a Accessory.deserialize call
  private activeCameraController?: CameraController;

  _accessoryInfo?: Nullable<AccessoryInfo>;
  _setupID: Nullable<string> = null;
  _identifierCache?: Nullable<IdentifierCache>;
  controllerStorage: ControllerStorage = new ControllerStorage(this);
  _advertiser?: Advertiser;
  _server?: HAPServer;
  _setupURI?: string;

  constructor(public displayName: string, public UUID: string) {
    super();
    assert(displayName, "Accessories must be created with a non-empty displayName.");
    assert(Buffer.from(displayName, "utf8").length <= 63, "Accessory displayName cannot be longer than 63 bytes!");
    assert(UUID, "Accessories must be created with a valid UUID.")
    assert(uuid.isValid(UUID), "UUID '" + UUID + "' is not a valid UUID. Try using the provided 'generateUUID' function to create a valid UUID from any arbitrary string, like a serial number.");

    // create our initial "Accessory Information" Service that all Accessories are expected to have
    this.addService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, displayName);

    // sign up for when iOS attempts to "set" the Identify characteristic - this means a paired device wishes
    // for us to identify ourselves (as opposed to an unpaired device - that case is handled by HAPServer 'identify' event)
    this.getService(Service.AccessoryInformation)!
      .getCharacteristic(Characteristic.Identify)!
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (value) {
          const paired = true;
          this._identificationRequest(paired, callback);
        }
      });
  }

  _identificationRequest = (paired: boolean, callback: CharacteristicSetCallback) => {
    debug("[%s] Identification request", this.displayName);

    if (this.listeners(AccessoryEventTypes.IDENTIFY).length > 0) {
      // allow implementors to identify this Accessory in whatever way is appropriate, and pass along
      // the standard callback for completion.
      this.emit(AccessoryEventTypes.IDENTIFY, paired, callback);
    } else {
      debug("[%s] Identification request ignored; no listeners to 'identify' event", this.displayName);
      callback();
    }
  }

  addService = (serviceParam: Service | typeof Service, ...constructorArgs: any[]) => {
    // service might be a constructor like `Service.AccessoryInformation` instead of an instance
    // of Service. Coerce if necessary.
    const service: Service = typeof serviceParam === 'function'
        ? new serviceParam(constructorArgs[0], constructorArgs[1], constructorArgs[2])
        : serviceParam;

    // check for UUID+subtype conflict
    for (var index in this.services) {
      var existing = this.services[index];
      if (existing.UUID === service.UUID) {
        // OK we have two Services with the same UUID. Check that each defines a `subtype` property and that each is unique.
        if (!service.subtype)
          throw new Error("Cannot add a Service with the same UUID '" + existing.UUID + "' as another Service in this Accessory without also defining a unique 'subtype' property.");

        if (service.subtype === existing.subtype)
          throw new Error("Cannot add a Service with the same UUID '" + existing.UUID + "' and subtype '" + existing.subtype + "' as another Service in this Accessory.");
      }
    }

    if (this.services.length >= MAX_SERVICES) {
      throw new Error("Cannot add more than " + MAX_SERVICES + " services to a single accessory!");
    }

    this.services.push(service);

    if (service.isPrimaryService) { // check if a primary service was added
      if (this.primaryService !== undefined) {
        this.primaryService.isPrimaryService = false;
      }

      this.primaryService = service;
    }

    if (!this.bridged) {
      this._updateConfiguration();
    } else {
      this.emit(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({accessory:this, service:service}));
    }

    service.on(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, (change: ServiceConfigurationChange) => {
      if (!service.isPrimaryService && service === this.primaryService) {
        // service changed form primary to non primary service
        this.primaryService = undefined;
      } else if (service.isPrimaryService && service !== this.primaryService) {
        // service changed from non primary to primary service
        if (this.primaryService !== undefined) {
          this.primaryService.isPrimaryService = false;
        }

        this.primaryService = service;
      }

      if (!this.bridged) {
        this._updateConfiguration();
      } else {
        this.emit(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({accessory:this, service:service}));
      }
    });

    // listen for changes in characteristics and bubble them up
    service.on(ServiceEventTypes.CHARACTERISTIC_CHANGE, (change: CharacteristicChange) => {
      this.emit(AccessoryEventTypes.SERVICE_CHARACTERISTIC_CHANGE, clone(change, {service:service as Service}));

      // if we're not bridged, when we'll want to process this event through our HAPServer
      if (!this.bridged)
        this._handleCharacteristicChange(clone(change, {accessory:this, service:service as Service}));

    });

    return service;
  }

  /**
   * @deprecated use {@link Service.setPrimaryService} directly
   */
  setPrimaryService = (service: Service) => {
    service.setPrimaryService();
  };

  removeService = (service: Service) => {
    const index = this.services.indexOf(service);

    if (index >= 0) {
      this.services.splice(index, 1);

      if (this.primaryService === service) { // check if we are removing out primary service
        this.primaryService = undefined;
      }

      if (!this.bridged) {
        this._updateConfiguration();
      } else {
        this.emit(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({accessory:this, service:service}));
      }

      service.removeAllListeners();
    }
  }

  getService = <T extends WithUUID<typeof Service>>(name: string | T) => {
    for (var index in this.services) {
      var service = this.services[index];

      if (typeof name === 'string' && (service.displayName === name || service.name === name || service.subtype === name))
        return service;
      else if (typeof name === 'function' && ((service instanceof name) || (name.UUID === service.UUID)))
        return service;
    }
  }

  getServiceById<T extends WithUUID<typeof Service>>(uuid: string | T, subType: string): Service | undefined {
    for (const index in this.services) {
      const service = this.services[index];

      if (typeof uuid === "string" && (service.displayName === uuid || service.name === uuid) && service.subtype === subType) {
        return service;
      } else if (typeof uuid === "function" && ((service instanceof uuid) || (uuid.UUID === service.UUID)) && service.subtype === subType) {
        return service;
      }
    }

    return undefined;
  }

  /**
   * Returns the bridging accessory if this accessory is bridged.
   * Otherwise returns itself.
   *
   * @returns the primary accessory
   */
  getPrimaryAccessory = (): Accessory => {
    return this.bridged? this.bridge!: this;
  }

  updateReachability = (reachable: boolean) => {
    if (!this.bridged)
      throw new Error("Cannot update reachability on non-bridged accessory!");
    this.reachable = reachable;

    debug('Reachability update is no longer being supported.');
  }

  addBridgedAccessory = (accessory: Accessory, deferUpdate: boolean = false) => {
    if (accessory._isBridge)
      throw new Error("Cannot Bridge another Bridge!");

    // check for UUID conflict
    for (var index in this.bridgedAccessories) {
      var existing = this.bridgedAccessories[index];
      if (existing.UUID === accessory.UUID)
        throw new Error("Cannot add a bridged Accessory with the same UUID as another bridged Accessory: " + existing.UUID);
    }

    // A bridge too far...
    if (this.bridgedAccessories.length >= MAX_ACCESSORIES) {
      throw new Error("Cannot Bridge more than " + MAX_ACCESSORIES + " Accessories");
    }

    // listen for changes in ANY characteristics of ANY services on this Accessory
    accessory.on(AccessoryEventTypes.SERVICE_CHARACTERISTIC_CHANGE, (change: ServiceCharacteristicChange) => {
      this._handleCharacteristicChange(clone(change, {accessory:accessory}));
    });

    accessory.on(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, () => {
      this._updateConfiguration();
    });

    accessory.bridged = true;
    accessory.bridge = this;

    this.bridgedAccessories.push(accessory);

    this.controllerStorage.linkAccessory(accessory); // init controllers of bridged accessory

    if(!deferUpdate) {
      this._updateConfiguration();
    }

    return accessory;
  }

  addBridgedAccessories = (accessories: Accessory[]) => {
    for (var index in accessories) {
      var accessory = accessories[index];
      this.addBridgedAccessory(accessory, true);
    }

    this._updateConfiguration();
  }

  removeBridgedAccessory = (accessory: Accessory, deferUpdate: boolean) => {
    if (accessory._isBridge)
      throw new Error("Cannot Bridge another Bridge!");

    var foundMatchAccessory = false;
    // check for UUID conflict
    for (var index in this.bridgedAccessories) {
      var existing = this.bridgedAccessories[index];
      if (existing.UUID === accessory.UUID) {
        foundMatchAccessory = true;
        this.bridgedAccessories.splice(Number.parseInt(index), 1);
        break;
      }
    }

    if (!foundMatchAccessory)
      throw new Error("Cannot find the bridged Accessory to remove.");

    accessory.removeAllListeners();

    if(!deferUpdate) {
      this._updateConfiguration();
    }
  }

  removeBridgedAccessories = (accessories: Accessory[]) => {
    for (var index in accessories) {
      var accessory = accessories[index];
      this.removeBridgedAccessory(accessory, true);
    }

    this._updateConfiguration();
  }

  removeAllBridgedAccessories = () => {
    for (var i = this.bridgedAccessories.length - 1; i >= 0; i --) {
      this.removeBridgedAccessory(this.bridgedAccessories[i], true);
    }
    this._updateConfiguration();
  }

  getCharacteristicByIID = (iid: number) => {
    for (var index in this.services) {
      var service = this.services[index];
      var characteristic = service.getCharacteristicByIID(iid);
      if (characteristic) return characteristic;
    }
  }

  getBridgedAccessoryByAID = (aid: number) => {
    for (var index in this.bridgedAccessories) {
      var accessory = this.bridgedAccessories[index];
      if (accessory.aid === aid) return accessory;
    }
  }

  findCharacteristic = (aid: number, iid: number) => {

    // if aid === 1, the accessory is us (because we are the server), otherwise find it among our bridged
    // accessories (if any)
    var accessory = (aid === 1) ? this : this.getBridgedAccessoryByAID(aid);

    return accessory && accessory.getCharacteristicByIID(iid);
  }

  /**
   * Method is used to configure an old style CameraSource.
   * The CameraSource API was fully replaced by the new Controller API used by {@link CameraController}.
   * The {@link CameraStreamingDelegate} used by the CameraController is the equivalent to the old CameraSource.
   *
   * The new Controller API is much more refined and robust way of "grouping" services together.
   * It especially is intended to fully support serialization/deserialization to/from persistent storage.
   * This feature is also gained when using the old style CameraSource API.
   * The {@link CameraStreamingDelegate} improves on the overall camera API though and provides some reworked
   * type definitions and a refined callback interface to better signal errors to the requesting HomeKit device.
   * It is advised to update to it.
   *
   * Full backwards compatibility is currently maintained. A legacy CameraSource will be wrapped into an Adapter.
   * All legacy StreamControllers in the "streamControllers" property will be replaced by CameraRTPManagement instances.
   * Any services in the "services" property which are one of the following are ignored:
   *     - CameraRTPStreamManagement
   *     - CameraOperatingMode
   *     - CameraEventRecordingManagement
   *
   * @param cameraSource {LegacyCameraSource}
   * @deprecated please refer to the new {@see CameraController} API and {@link configureController}
   */
  configureCameraSource(cameraSource: LegacyCameraSource): CameraController {
    if (cameraSource.streamControllers.length === 0) {
      throw new Error("Malformed legacy CameraSource. Did not expose any StreamControllers!");
    }

    const options = cameraSource.streamControllers[0].options; // grab options from one of the StreamControllers
    const cameraControllerOptions: CameraControllerOptions = { // build new options set
      cameraStreamCount: cameraSource.streamControllers.length,
      streamingOptions: options,
      delegate: new LegacyCameraSourceAdapter(cameraSource),
    };

    const cameraController = new CameraController(cameraControllerOptions, true); // create CameraController in legacy mode
    this.configureController(cameraController);

    // we try here to be as good as possibly of keeping current behaviour
    cameraSource.services.forEach(service => {
      if (service.UUID === CameraRTPStreamManagement.UUID || service.UUID === CameraOperatingMode.UUID
          || service.UUID === CameraEventRecordingManagement.UUID) {
        return; // ignore those services, as they get replaced by the RTPStreamManagement
      }

      // all other services get added. We can't really control possibly linking to any of those ignored services
      // so this is really only half baked stuff.
      this.addService(service);
    });

    // replace stream controllers; basically only to still support the "forceStop" call
    cameraSource.streamControllers = cameraController.streamManagements as StreamController[];

    return cameraController; // return the reference for the controller (maybe this could be useful?)
  }

  /**
   * This method is used to setup a new Controller for this accessory. See {@see Controller} for a more detailed
   * explanation what a Controller is and what it is capable of.
   *
   * The controller can be passed as an instance of the class or as a constructor (without any necessary parameters)
   * for a new Controller.
   * Only one Controller of a given {@link ControllerType} can be configured for a given Accessory.
   *
   * When called, it will be checked if there are any services and persistent data the Controller (for the given
   * {@link ControllerType}) can be restored from. Otherwise the Controller will be created with new services.
   *
   *
   * @param controllerConstructor {Controller | ControllerConstructor}
   */
  configureController(controllerConstructor: Controller | ControllerConstructor) {
    const controller = typeof controllerConstructor === "function"
        ? new controllerConstructor() // any custom constructor arguments should be passed before using .bind(...)
        : controllerConstructor;

    if (this.controllers[controller.controllerType]) {
      throw new Error(`A Controller with the type '${controller.controllerType}' was already added to the accessory ${this.displayName}`);
    }

    const savedServiceMap = this.serializedControllers && this.serializedControllers[controller.controllerType];
    let serviceMap: ControllerServiceMap;

    if (savedServiceMap) { // we found data to restore from
      const clonedServiceMap = clone(savedServiceMap);
      const updatedServiceMap = controller.initWithServices(savedServiceMap); // init controller with existing services
      serviceMap = updatedServiceMap || savedServiceMap; // initWithServices could return a updated serviceMap, otherwise just use the existing one

      if (updatedServiceMap) { // controller returned a ServiceMap and thus signaled a updated set of services
        // clonedServiceMap is altered by this method, should not be touched again after this call (for the future people)
        this.handleUpdatedControllerServiceMap(clonedServiceMap, updatedServiceMap);
      }

      controller.configureServices(); // let the controller setup all its handlers

      // remove serialized data from our dictionary:
      delete this.serializedControllers![controller.controllerType];
      if (Object.entries(this.serializedControllers!).length === 0) {
        this.serializedControllers = undefined;
      }
    } else {
      serviceMap = controller.constructServices(); // let the controller create his services
      controller.configureServices(); // let the controller setup all its handlers

      Object.values(serviceMap).forEach(service => {
        if (service) {
          this.addService(service);
        }
      });
    }


    // --- init handlers and setup context ---
    const context: ControllerContext = {
      controller: controller,
      serviceMap: serviceMap,
    };

    if (isSerializableController(controller)) {
      this.controllerStorage.trackController(controller);
    }

    if (controller.handleFactoryReset) { // if the controller implements handleFactoryReset, setup event handlers for this controller
      this.getPrimaryAccessory().on(AccessoryEventTypes.UNPAIRED, () => {
        controller.handleFactoryReset!();

        if (isSerializableController(controller)) { // we force a purge here
          this.controllerStorage.purgeControllerData(controller);
        }
      });
    }

    this.controllers[controller.controllerType] = context;

    if (controller instanceof CameraController) { // save CameraController for Snapshot handling
      this.activeCameraController = controller;
    }
  }

  private handleUpdatedControllerServiceMap(originalServiceMap: ControllerServiceMap, updatedServiceMap: ControllerServiceMap) {
    updatedServiceMap = clone(updatedServiceMap); // clone it so we can alter it

    Object.keys(originalServiceMap).forEach(name => { // this loop removed any services contained in both ServiceMaps
      const service = originalServiceMap[name];
      const updatedService = updatedServiceMap[name];

      if (service && updatedService) { // we check all names contained in both ServiceMaps for changes
        delete originalServiceMap[name]; // delete from original ServiceMap so it will only contain deleted services at the end
        delete updatedServiceMap[name]; // delete from updated ServiceMap so it will only contain added services at the end

        if (service !== updatedService) {
          this.removeService(service);
          this.addService(updatedService);
        }
      }
    });

    // now originalServiceMap contains only deleted services and updateServiceMap only added services

    Object.values(originalServiceMap).forEach(service => {
      if (service) {
        this.removeService(service);
      }
    });
    Object.values(updatedServiceMap).forEach(service => {
      if (service) {
        this.addService(service);
      }
    });
  }

  setupURI = () => {
    if (this._setupURI) {
      return this._setupURI;
    }

    var buffer = Buffer.alloc(8);
    var setupCode = this._accessoryInfo && parseInt(this._accessoryInfo.pincode.replace(/-/g, ''), 10);

    var value_low = setupCode!;
    var value_high = this._accessoryInfo && this._accessoryInfo.category >> 1;

    value_low |= 1 << 28; // Supports IP;

    buffer.writeUInt32BE(value_low, 4);

    if (this._accessoryInfo && this._accessoryInfo.category & 1) {
      buffer[4] = buffer[4] | 1 << 7;
    }

    buffer.writeUInt32BE(value_high!, 0);

    var encodedPayload = (buffer.readUInt32BE(4) + (buffer.readUInt32BE(0) * Math.pow(2, 32))).toString(36).toUpperCase();

    if (encodedPayload.length != 9) {
      for (var i = 0; i <= 9 - encodedPayload.length; i++) {
        encodedPayload = "0" + encodedPayload;
      }
    }

    this._setupURI = "X-HM://" + encodedPayload + this._setupID;
    return this._setupURI;
  }

  /**
   * This method is called right before the accessory is published. It should be used to check for common
   * mistakes in Accessory structured, which may lead to HomeKit rejecting the accessory when pairing.
   * If it is called on a bridge it will call this method for all bridged accessories.
   */
  private validateAccessory() {
    const service = this.getService(Service.AccessoryInformation);
    if (!service) {
      console.log("HAP-NodeJS WARNING: The accessory '" + this.displayName + "' is getting published without a AccessoryInformation service. " +
        "This might prevent the accessory from being added to the Home app or leading to the accessory being unresponsive!");
    } else {
      const checkValue = (name: string, value?: any) => {
        if (!value) {
          console.log("HAP-NodeJS WARNING: The accessory '" + this.displayName + "' is getting published with the characteristic '" + name + "'" +
            " (of the AccessoryInformation service) not having a value set. " +
            "This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
        }
      };

      const manufacturer = service.getCharacteristic(Characteristic.Manufacturer).value;
      const model = service.getCharacteristic(Characteristic.Model).value;
      const serialNumber = service.getCharacteristic(Characteristic.SerialNumber).value;
      const firmwareRevision = service.getCharacteristic(Characteristic.FirmwareRevision).value;
      const name = service.getCharacteristic(Characteristic.Name).value;

      checkValue("Manufacturer", manufacturer);
      checkValue("Model", model);
      checkValue("SerialNumber", serialNumber);
      checkValue("FirmwareRevision", firmwareRevision);
      checkValue("Name", name);
    }

    if (this.bridged) {
      this.bridgedAccessories.forEach(accessory => accessory.validateAccessory());
    }
  }

  /**
   * Assigns aid/iid to ourselves, any Accessories we are bridging, and all associated Services+Characteristics. Uses
   * the provided identifierCache to keep IDs stable.
   */
  _assignIDs = (identifierCache: IdentifierCache) => {

    // if we are responsible for our own identifierCache, start the expiration process
    // also check weather we want to have an expiration process
    if (this._identifierCache && this.shouldPurgeUnusedIDs) {
      this._identifierCache.startTrackingUsage();
    }

    if (this.bridged) {
      // This Accessory is bridged, so it must have an aid > 1. Use the provided identifierCache to
      // fetch or assign one based on our UUID.
      this.aid = identifierCache.getAID(this.UUID)
    } else {
      // Since this Accessory is the server (as opposed to any Accessories that may be bridged behind us),
      // we must have aid = 1
      this.aid = 1;
    }

    for (var index in this.services) {
      var service = this.services[index];
      if (this._isBridge) {
        service._assignIDs(identifierCache, this.UUID, 2000000000);
      } else {
        service._assignIDs(identifierCache, this.UUID);
      }
    }

    // now assign IDs for any Accessories we are bridging
    for (var index in this.bridgedAccessories) {
      var accessory = this.bridgedAccessories[index];

      accessory._assignIDs(identifierCache);
    }

    // expire any now-unused cache keys (for Accessories, Services, or Characteristics
    // that have been removed since the last call to assignIDs())
    if (this._identifierCache) {
      //Check weather we want to purge the unused ids
      if (this.shouldPurgeUnusedIDs)
        this._identifierCache.stopTrackingUsageAndExpireUnused();
      //Save in case we have new ones
      this._identifierCache.save();
    }
  }

  disableUnusedIDPurge = () => {
    this.shouldPurgeUnusedIDs = false;
  }

  enableUnusedIDPurge = () => {
    this.shouldPurgeUnusedIDs = true;
  }

  /**
   * Manually purge the unused ids if you like, comes handy
   * when you have disabled auto purge so you can do it manually
   */
  purgeUnusedIDs = () => {
    //Cache the state of the purge mechanisam and set it to true
    var oldValue = this.shouldPurgeUnusedIDs;
    this.shouldPurgeUnusedIDs = true;

    //Reassign all ids
    this._assignIDs(this._identifierCache!);

    //Revert back the purge mechanisam state
    this.shouldPurgeUnusedIDs = oldValue;
  }

  /**
   * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
   */
  toHAP = (opt?: ToHAPOptions) => {

    var servicesHAP = [];

    for (var index in this.services) {
      var service = this.services[index];
      servicesHAP.push(service.toHAP(opt));
    }

    var accessoriesHAP = [{
      aid: this.aid,
      services: servicesHAP
    }];

    // now add any Accessories we are bridging
    for (var index in this.bridgedAccessories) {
      var accessory = this.bridgedAccessories[index];
      var bridgedAccessoryHAP = accessory.toHAP(opt);

      // bridgedAccessoryHAP is an array of accessories with one item - extract it
      // and add it to our own array
      accessoriesHAP.push(bridgedAccessoryHAP[0])
    }

    return accessoriesHAP;
  }

  /**
   * Publishes this Accessory on the local network for iOS clients to communicate with.
   *
   * @param {Object} info - Required info for publishing.
   * @param {string} info.username - The "username" (formatted as a MAC address - like "CC:22:3D:E3:CE:F6") of
   *                                this Accessory. Must be globally unique from all Accessories on your local network.
   * @param {string} info.pincode - The 8-digit pincode for clients to use when pairing this Accessory. Must be formatted
   *                               as a string like "031-45-154".
   * @param {string} info.category - One of the values of the Accessory.Category enum, like Accessory.Category.SWITCH.
   *                                This is a hint to iOS clients about what "type" of Accessory this represents, so
   *                                that for instance an appropriate icon can be drawn for the user while adding a
   *                                new Accessory.
   */
  publish = (info: PublishInfo, allowInsecureRequest?: boolean) => {
    // TODO maybe directly enqueue the method call on nextTick (could solve most out of order constructions)

    let service = this.getService(Service.ProtocolInformation);
    if (!service) {
      service = this.addService(Service.ProtocolInformation) // add the protocol information service to the primary accessory
    }
    service.setCharacteristic(Characteristic.Version, Advertiser.protocolVersionService);

    if (this.lastKnownUsername && this.lastKnownUsername !== info.username) { // username changed since last publish
      Accessory.cleanupAccessoryData(this.lastKnownUsername); // delete old Accessory data
    }

    // adding some identifying material to our displayName
    this.displayName = this.displayName + " " + crypto.createHash('sha512')
      .update(info.username, 'utf8')
      .digest('hex').slice(0, 4).toUpperCase();
    this.getService(Service.AccessoryInformation)!.updateCharacteristic(Characteristic.Name, this.displayName);

    // attempt to load existing AccessoryInfo from disk
    this._accessoryInfo = AccessoryInfo.load(info.username);

    // if we don't have one, create a new one.
    if (!this._accessoryInfo) {
      debug("[%s] Creating new AccessoryInfo for our HAP server", this.displayName);
      this._accessoryInfo = AccessoryInfo.create(info.username);
    }

    if (info.setupID) {
      this._setupID = info.setupID;
    } else if (this._accessoryInfo.setupID === undefined || this._accessoryInfo.setupID === "") {
      this._setupID = this._generateSetupID();
    } else {
      this._setupID = this._accessoryInfo.setupID;
    }

    this._accessoryInfo.setupID = this._setupID;

    // make sure we have up-to-date values in AccessoryInfo, then save it in case they changed (or if we just created it)
    this._accessoryInfo.displayName = this.displayName;
    this._accessoryInfo.model = this.getService(Service.AccessoryInformation)!.getCharacteristic(Characteristic.Model).value as string;
    this._accessoryInfo.category = info.category || Categories.OTHER;
    this._accessoryInfo.pincode = info.pincode;
    this._accessoryInfo.save();

    // create our IdentifierCache so we can provide clients with stable aid/iid's
    this._identifierCache = IdentifierCache.load(info.username);

    // if we don't have one, create a new one.
    if (!this._identifierCache) {
      debug("[%s] Creating new IdentifierCache", this.displayName);
      this._identifierCache = new IdentifierCache(info.username);
    }

    //If it's bridge and there are not accessories already assigned to the bridge
    //probably purge is not needed since it's going to delete all the ids
    //of accessories that might be added later. Usefull when dynamically adding
    //accessories.
    if (this._isBridge && this.bridgedAccessories.length == 0) {
      this.disableUnusedIDPurge();
      this.controllerStorage.purgeUnidentifiedAccessoryData = false;
    }

    // assign aid/iid
    this._assignIDs(this._identifierCache);

    this.controllerStorage.load(info.username); // initializing controller data

    // get our accessory information in HAP format and determine if our configuration (that is, our
    // Accessories/Services/Characteristics) has changed since the last time we were published. make
    // sure to omit actual values since these are not part of the "configuration".
    var config = this.toHAP({omitValues:true});

    // now convert it into a hash code and check it against the last one we made, if we have one
    var shasum = crypto.createHash('sha1');
    shasum.update(JSON.stringify(config));
    var configHash = shasum.digest('hex');

    if (configHash !== this._accessoryInfo.configHash) {

      // our configuration has changed! we'll need to bump our config version number
      this._accessoryInfo.configVersion++;
      this._accessoryInfo.configHash = configHash;
      this._accessoryInfo.save();
    }

    this.validateAccessory();

    // create our Advertiser which broadcasts our presence over mdns
    this._advertiser = new Advertiser(this._accessoryInfo, info.mdns);
    this._advertiser.on(AdvertiserEvent.UPDATED_NAME, name => {
      this.displayName = name;
      if (this._accessoryInfo) {
        this._accessoryInfo.displayName = name;
        this._accessoryInfo.save();
      }

      // bonjour service name MUST match the name in the accessory information service
      this.getService(Service.AccessoryInformation)!
        .updateCharacteristic(Characteristic.Name, name);
    });

    // create our HAP server which handles all communication between iOS devices and us
    this._server = new HAPServer(this._accessoryInfo);
    this._server.allowInsecureRequest = !!allowInsecureRequest;
    this._server.on(HAPServerEventTypes.LISTENING, this._onListening.bind(this));
    this._server.on(HAPServerEventTypes.IDENTIFY, this._handleIdentify.bind(this));
    this._server.on(HAPServerEventTypes.PAIR, this._handlePair.bind(this));
    this._server.on(HAPServerEventTypes.ADD_PAIRING, this._handleAddPairing.bind(this));
    this._server.on(HAPServerEventTypes.REMOVE_PAIRING, this._handleRemovePairing.bind(this));
    this._server.on(HAPServerEventTypes.LIST_PAIRINGS, this._handleListPairings.bind(this));
    this._server.on(HAPServerEventTypes.ACCESSORIES, this._handleAccessories.bind(this));
    this._server.on(HAPServerEventTypes.GET_CHARACTERISTICS, this._handleGetCharacteristics.bind(this));
    this._server.on(HAPServerEventTypes.SET_CHARACTERISTICS, this._handleSetCharacteristics.bind(this));
    this._server.on(HAPServerEventTypes.SESSION_CLOSE, this._handleSessionClose.bind(this));
    this._server.on(HAPServerEventTypes.REQUEST_RESOURCE, this._handleResource.bind(this));

    this._server.listen(info.port || 0);
  }

  /**
   * Removes this Accessory from the local network
   * Accessory object will no longer valid after invoking this method
   * Trying to invoke publish() on the object will result undefined behavior
   */
  destroy = () => {
    this.unpublish();

    if (this._accessoryInfo) {
      Accessory.cleanupAccessoryData(this._accessoryInfo.username);

      this._accessoryInfo = undefined;
      this._identifierCache = undefined;
      this.controllerStorage = new ControllerStorage(this);
    }
  }

  unpublish = () => {
    if (this._server) {
      this._server.stop();
      this._server = undefined;
    }
    if (this._advertiser) {
      this._advertiser.shutdown();
      this._advertiser = undefined;
    }
  }

  _updateConfiguration = () => {
    if (this._advertiser && this._advertiser.isServiceCreated()) {
      // get our accessory information in HAP format and determine if our configuration (that is, our
      // Accessories/Services/Characteristics) has changed since the last time we were published. make
      // sure to omit actual values since these are not part of the "configuration".
      var config = this.toHAP({omitValues:true});

      // now convert it into a hash code and check it against the last one we made, if we have one
      var shasum = crypto.createHash('sha1');
      shasum.update(JSON.stringify(config));
      var configHash = shasum.digest('hex');

      if (this._accessoryInfo && configHash !== this._accessoryInfo.configHash) {

        // our configuration has changed! we'll need to bump our config version number
        this._accessoryInfo.configVersion++;
        this._accessoryInfo.configHash = configHash;
        this._accessoryInfo.save();
      }

      // update our advertisement so HomeKit on iOS can pickup new accessory
      this._advertiser.updateAdvertisement();
    }
  }

  _onListening = (port: number) => {
    assert(this._advertiser, "Advertiser wasn't created at onListening!");
    // the HAP server is listening, so we can now start advertising our presence.
    this._advertiser!.initAdvertiser(port);
    this._advertiser!.startAdvertising();
    this.emit(AccessoryEventTypes.LISTENING, port);
  }

// Called when an unpaired client wishes for us to identify ourself
  _handleIdentify = (callback: IdentifyCallback) => {
    this._identificationRequest(false, callback);
  }

// Called when HAPServer has completed the pairing process with a client
  _handlePair = (username: string, publicKey: Buffer, callback: PairCallback) => {

    debug("[%s] Paired with client %s", this.displayName, username);

    this._accessoryInfo && this._accessoryInfo.addPairedClient(username, publicKey, PermissionTypes.ADMIN);
    this._accessoryInfo && this._accessoryInfo.save();

    // update our advertisement so it can pick up on the paired status of AccessoryInfo
    this._advertiser && this._advertiser.updateAdvertisement();

    callback();

    this.emit(AccessoryEventTypes.PAIRED);
  }

// called when a controller adds an additional pairing
  _handleAddPairing = (controller: Session, username: string, publicKey: Buffer, permission: PermissionTypes, callback: AddPairingCallback) => {
    if (!this._accessoryInfo) {
      callback(Codes.UNAVAILABLE);
      return;
    }

    if (!this._accessoryInfo.hasAdminPermissions(controller.username!)) {
      callback(Codes.AUTHENTICATION);
      return;
    }

    const existingKey = this._accessoryInfo.getClientPublicKey(username);
    if (existingKey) {
      if (existingKey.toString() !== publicKey.toString()) {
        callback(Codes.UNKNOWN);
        return;
      }

      this._accessoryInfo.updatePermission(username, permission);
    } else {
      this._accessoryInfo.addPairedClient(username, publicKey, permission);
    }

    this._accessoryInfo.save();
    // there should be no need to update advertisement
    callback(0);
  };

  _handleRemovePairing = (controller: Session, username: string, callback: RemovePairingCallback) => {
    if (!this._accessoryInfo) {
      callback(Codes.UNAVAILABLE);
      return;
    }

    if (!this._accessoryInfo.hasAdminPermissions(controller.username!)) {
      callback(Codes.AUTHENTICATION);
      return;
    }

    this._accessoryInfo.removePairedClient(controller, username);
    this._accessoryInfo.save();

    callback(0); // first of all ensure the pairing is removed before we advertise availability again

    if (!this._accessoryInfo.paired()) {
      this._advertiser && this._advertiser.updateAdvertisement();
      this.emit(AccessoryEventTypes.UNPAIRED);
    }
  };

  _handleListPairings = (controller: Session, callback: ListPairingsCallback) => {
    if (!this._accessoryInfo) {
      callback(Codes.UNAVAILABLE);
      return;
    }

    if (!this._accessoryInfo.hasAdminPermissions(controller.username!)) {
      callback(Codes.AUTHENTICATION);
      return;
    }

    callback(0, this._accessoryInfo.listPairings());
  };

// Called when an iOS client wishes to know all about our accessory via JSON payload
  _handleAccessories = (callback: HandleAccessoriesCallback) => {

    // make sure our aid/iid's are all assigned
    this._assignIDs(this._identifierCache!);

    // build out our JSON payload and call the callback
    callback(null, {
      accessories: this.toHAP() // array of Accessory HAP
    });
  }

// Called when an iOS client wishes to query the state of one or more characteristics, like "door open?", "light on?", etc.
  _handleGetCharacteristics = (data: CharacteristicData[], events: CharacteristicEvents, callback: HandleGetCharacteristicsCallback, remote: boolean, session: Session) => {

    // build up our array of responses to the characteristics requested asynchronously
    var characteristics: CharacteristicData[] = [];
    var statusKey = remote ? 's' : 'status';
    var valueKey = remote ? 'v' : 'value';

    data.forEach((characteristicData) => {
      var aid = characteristicData.aid;
      var iid = characteristicData.iid;

      var includeEvent = characteristicData.e;

      var characteristic = this.findCharacteristic(characteristicData.aid, characteristicData.iid);

      if (!characteristic) {
        debug('[%s] Could not find a Characteristic with aid of %s and iid of %s', this.displayName, characteristicData.aid, characteristicData.iid);
        var response: any = {
          aid: aid,
          iid: iid
        };
        response[statusKey] = Status.SERVICE_COMMUNICATION_FAILURE; // generic error status
        characteristics.push(response);

        // have we collected all responses yet?
        if (characteristics.length === data.length)
          callback(null, characteristics);

        return;
      }

      if (!characteristic.props.perms.includes(Perms.PAIRED_READ)) { // check if we are allowed to read from this characteristic
        debug('[%s] Tried reading from Characteristic which does not allow reading (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid);
        const response: any = {
          aid: aid,
          iid: iid
        };
        response[statusKey] = Status.WRITE_ONLY_CHARACTERISTIC;
        characteristics.push(response);

        if (characteristics.length === data.length) {
          callback(null, characteristics);
        }
        return;
      }

      if (characteristic.props.adminOnlyAccess && characteristic.props.adminOnlyAccess.includes(Access.READ)) {
        let verifiable = true;
        if (!session || !session.username || !this._accessoryInfo) {
          verifiable = false;
          debug('[%s] Could not verify admin permissions for Characteristic which requires admin permissions for reading (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid)
        }

        if (!verifiable || !this._accessoryInfo!.hasAdminPermissions(session.username!)) {
          const response: any = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = Status.INSUFFICIENT_PRIVILEGES;
          characteristics.push(response);

          if (characteristics.length === data.length)
            callback(null, characteristics);
          return;
        }
      }

      // Found the Characteristic! Get the value!
      debug('[%s] Getting value for Characteristic "%s"', this.displayName, characteristic.displayName);

      // we want to remember "who" made this request, so that we don't send them an event notification
      // about any changes that occurred as a result of the request. For instance, if after querying
      // the current value of a characteristic, the value turns out to be different than the previously
      // cached Characteristic value, an internal 'change' event will be emitted which will cause us to
      // notify all connected clients about that new value. But this client is about to get the new value
      // anyway, so we don't want to notify it twice.
      var context = events;

      // set the value and wait for success
      characteristic.getValue((err, value) => {
        if (err) {
          debug('[%s] Error getting value for Characteristic "%s": %s', this.displayName, characteristic!.displayName, err.message);
          var response: any = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = hapStatus(err);
          characteristics.push(response);
        } else {
          debug('[%s] Got Characteristic "%s" value: %s', this.displayName, characteristic!.displayName, value);

          var response: any = {
            aid: aid,
            iid: iid
          };
          response[valueKey] = value;

          if (includeEvent) {
            var eventName = aid + '.' + iid;
            response['e'] = (events[eventName] === true);
          }

          // compose the response and add it to the list
          characteristics.push(response);
        }

        // have we collected all responses yet?
        if (characteristics.length === data.length)
          callback(null, characteristics);

      }, context, session? session.sessionID: undefined);

    });
  }

// Called when an iOS client wishes to change the state of this accessory - like opening a door, or turning on a light.
// Or, to subscribe to change events for a particular Characteristic.
  _handleSetCharacteristics = (writeRequest: CharacteristicsWriteRequest, events: CharacteristicEvents, callback: HandleSetCharacteristicsCallback, remote: boolean, session: Session) => {
    const data = writeRequest.characteristics;

    // data is an array of characteristics and values like this:
    // [ { aid: 1, iid: 8, value: true, ev: true } ]

    debug("[%s] Processing characteristic set: %s", this.displayName, JSON.stringify(data));

    let writeState: WriteRequestState = WriteRequestState.REGULAR_REQUEST;
    if (writeRequest.pid !== undefined) { // check for timed writes
      if (session.timedWritePid === writeRequest.pid) {
        writeState = WriteRequestState.TIMED_WRITE_AUTHENTICATED;
        clearTimeout(session.timedWriteTimeout!);
        session.timedWritePid = undefined;
        session.timedWriteTimeout = undefined;

        debug("[%s] Timed write request got acknowledged for pid %d", this.displayName, writeRequest.pid);
      } else {
        writeState = WriteRequestState.TIMED_WRITE_REJECTED;
        debug("[%s] TTL for timed write request has probably expired for pid %d", this.displayName, writeRequest.pid);
      }
    }

    // build up our array of responses to the characteristics requested asynchronously
    var characteristics: CharacteristicData[] = [];

    data.forEach((characteristicData) => {
      var aid = characteristicData.aid;
      var iid = characteristicData.iid;
      var value = remote ? characteristicData.v : characteristicData.value;
      var ev = remote ? characteristicData.e : characteristicData.ev;
      var includeValue = characteristicData.r || false;

      var statusKey = remote ? 's' : 'status';

      var characteristic = this.findCharacteristic(aid, iid);

      if (!characteristic) {
        debug('[%s] Could not find a Characteristic with iid of %s and aid of %s', this.displayName, characteristicData.aid, characteristicData.iid);
        var response: any = {
          aid: aid,
          iid: iid
        };
        response[statusKey] = Status.SERVICE_COMMUNICATION_FAILURE; // generic error status
        characteristics.push(response);

        // have we collected all responses yet?
        if (characteristics.length === data.length)
          callback(null, characteristics);

        return;
      }

      if (writeState === WriteRequestState.TIMED_WRITE_REJECTED) {
        const response: any = {
          aid: aid,
          iid: iid
        };
        response[statusKey] = Status.INVALID_VALUE_IN_REQUEST;
        characteristics.push(response);

        if (characteristics.length === data.length)
          callback(null, characteristics);
        return;
      }

      // we want to remember "who" initiated this change, so that we don't send them an event notification
      // about the change they just made. We do this by leveraging the arbitrary "context" object supported
      // by Characteristic and passed on to the corresponding 'change' events bubbled up from Characteristic
      // through Service and Accessory. We'll assign it to the events object since it essentially represents
      // the connection requesting the change.
      var context = events;

      // if "ev" is present, that means we need to register or unregister this client for change events for
      // this characteristic.
      if (typeof ev !== 'undefined') {
        if (!characteristic.props.perms.includes(Perms.NOTIFY)) { // check if notify is allowed for this characteristic
          debug('[%s] Tried enabling notifications for Characteristic which does not allow notify (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid);
          const response: any = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = Status.NOTIFICATION_NOT_SUPPORTED;
          characteristics.push(response);

          if (characteristics.length === data.length) {
            callback(null, characteristics);
          }
          return;
        }

        if (characteristic.props.adminOnlyAccess && characteristic.props.adminOnlyAccess.includes(Access.NOTIFY)) {
          let verifiable = true;
          if (!session || !session.username || !this._accessoryInfo) {
            verifiable = false;
            debug('[%s] Could not verify admin permissions for Characteristic which requires admin permissions for notify (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid)
          }

          if (!verifiable || !this._accessoryInfo!.hasAdminPermissions(session.username!)) {
            const response: any = {
              aid: aid,
              iid: iid
            };
            response[statusKey] = Status.INSUFFICIENT_PRIVILEGES;
            characteristics.push(response);

            if (characteristics.length === data.length)
              callback(null, characteristics);
            return;
          }
        }

        debug('[%s] %s Characteristic "%s" for events', this.displayName, ev ? "Registering" : "Unregistering", characteristic.displayName);

        // store event registrations in the supplied "events" dict which is associated with the connection making
        // the request.
        var eventName = aid + '.' + iid;

        if (ev === true && events[eventName] != true) {
          events[eventName] = true; // value is arbitrary, just needs to be non-falsey
          characteristic.subscribe();
        }

        if (ev === false && events[eventName] != undefined) {
          characteristic.unsubscribe();
          delete events[eventName]; // unsubscribe by deleting name from dict
        }
      }

      // Found the characteristic - set the value if there is one
      if (typeof value !== 'undefined') {
        if (!characteristic.props.perms.includes(Perms.PAIRED_WRITE)) { // check if write is allowed for this characteristic
          debug('[%s] Tried writing to Characteristic which does not allow writing (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid);
          const response: any = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = Status.READ_ONLY_CHARACTERISTIC;
          characteristics.push(response);

          if (characteristics.length === data.length) {
            callback(null, characteristics);
          }
          return;
        }

        if (characteristic.props.adminOnlyAccess && characteristic.props.adminOnlyAccess.includes(Access.WRITE)) {
          let verifiable = true;
          if (!session || !session.username || !this._accessoryInfo) {
            verifiable = false;
            debug('[%s] Could not verify admin permissions for Characteristic which requires admin permissions for write (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid)
          }

          if (!verifiable || !this._accessoryInfo!.hasAdminPermissions(session.username!)) {
            const response: any = {
              aid: aid,
              iid: iid
            };
            response[statusKey] = Status.INSUFFICIENT_PRIVILEGES;
            characteristics.push(response);

            if (characteristics.length === data.length)
              callback(null, characteristics);
            return;
          }
        }

        if (characteristic.props.perms.includes(Perms.TIMED_WRITE) && writeState !== WriteRequestState.TIMED_WRITE_AUTHENTICATED) {
          debug('[%s] Tried writing to a timed write only Characteristic without properly preparing (iid of %s and aid of %s)', this.displayName, characteristicData.aid, characteristicData.iid);
          const response: any = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = Status.INVALID_VALUE_IN_REQUEST;
          characteristics.push(response);

          if (characteristics.length === data.length)
            callback(null, characteristics);
          return;
        }

        debug('[%s] Setting Characteristic "%s" to value %s', this.displayName, characteristic.displayName, value);

        // set the value and wait for success
        characteristic.setValue(value, (err) => {

          if (err) {
            debug('[%s] Error setting Characteristic "%s" to value %s: ', this.displayName, characteristic!.displayName, value, err.message);

            var response: any = {
              aid: aid,
              iid: iid
            };
            response[statusKey] = hapStatus(err);
            characteristics.push(response);
          } else {
            var response: any = {
              aid: aid,
              iid: iid
            };
            response[statusKey] = 0;

            if (includeValue)
              response['value'] = characteristic!.value;

            characteristics.push(response);
          }

          // have we collected all responses yet?
          if (characteristics.length === data.length)
            callback(null, characteristics);

        }, context, session? session.sessionID: undefined);

      } else {
        // no value to set, so we're done (success)
        var response: any = {
          aid: aid,
          iid: iid
        };
        response[statusKey] = 0;
        characteristics.push(response);

        // have we collected all responses yet?
        if (characteristics.length === data.length)
          callback(null, characteristics);
      }

    });
  }

  _handleResource(data: Resource, callback: NodeCallback<Buffer>): void {
    if (data["resource-type"] === ResourceTypes.IMAGE) {
      const aid = data.aid; // aid is optionally supplied by HomeKit (for example when camera is bridged, multiple cams, etc)

      let controller: CameraController | undefined = undefined;
      if (aid) {
        if (this.aid === aid && this.activeCameraController) { // bridge is probably not a camera but it is possible in theory
          controller = this.activeCameraController;
        } else {
          const accessory = this.getBridgedAccessoryByAID(aid);
          if (accessory && accessory.activeCameraController) {
            controller = accessory.activeCameraController;
          }
        }
      } else if (this.activeCameraController) { // aid was not supplied, check if this accessory is a camera
        controller = this.activeCameraController;
      }

      if (!controller) {
        callback(new Error("resource not found"));
        return;
      }

      controller.handleSnapshotRequest(data["image-height"], data["image-width"], callback);
      return;
    }

    callback(new Error('unsupported image type: ' + data["resource-type"]));
  }

  _handleSessionClose = (sessionID: SessionIdentifier, events: CharacteristicEvents) => {
    if (this.activeCameraController) {
      this.activeCameraController.handleCloseConnection(sessionID);
    }

    this._unsubscribeEvents(events);
  }

  _unsubscribeEvents = (events: CharacteristicEvents) => {
    for (var key in events) {
      if (key.indexOf('.') !== -1) {
        try {
          var id = key.split('.');
          var aid = Number.parseInt(id[0]);
          var iid = Number.parseInt(id[1]);

          var characteristic = this.findCharacteristic(aid, iid);
          if (characteristic) {
            characteristic.unsubscribe();
          }
        } catch (e) {
        }
      }
    }
  }

// Called internally above when a change was detected in one of our hosted Characteristics somewhere in our hierarchy.
  _handleCharacteristicChange = (change: ServiceCharacteristicChange) => {
    if (!this._server)
      return; // we're not running a HAPServer, so there's no one to notify about this event

    var data = {
      characteristics: [{
        aid: change.accessory.aid,
        iid: change.characteristic.iid,
        value: change.newValue
      }]
    };

    // name for this event that corresponds to what we stored when the client signed up (in handleSetCharacteristics)
    var eventName = change.accessory.aid + '.' + change.characteristic.iid;

    // pull the events object associated with the original connection (if any) that initiated the change request,
    // which we assigned in handleGetCharacteristics/handleSetCharacteristics.
    var excludeEvents = change.context;

    // pass it along to notifyClients() so that it can omit the connection where events === excludeEvents.
    this._server.notifyClients(eventName, data, excludeEvents);
  }

  _setupService = (service: Service) => {
    service.on(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, () => {
      if (!this.bridged) {
        this._updateConfiguration();
      } else {
        this.emit(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({accessory:this, service }));
      }
    });

    // listen for changes in characteristics and bubble them up
    service.on(ServiceEventTypes.CHARACTERISTIC_CHANGE, (change: any) => {
      this.emit(AccessoryEventTypes.SERVICE_CHARACTERISTIC_CHANGE, clone(change, {service }));

      // if we're not bridged, when we'll want to process this event through our HAPServer
      if (!this.bridged)
        this._handleCharacteristicChange(clone(change, {accessory:this, service }));

    });
  }

  _sideloadServices = (targetServices: Service[]) => {
    for (var index in targetServices) {
      var target = targetServices[index];
      this._setupService(target);
    }

    this.services = targetServices.slice();

    // Fix Identify
    this
      .getService(Service.AccessoryInformation)!
      .getCharacteristic(Characteristic.Identify)!
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (value) {
          var paired = true;
          this._identificationRequest(paired, callback);
        }
      });
  }

  _generateSetupID = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const bytes = crypto.randomBytes(4);
    let setupID = '';

    for (var i = 0; i < 4; i++) {
      var index = bytes.readUInt8(i) % 26;
      setupID += chars.charAt(index);
    }

    return setupID;
  }

  // serialization and deserialization functions, mainly designed for homebridge to create a json copy to store on disk
  public static serialize(accessory: Accessory): SerializedAccessory {
    const json: SerializedAccessory = {
      displayName: accessory.displayName,
      UUID: accessory.UUID,
      lastKnownUsername: accessory._accessoryInfo? accessory._accessoryInfo.username: undefined,
      category: accessory.category,

      services: [],
    };

    const linkedServices: Record<ServiceId, ServiceId[]> = {};
    let hasLinkedServices = false;

    accessory.services.forEach(service => {
      json.services.push(Service.serialize(service));

      const linkedServicesPresentation: ServiceId[] = [];
      service.linkedServices.forEach(linkedService => {
        linkedServicesPresentation.push(linkedService.getServiceId());
      });
      if (linkedServicesPresentation.length > 0) {
        linkedServices[service.getServiceId()] = linkedServicesPresentation;
        hasLinkedServices = true;
      }
    });

    if (hasLinkedServices) {
      json.linkedServices = linkedServices;
    }

    const controllers: SerializedControllerContext[] = [];

    // save controllers
    Object.entries(accessory.controllers).forEach(([key, context]: [string, ControllerContext])  => {
      controllers.push({
        type: context.controller.controllerType,
        services: Accessory.serializeServiceMap(context.serviceMap),
      });
    });

    // also save controller which didn't get initialized (could lead to service duplication if we throw that data away)
    accessory.serializedControllers && Object.entries(accessory.serializedControllers).forEach(([type, serviceMap]) => {
      controllers.push({
        type: type,
        services: Accessory.serializeServiceMap(serviceMap),
      });
    });

    if (controllers.length > 0) {
      json.controllers = controllers;
    }

    return json;
  }

  public static deserialize(json: SerializedAccessory): Accessory {
    const accessory = new Accessory(json.displayName, json.UUID);

    accessory.lastKnownUsername = json.lastKnownUsername;
    accessory.category = json.category;

    const services: Service[] = [];
    const servicesMap: Record<ServiceId, Service> = {};

    json.services.forEach(serialized => {
      const service = Service.deserialize(serialized);

      services.push(service);
      servicesMap[service.getServiceId()] = service;
    });

    if (json.linkedServices) {
      for (let serviceId in json.linkedServices) {
        const primaryService = servicesMap[serviceId];
        const linkedServicesKeys = json.linkedServices[serviceId];

        if (!primaryService) {
          continue
        }

        linkedServicesKeys.forEach(linkedServiceKey => {
          const linkedService = servicesMap[linkedServiceKey];

          if (linkedService) {
            primaryService.addLinkedService(linkedService);
          }
        });
      }
    }

    if (json.controllers) { // just save it for later if it exists {@see configureController}
      accessory.serializedControllers = {};

      json.controllers.forEach(serializedController => {
        accessory.serializedControllers![serializedController.type] = Accessory.deserializeServiceMap(serializedController.services, servicesMap)
      });
    }

    accessory._sideloadServices(services);

    return accessory;
  }

  public static cleanupAccessoryData(username: MacAddress) {
    IdentifierCache.remove(username);
    AccessoryInfo.remove(username);
    ControllerStorage.remove(username);
  }

  private static serializeServiceMap(serviceMap: ControllerServiceMap): SerializedServiceMap {
    const serialized: SerializedServiceMap = {};

    Object.entries(serviceMap).forEach(([name, service]) => {
      if (!service) {
        return;
      }

      serialized[name] = service.getServiceId();
    });

    return serialized;
  }

  private static deserializeServiceMap(serializedServiceMap: SerializedServiceMap, servicesMap: Record<ServiceId, Service>): ControllerServiceMap {
    const controllerServiceMap: ControllerServiceMap = {};

    Object.entries(serializedServiceMap).forEach(([name, serviceId]) => {
      const service = servicesMap[serviceId];
      if (service) {
        controllerServiceMap[name] = service;
      }
    });

    return controllerServiceMap;
  }

}

const numberPattern = /^-?\d+$/;

function hapStatus(err: Error) {
  let errorValue = Status.SERVICE_COMMUNICATION_FAILURE;

  if (numberPattern.test(err.message)) {
    const value = parseInt(err.message);

    if (value >= Status.INSUFFICIENT_PRIVILEGES && value <= Status.INSUFFICIENT_AUTHORIZATION) {
      errorValue = value;
    }
  }

  return errorValue;
}
