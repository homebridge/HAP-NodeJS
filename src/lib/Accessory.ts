import crypto from 'crypto';
import createDebug from 'debug';

import * as uuid from './util/uuid';
import { clone } from './util/clone';
import { SerializedService, Service, ServiceConfigurationChange, ServiceEventTypes } from './Service';
import {
  Access,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  Perms
} from './Characteristic';
import { Advertiser } from './Advertiser';
import { CharacteristicsWriteRequest, Codes, HAPServer, HAPServerEventTypes, Status } from './HAPServer';
import { AccessoryInfo, PairingInformation, PermissionTypes } from './model/AccessoryInfo';
import { IdentifierCache } from './model/IdentifierCache';
import {
  CharacteristicChange,
  CharacteristicData, CharacteristicValue,
  NodeCallback,
  Nullable,
  PairingsCallback,
  ToHAPOptions,
  VoidCallback,
  WithUUID,
} from '../types';
import { Camera } from './Camera';
import { EventEmitter } from './EventEmitter';
import { Session } from "./util/eventedhttp";

// var HomeKitTypes = require('./gen/HomeKitTypes');
// var RelayServer = require("./util/relayserver").RelayServer;

const debug = createDebug('Accessory');
const MAX_ACCESSORIES = 149; // Maximum number of bridged accessories per bridge.

// Known category values. Category is a hint to iOS clients about what "type" of Accessory this represents, for UI only.
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
  AIR_HEATER = 20, //Not in HAP Spec
  AIR_CONDITIONER = 21, //Not in HAP Spec
  AIR_HUMIDIFIER = 22, //Not in HAP Spec
  AIR_DEHUMIDIFIER = 23, // Not in HAP Spec
  APPLE_TV = 24,
  HOMEPOD = 25, // HomePod
  SPEAKER = 26,
  AIRPORT = 27,
  SPRINKLER = 28,
  FAUCET = 29,
  SHOWER_HEAD = 30,
  TELEVISION = 31,
  TARGET_CONTROLLER = 32, // Remote Control
  ROUTER = 33, // HomeKit enabled router
  AUDIO_RECEIVER = 34,
}

export interface SerializedAccessory {
  displayName: string,
  UUID: string,
  category: Categories,

  services: SerializedService[],
  linkedServices?: Record<string, string[]>,
}

export enum AccessoryEventTypes {
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
  username: string;
  pincode: string;
  category?: Categories;
  setupID?: string;
  port?: number;
  mdns?: any;
}

export type ServiceCharacteristicChange = CharacteristicChange &  {
  accessory: Accessory;
  service: Service;
};

export enum ResourceTypes {
  IMAGE = 'image',
}

export type Resource = {
  'aid'?: number;
  'image-height': number;
  'image-width': number;
  'resource-type': ResourceTypes;
}

enum WriteRequestState {
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

  static Categories = Categories;

  // NOTICE: when adding/changing properties, remember to possibly adjust the serialize/deserialize functions
  aid: Nullable<number> = null; // assigned by us in assignIDs() or by a Bridge
  _isBridge: boolean = false; // true if we are a Bridge (creating a new instance of the Bridge subclass sets this to true)
  bridged: boolean = false; // true if we are hosted "behind" a Bridge Accessory
  bridge?: Accessory; // if accessory is bridged, this property points to the bridge which bridges this accessory
  bridgedAccessories: Accessory[] = []; // If we are a Bridge, these are the Accessories we are bridging
  reachable: boolean = true;
  cameraSource: Nullable<Camera> = null;
  category: Categories = Categories.OTHER;
  services: Service[] = [];
  shouldPurgeUnusedIDs: boolean = true; // Purge unused ids by default

  _accessoryInfo?: Nullable<AccessoryInfo>;
  _setupID: Nullable<string> = null;
  _identifierCache?: Nullable<IdentifierCache>;
  _advertiser?: Advertiser;
  _server?: HAPServer;
  _setupURI?: string;
  relayServer: any;

  constructor(public displayName: string, public UUID: string) {
    super();
    if (!displayName) throw new Error("Accessories must be created with a non-empty displayName.");
    if (!UUID) throw new Error("Accessories must be created with a valid UUID.");
    if (!uuid.isValid(UUID)) throw new Error("UUID '" + UUID + "' is not a valid UUID. Try using the provided 'generateUUID' function to create a valid UUID from any arbitrary string, like a serial number.");

    // create our initial "Accessory Information" Service that all Accessories are expected to have
    this
      .addService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, displayName)
      .setCharacteristic(Characteristic.Manufacturer, "Default-Manufacturer")
      .setCharacteristic(Characteristic.Model, "Default-Model")
      .setCharacteristic(Characteristic.SerialNumber, "Default-SerialNumber")
      .setCharacteristic(Characteristic.FirmwareRevision, "1.0");

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

  addService = (service: Service | typeof Service, ...constructorArgs: any[]) => {
    // service might be a constructor like `Service.AccessoryInformation` instead of an instance
    // of Service. Coerce if necessary.
    if (typeof service === 'function')
      service = new service(constructorArgs[0], constructorArgs[1], constructorArgs[2]) as Service;
      // service = new (Function.prototype.bind.apply(service, arguments));

    // check for UUID+subtype conflict
    for (var index in this.services) {
      var existing = this.services[index];
      if (existing.UUID === service.UUID) {
        // OK we have two Services with the same UUID. Check that each defines a `subtype` property and that each is unique.
        if (!service.subtype)
          throw new Error("Cannot add a Service with the same UUID '" + existing.UUID + "' as another Service in this Accessory without also defining a unique 'subtype' property.");

        if (service.subtype.toString() === existing.subtype.toString())
          throw new Error("Cannot add a Service with the same UUID '" + existing.UUID + "' and subtype '" + existing.subtype + "' as another Service in this Accessory.");
      }
    }

    this.services.push(service);

    if (!this.bridged) {
      this._updateConfiguration();
    } else {
      this.emit(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({accessory:this, service:service}));
    }

    service.on(ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE, (change: ServiceConfigurationChange) => {
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

  setPrimaryService = (service: Service) => {
      //find this service in the services list
      let targetServiceIndex, existingService: Service;
      for (let index in this.services) {
        existingService = this.services[index];

        if (existingService === service) {
          targetServiceIndex = index;
          break;
        }
      }

      if (targetServiceIndex) {
        //If the service is found, set isPrimaryService to false for everything.
        for (let index in this.services)
          this.services[index].isPrimaryService = false;

        //Make this service the primary
        existingService!.isPrimaryService = true

        if (!this.bridged) {
          this._updateConfiguration();
        } else {
          this.emit(AccessoryEventTypes.SERVICE_CONFIGURATION_CHANGE, clone({ accessory: this, service: service }));
        }
      }
  }

  removeService = (service: Service) => {
    let targetServiceIndex: number | undefined = undefined;

    for (let index in this.services) {
      var existingService = this.services[index];

      if (existingService === service) {
        targetServiceIndex = Number.parseInt(index);
        break;
      }
    }

    if (targetServiceIndex) {
      this.services.splice(targetServiceIndex, 1);

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

  configureCameraSource = (cameraSource: Camera) => {
    this.cameraSource = cameraSource;
    for (var index in cameraSource.services) {
      var service = cameraSource.services[index];
      this.addService(service);
    }
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
    let service: Service | undefined;

    service = this.getService(Service.ProtocolInformation);
    if (!service) {
      service = this.addService(Service.ProtocolInformation) // add the protocol information service to the primary accessory
    }
    service.setCharacteristic(Characteristic.Version, Advertiser.protocolVersionService);

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
    this._accessoryInfo.category = info.category || Categories.OTHER;
    this._accessoryInfo.pincode = info.pincode;
    this._accessoryInfo.save();

    // if (this._isBridge) {
    //   this.relayServer = new RelayServer(this._accessoryInfo);
    //   this.addService(this.relayServer.relayService());
    // }

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
    if (this._isBridge && this.bridgedAccessories.length == 0)
      this.disableUnusedIDPurge();

    // assign aid/iid
    this._assignIDs(this._identifierCache);

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

    // create our Advertiser which broadcasts our presence over mdns
    this._advertiser = new Advertiser(this._accessoryInfo, info.mdns);

    // create our HAP server which handles all communication between iOS devices and us
    this._server = new HAPServer(this._accessoryInfo, this.relayServer);
    this._server.allowInsecureRequest = !!allowInsecureRequest
    this._server.on(HAPServerEventTypes.LISTENING, this._onListening);
    this._server.on(HAPServerEventTypes.IDENTIFY, this._handleIdentify);
    this._server.on(HAPServerEventTypes.PAIR, this._handlePair);
    this._server.on(HAPServerEventTypes.ADD_PAIRING, this._handleAddPairing);
    this._server.on(HAPServerEventTypes.REMOVE_PAIRING, this._handleRemovePairing);
    this._server.on(HAPServerEventTypes.LIST_PAIRINGS, this._handleListPairings);
    this._server.on(HAPServerEventTypes.ACCESSORIES, this._handleAccessories);
    this._server.on(HAPServerEventTypes.GET_CHARACTERISTICS, this._handleGetCharacteristics);
    this._server.on(HAPServerEventTypes.SET_CHARACTERISTICS, this._handleSetCharacteristics);
    this._server.on(HAPServerEventTypes.SESSION_CLOSE, this._handleSessionClose);
    this._server.on(HAPServerEventTypes.REQUEST_RESOURCE, this._handleResource);

    const targetPort = info.port || 0;
    this._server.listen(targetPort);
  }

  /**
   * Removes this Accessory from the local network
   * Accessory object will no longer vaild after invoking this method
   * Trying to invoke publish() on the object will result undefined behavior
   */
  destroy = () => {
    this.unpublish();
    if (this._accessoryInfo) {
        this._accessoryInfo.remove();
        this._accessoryInfo = undefined;
    }
    if (this._identifierCache) {
        this._identifierCache.remove();
        this._identifierCache = undefined;
    }
  }

  unpublish = () => {
    if (this._server) {
      this._server.stop();
      this._server = undefined;
    }
    if (this._advertiser) {
      this._advertiser.stopAdvertising();
      this._advertiser = undefined;
    }
  }

  _updateConfiguration = () => {
    if (this._advertiser && this._advertiser.isAdvertising()) {
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
    // the HAP server is listening, so we can now start advertising our presence.
    this._advertiser && this._advertiser.startAdvertising(port);
    this.emit(AccessoryEventTypes.LISTENING, port);
  }

// Called when an unpaired client wishes for us to identify ourself
  _handleIdentify = (callback: IdentifyCallback) => {
    var paired = false;
    this._identificationRequest(paired, callback);
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

    if (!this._accessoryInfo.paired()) {
      this._advertiser && this._advertiser.updateAdvertisement();
      this.emit(AccessoryEventTypes.UNPAIRED);
    }

    callback(0);
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

      if (characteristic.accessRestrictedToAdmins.includes(Access.READ)) {
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

        debug('[%s] Got Characteristic "%s" value: %s', this.displayName, characteristic!.displayName, value);

        if (err) {
          debug('[%s] Error getting value for Characteristic "%s": %s', this.displayName, characteristic!.displayName, err.message);
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

      }, context, session? session.sessionID as string: undefined);

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

        if (characteristic.accessRestrictedToAdmins.includes(Access.NOTIFY)) {
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

        if (characteristic.accessRestrictedToAdmins.includes(Access.WRITE)) {
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

        }, context, session? session.sessionID as string: undefined);

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

  _handleResource = (data: Resource, callback: NodeCallback<Buffer>) => {
    if (data["resource-type"] == ResourceTypes.IMAGE) {
      const aid = data["aid"]; // aid is optionally supplied by HomeKit (for example when camera is bridged, multiple cams, etc)

      let cameraSource;
      if (aid) {
        if (this.aid === aid && this.cameraSource) { // bridge is probably not a camera but it is theoretically possible
          cameraSource = this.cameraSource;
        } else {
          const accessory = this.getBridgedAccessoryByAID(aid);
          if (accessory && accessory.cameraSource) {
            cameraSource = accessory.cameraSource;
          }
        }
      } else if (this.cameraSource) { // aid was not supplied, check if this accessory is a camera
        cameraSource = this.cameraSource;
      }

      if (!cameraSource) {
        callback(new Error("resource not found"));
        return;
      }

      cameraSource.handleSnapshotRequest({
        width: data["image-width"],
        height: data["image-height"]
      }, callback);
      return;
    }

    callback(new Error('unsupported image type: ' + data["resource-type"]));
  }

  _handleSessionClose = (sessionID: string, events: CharacteristicEvents) => {
    if (this.cameraSource && this.cameraSource.handleCloseConnection) {
        this.cameraSource.handleCloseConnection(sessionID);
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
  static serialize = (accessory: Accessory): SerializedAccessory => {
    const json: SerializedAccessory = {
      displayName: accessory.displayName,
      UUID: accessory.UUID,
      category: accessory.category,

      services: [],
    };

    const linkedServices: Record<string, string[]> = {};
    let hasLinkedServices = false;

    accessory.services.forEach(service => {
      json.services.push(Service.serialize(service));

      const linkedServicesPresentation: string[] = [];
      service.linkedServices.forEach(linkedService => {
        linkedServicesPresentation.push(linkedService.UUID + (linkedService.subtype || ""));
      });
      if (linkedServicesPresentation.length > 0) {
        linkedServices[service.UUID + (service.subtype || "")] = linkedServicesPresentation;
        hasLinkedServices = true;
      }
    });

    if (hasLinkedServices) {
      json.linkedServices = linkedServices;
    }

    return json;
  };

  static deserialize = (json: SerializedAccessory): Accessory => {
    const accessory = new Accessory(json.displayName, json.UUID);

    accessory.category = json.category;

    const services: Service[] = [];
    const servicesMap: Record<string, Service> = {};

    json.services.forEach(serialized => {
      const service = Service.deserialize(serialized);

      services.push(service);
      servicesMap[service.UUID + (service.subtype || "")] = service;
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

    accessory._sideloadServices(services);

    return accessory;
  }

}

function hapStatus(err: Error) {

  // Validate that the message is a valid HAPServer.Status
  let value: number | string = 0;  // default if not found or

  for( const k in Status ) {
    if (Status[k] == err.message)
    {
      value = err.message;
      break;
    }
  }

  if ( value == 0 )
    value = Status.SERVICE_COMMUNICATION_FAILURE;  // default if not found or 0

  return(parseInt(`${value}`));
}
