'use strict';

var debug = require('debug')('Accessory');
var crypto = require('crypto');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var clone = require('./util/clone').clone;
var uuid = require('./util/uuid');
var Service = require('./Service').Service;
var Characteristic = require('./Characteristic').Characteristic;
var HomeKitTypes = require('./gen/HomeKitTypes');
var Advertiser = require('./Advertiser').Advertiser;
var HAPServer = require('./HAPServer').HAPServer;
var AccessoryInfo = require('./model/AccessoryInfo').AccessoryInfo;
var IdentifierCache = require('./model/IdentifierCache').IdentifierCache;
var bufferShim = require('buffer-shims');
// var RelayServer = require("./util/relayserver").RelayServer;

module.exports = {
  Accessory: Accessory
};


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

function Accessory(displayName, UUID) {

  if (!displayName) throw new Error("Accessories must be created with a non-empty displayName.");
  if (!UUID) throw new Error("Accessories must be created with a valid UUID.");
  if (!uuid.isValid(UUID)) throw new Error("UUID '" + UUID + "' is not a valid UUID. Try using the provided 'generateUUID' function to create a valid UUID from any arbitrary string, like a serial number.");

  this.displayName = displayName;
  this.UUID = UUID;
  this.aid = null; // assigned by us in assignIDs() or by a Bridge
  this._isBridge = false; // true if we are a Bridge (creating a new instance of the Bridge subclass sets this to true)
  this.bridged = false; // true if we are hosted "behind" a Bridge Accessory
  this.bridgedAccessories = []; // If we are a Bridge, these are the Accessories we are bridging
  this.reachable = true;
  this.category = Accessory.Categories.OTHER;
  this.services = []; // of Service
  this.cameraSource = null;
  this.shouldPurgeUnusedIDs = true; // Purge unused ids by default

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
  this
    .getService(Service.AccessoryInformation)
    .getCharacteristic(Characteristic.Identify)
    .on('set', function(value, callback) {
      if (value) {
        var paired = true;
        this._identificationRequest(paired, callback);
      }
    }.bind(this));
}

inherits(Accessory, EventEmitter);

// Known category values. Category is a hint to iOS clients about what "type" of Accessory this represents, for UI only.
Accessory.Categories = {
  OTHER: 1,
  BRIDGE: 2,
  FAN: 3,
  GARAGE_DOOR_OPENER: 4,
  LIGHTBULB: 5,
  DOOR_LOCK: 6,
  OUTLET: 7,
  SWITCH: 8,
  THERMOSTAT: 9,
  SENSOR: 10,
  ALARM_SYSTEM: 11,
  SECURITY_SYSTEM: 11, //Added to conform to HAP naming
  DOOR: 12,
  WINDOW: 13,
  WINDOW_COVERING: 14,
  PROGRAMMABLE_SWITCH: 15,
  RANGE_EXTENDER: 16,
  CAMERA: 17,
  IP_CAMERA: 17, //Added to conform to HAP naming
  VIDEO_DOORBELL: 18,
  AIR_PURIFIER: 19,
  AIR_HEATER: 20, //Not in HAP Spec
  AIR_CONDITIONER: 21, //Not in HAP Spec
  AIR_HUMIDIFIER: 22, //Not in HAP Spec
  AIR_DEHUMIDIFIER: 23 // Not in HAP Spec
}

Accessory.prototype._identificationRequest = function(paired, callback) {
  debug("[%s] Identification request", this.displayName);

  if (this.listeners('identify').length > 0) {
    // allow implementors to identify this Accessory in whatever way is appropriate, and pass along
    // the standard callback for completion.
    this.emit('identify', paired, callback);
  }
  else {
    debug("[%s] Identification request ignored; no listeners to 'identify' event", this.displayName);
    callback();
  }
}

Accessory.prototype.addService = function(service) {
  // service might be a constructor like `Service.AccessoryInformation` instead of an instance
  // of Service. Coerce if necessary.
  if (typeof service === 'function')
    service = new (Function.prototype.bind.apply(service, arguments));

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
    this.emit('service-configurationChange', clone({accessory:this, service:service}));
  }

  service.on('service-configurationChange', function(change) {
    if (!this.bridged) {
      this._updateConfiguration();
    } else {
      this.emit('service-configurationChange', clone({accessory:this, service:service}));
    }
  }.bind(this));

  // listen for changes in characteristics and bubble them up
  service.on('characteristic-change', function(change) {
    this.emit('service-characteristic-change', clone(change, {service:service}));

    // if we're not bridged, when we'll want to process this event through our HAPServer
    if (!this.bridged)
      this._handleCharacteristicChange(clone(change, {accessory:this, service:service}));

  }.bind(this));

  return service;
}

Accessory.prototype.setPrimaryService = function (service) {
    //find this service in the services list
    var targetServiceIndex;
    for (var index in this.services) {
        var existingService = this.services[index];

        if (existingService === service) {
            targetServiceIndex = index;
            break;
        }
    }
     
    if (targetServiceIndex) {
        //If the service is found, set isPrimaryService to false for everything.
        for (var index in this.services)
            this.services[index].isPrimaryService = false;

        //Make this service the primary
        existingService.isPrimaryService = true

        if (!this.bridged) {
            this._updateConfiguration();
        } else {
            this.emit('service-configurationChange', clone({ accessory: this, service: service }));
        }
    }
}

Accessory.prototype.removeService = function(service) {
  var targetServiceIndex;

  for (var index in this.services) {
    var existingService = this.services[index];

    if (existingService === service) {
      targetServiceIndex = index;
      break;
    }
  }

  if (targetServiceIndex) {
    this.services.splice(targetServiceIndex, 1);

    if (!this.bridged) {
      this._updateConfiguration();
    } else {
      this.emit('service-configurationChange', clone({accessory:this, service:service}));
    }

    service.removeAllListeners();
  }
}

Accessory.prototype.getService = function(name) {
  for (var index in this.services) {
    var service = this.services[index];

    if (typeof name === 'string' && (service.displayName === name || service.name === name || service.subtype === name))
      return service;
    else if (typeof name === 'function' && ((service instanceof name) || (name.UUID === service.UUID)))
      return service;
  }
}

Accessory.prototype.updateReachability = function(reachable) {
  if (!this.bridged)
    throw new Error("Cannot update reachability on non-bridged accessory!");
  this.reachable = reachable;

  debug('Reachability update is no longer being supported.');
}

Accessory.prototype.addBridgedAccessory = function(accessory, deferUpdate) {
  if (accessory._isBridge)
    throw new Error("Cannot Bridge another Bridge!");

  // check for UUID conflict
  for (var index in this.bridgedAccessories) {
    var existing = this.bridgedAccessories[index];
    if (existing.UUID === accessory.UUID)
      throw new Error("Cannot add a bridged Accessory with the same UUID as another bridged Accessory: " + existing.UUID);
  }

  // listen for changes in ANY characteristics of ANY services on this Accessory
  accessory.on('service-characteristic-change', function(change) {
    this._handleCharacteristicChange(clone(change, {accessory:accessory}));
  }.bind(this));

  accessory.on('service-configurationChange', function(change) {
    this._updateConfiguration();
  }.bind(this));

  accessory.bridged = true;

  this.bridgedAccessories.push(accessory);

  if(!deferUpdate) {
    this._updateConfiguration();
  }

  return accessory;
}

Accessory.prototype.addBridgedAccessories = function(accessories) {
  for (var index in accessories) {
    var accessory = accessories[index];
    this.addBridgedAccessory(accessory, true);
  }

  this._updateConfiguration();
}

Accessory.prototype.removeBridgedAccessory = function(accessory, deferUpdate) {
  if (accessory._isBridge)
    throw new Error("Cannot Bridge another Bridge!");

  var foundMatchAccessory = false;
  // check for UUID conflict
  for (var index in this.bridgedAccessories) {
    var existing = this.bridgedAccessories[index];
    if (existing.UUID === accessory.UUID) {
      foundMatchAccessory = true;
      this.bridgedAccessories.splice(index, 1);
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

Accessory.prototype.removeBridgedAccessories = function(accessories) {
  for (var index in accessories) {
    var accessory = accessories[index];
    this.removeBridgedAccessory(accessory, true);
  }

  this._updateConfiguration();
}

Accessory.prototype.removeAllBridgedAccessories = function() {
  for (var i = this.bridgedAccessories.length - 1; i >= 0; i --) {
    this.removeBridgedAccessory(this.bridgedAccessories[i], true);
  }
  this._updateConfiguration();
}

Accessory.prototype.getCharacteristicByIID = function(iid) {
  for (var index in this.services) {
    var service = this.services[index];
    var characteristic = service.getCharacteristicByIID(iid);
    if (characteristic) return characteristic;
  }
}

Accessory.prototype.getBridgedAccessoryByAID = function(aid) {
  for (var index in this.bridgedAccessories) {
    var accessory = this.bridgedAccessories[index];
    if (accessory.aid === aid) return accessory;
  }
}

Accessory.prototype.findCharacteristic = function(aid, iid) {

  // if aid === 1, the accessory is us (because we are the server), otherwise find it among our bridged
  // accessories (if any)
  var accessory = (aid === 1) ? this : this.getBridgedAccessoryByAID(aid);

  return accessory && accessory.getCharacteristicByIID(iid);
}

Accessory.prototype.configureCameraSource = function(cameraSource) {
  this.cameraSource = cameraSource;
  for (var index in cameraSource.services) {
    var service = cameraSource.services[index];
    this.addService(service);
  }
}

Accessory.prototype.setupURI = function() {
  if (this._setupURI) {
    return this._setupURI;
  }

  var buffer = bufferShim.alloc(8);
  var setupCode = parseInt(this._accessoryInfo.pincode.replace(/-/g, ''), 10);

  var value_low = setupCode;
  var value_high = this._accessoryInfo.category >> 1;

  value_low |= 1 << 28; // Supports IP;

  buffer.writeUInt32BE(value_low, 4);

  if (this._accessoryInfo.category & 1) {
    buffer[4] = buffer[4] | 1 << 7;
  }

  buffer.writeUInt32BE(value_high, 0);

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
Accessory.prototype._assignIDs = function(identifierCache) {

  // if we are responsible for our own identifierCache, start the expiration process
  // also check weather we want to have an expiration process
  if (this._identifierCache && this.shouldPurgeUnusedIDs) {
    this._identifierCache.startTrackingUsage();
  }

  if (this.bridged) {
    // This Accessory is bridged, so it must have an aid > 1. Use the provided identifierCache to
    // fetch or assign one based on our UUID.
    this.aid = identifierCache.getAID(this.UUID)
  }
  else {
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

Accessory.prototype.disableUnusedIDPurge = function() {
  this.shouldPurgeUnusedIDs = false;
}

Accessory.prototype.enableUnusedIDPurge = function() {
  this.shouldPurgeUnusedIDs = true;
}

/**
 * Manually purge the unused ids if you like, comes handy
 * when you have disabled auto purge so you can do it manually
 */
Accessory.prototype.purgeUnusedIDs = function() {
  //Cache the state of the purge mechanisam and set it to true
  var oldValue = this.shouldPurgeUnusedIDs;
  this.shouldPurgeUnusedIDs = true;

  //Reassign all ids
  this._assignIDs(this._identifierCache);

  //Revert back the purge mechanisam state
  this.shouldPurgeUnusedIDs = oldValue;
}

/**
 * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
 */
Accessory.prototype.toHAP = function(opt) {

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
Accessory.prototype.publish = function(info, allowInsecureRequest) {
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
  this._accessoryInfo.category = info.category || Accessory.Categories.OTHER;
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
  this._advertiser = new Advertiser(this._accessoryInfo);

  // create our HAP server which handles all communication between iOS devices and us
  this._server = new HAPServer(this._accessoryInfo, this.relayServer);
  this._server.allowInsecureRequest = allowInsecureRequest
  this._server.on('listening', this._onListening.bind(this));
  this._server.on('identify', this._handleIdentify.bind(this));
  this._server.on('pair', this._handlePair.bind(this));
  this._server.on('unpair', this._handleUnpair.bind(this));
  this._server.on('accessories', this._handleAccessories.bind(this));
  this._server.on('get-characteristics', this._handleGetCharacteristics.bind(this));
  this._server.on('set-characteristics', this._handleSetCharacteristics.bind(this));

  if (this.cameraSource) {
      this._server.on('request-resource', this._handleResource.bind(this));
      this._server.on('session-close', this._handleSessionClose.bind(this));
  }

  var targetPort = info.port || 0;
  this._server.listen(targetPort);
}

/**
 * Removes this Accessory from the local network
 * Accessory object will no longer vaild after invoking this method
 * Trying to invoke publish() on the object will result undefined behavior
 */
Accessory.prototype.destroy = function() {
  if (this._server) {
    this._server.stop();
    this._server = undefined;
  }
  if (this._advertiser) {
    this._advertiser.stopAdvertising();
    this._advertiser = undefined;
  }
  if (this._accessoryInfo) {
      this._accessoryInfo.remove();
      this._accessoryInfo = undefined;
  }
  if (this._identifierCache) {
      this._identifierCache.remove();
      this._identifierCache = undefined;
  }
}

Accessory.prototype._updateConfiguration = function() {
  if (this._advertiser && this._advertiser.isAdvertising()) {
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

    // update our advertisement so HomeKit on iOS can pickup new accessory
    this._advertiser.updateAdvertisement();
  }
}

Accessory.prototype._onListening = function(port) {
  // the HAP server is listening, so we can now start advertising our presence.
  this._advertiser.startAdvertising(port);
  this.emit('listening', port);
}

// Called when an unpaired client wishes for us to identify ourself
Accessory.prototype._handleIdentify = function(callback) {
  var paired = false;
  this._identificationRequest(paired, callback);
}

// Called when HAPServer has completed the pairing process with a client
Accessory.prototype._handlePair = function(username, publicKey, callback) {

  debug("[%s] Paired with client %s", this.displayName, username);

  this._accessoryInfo.addPairedClient(username, publicKey);
  this._accessoryInfo.save();

  // update our advertisement so it can pick up on the paired status of AccessoryInfo
  this._advertiser.updateAdvertisement();

  callback();
}

// Called when HAPServer wishes to remove/unpair the pairing information of a client
Accessory.prototype._handleUnpair = function(username, callback) {

  debug("[%s] Unpairing with client %s", this.displayName, username);

  // Unpair
  this._accessoryInfo.removePairedClient(username);
  this._accessoryInfo.save();

  // update our advertisement so it can pick up on the paired status of AccessoryInfo
  this._advertiser.updateAdvertisement();

  callback();
}

// Called when an iOS client wishes to know all about our accessory via JSON payload
Accessory.prototype._handleAccessories = function(callback) {

  // make sure our aid/iid's are all assigned
  this._assignIDs(this._identifierCache);

  // build out our JSON payload and call the callback
  callback(null, {
    accessories: this.toHAP() // array of Accessory HAP
  });
}

// Called when an iOS client wishes to query the state of one or more characteristics, like "door open?", "light on?", etc.
Accessory.prototype._handleGetCharacteristics = function(data, events, callback, remote, connectionID) {

  // build up our array of responses to the characteristics requested asynchronously
  var characteristics = [];
  var statusKey = remote ? 's' : 'status';
  var valueKey = remote ? 'v' : 'value';

  data.forEach(function(characteristicData) {
    var aid = characteristicData.aid;
    var iid = characteristicData.iid;

    var includeEvent = characteristicData.e;

    var characteristic = this.findCharacteristic(characteristicData.aid, characteristicData.iid);

    if (!characteristic) {
      debug('[%s] Could not find a Characteristic with iid of %s and aid of %s', this.displayName, characteristicData.aid, characteristicData.iid);
      var response = {
        aid: aid,
        iid: iid
      };
      response[statusKey] = HAPServer.Status.SERVICE_COMMUNICATION_FAILURE; // generic error status
      characteristics.push(response);

      // have we collected all responses yet?
      if (characteristics.length === data.length)
        callback(null, characteristics);

      return;
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
    characteristic.getValue(function(err, value) {

      debug('[%s] Got Characteristic "%s" value: %s', this.displayName, characteristic.displayName, value);

      if (err) {
        debug('[%s] Error getting value for Characteristic "%s": %s', this.displayName, characteristic.displayName, err.message);
        var response = {
          aid: aid,
          iid: iid
        };
        response[statusKey] = HAPServer.Status.SERVICE_COMMUNICATION_FAILURE; // generic error status
        characteristics.push(response);
      }
      else {
        var response = {
          aid: aid,
          iid: iid
        };
        response[valueKey] = value;
        response[statusKey] = 0;

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

    }.bind(this), context, connectionID);

  }.bind(this));
}

// Called when an iOS client wishes to change the state of this accessory - like opening a door, or turning on a light.
// Or, to subscribe to change events for a particular Characteristic.
Accessory.prototype._handleSetCharacteristics = function(data, events, callback, remote, connectionID) {

  // data is an array of characteristics and values like this:
  // [ { aid: 1, iid: 8, value: true, ev: true } ]

  debug("[%s] Processing characteristic set: %s", this.displayName, JSON.stringify(data));

  // build up our array of responses to the characteristics requested asynchronously
  var characteristics = [];

  data.forEach(function(characteristicData) {
    var aid = characteristicData.aid;
    var iid = characteristicData.iid;
    var value = remote ? characteristicData.v : characteristicData.value;
    var ev = remote ? characteristicData.e : characteristicData.ev;
    var includeValue = characteristicData.r || false;

    var statusKey = remote ? 's' : 'status';

    var characteristic = this.findCharacteristic(aid, iid);

    if (!characteristic) {
      debug('[%s] Could not find a Characteristic with iid of %s and aid of %s', this.displayName, characteristicData.aid, characteristicData.iid);
      var response = {
        aid: aid,
        iid: iid
      };
      response[statusKey] = HAPServer.Status.SERVICE_COMMUNICATION_FAILURE; // generic error status
      characteristics.push(response);

      // have we collected all responses yet?
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
      debug('[%s] %s Characteristic "%s" for events', this.displayName, ev ? "Registering" : "Unregistering", characteristic.displayName);

      // store event registrations in the supplied "events" dict which is associated with the connection making
      // the request.
      var eventName = aid + '.' + iid;

      if (ev)
        events[eventName] = true; // value is arbitrary, just needs to be non-falsey
      else
        delete events[eventName]; // unsubscribe by deleting name from dict
    }

    // Found the characteristic - set the value if there is one
    if (typeof value !== 'undefined') {

      debug('[%s] Setting Characteristic "%s" to value %s', this.displayName, characteristic.displayName, value);

      // set the value and wait for success
      characteristic.setValue(value, function(err) {

        if (err) {
          debug('[%s] Error setting Characteristic "%s" to value %s: ', this.displayName, characteristic.displayName, value, err.message);

          var response = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = HAPServer.Status.SERVICE_COMMUNICATION_FAILURE; // generic error status
          characteristics.push(response);
        }
        else {
          var response = {
            aid: aid,
            iid: iid
          };
          response[statusKey] = 0;

          if (includeValue)
            response['v'] = characteristic.value;

          characteristics.push(response);
        }

        // have we collected all responses yet?
        if (characteristics.length === data.length)
          callback(null, characteristics);

      }.bind(this), context, connectionID);

    }
    else {
      // no value to set, so we're done (success)
      var response = {
        aid: aid,
        iid: iid
      };
      response[statusKey] = 0;
      characteristics.push(response);

      // have we collected all responses yet?
      if (characteristics.length === data.length)
        callback(null, characteristics);
    }

  }.bind(this));
}

Accessory.prototype._handleResource = function(data, callback) {
  if (data["resource-type"] == "image") {
    if (this.cameraSource) {
      this.cameraSource.handleSnapshotRequest({
        width: data["image-width"],
        height: data["image-height"]
      }, callback);
      return;
    }
  }

  callback('resource not found');
}

Accessory.prototype._handleSessionClose = function(sessionID) {
  if (this.cameraSource && this.cameraSource.handleCloseConnection) {
      this.cameraSource.handleCloseConnection(sessionID);
    }
}

// Called internally above when a change was detected in one of our hosted Characteristics somewhere in our hierarchy.
Accessory.prototype._handleCharacteristicChange = function(change) {
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

Accessory.prototype._setupService = function(service) {
  service.on('service-configurationChange', function(change) {
    if (!this.bridged) {
      this._updateConfiguration();
    } else {
      this.emit('service-configurationChange', clone({accessory:this, service:service}));
    }
  }.bind(this));

  // listen for changes in characteristics and bubble them up
  service.on('characteristic-change', function(change) {
    this.emit('service-characteristic-change', clone(change, {service:service}));

    // if we're not bridged, when we'll want to process this event through our HAPServer
    if (!this.bridged)
      this._handleCharacteristicChange(clone(change, {accessory:this, service:service}));

  }.bind(this));
}

Accessory.prototype._sideloadServices = function(targetServices) {
  for (var index in targetServices) {
    var target = targetServices[index];
    this._setupService(target);
  }

  this.services = targetServices.slice();

  // Fix Identify
  this
    .getService(Service.AccessoryInformation)
    .getCharacteristic(Characteristic.Identify)
    .on('set', function(value, callback) {
      if (value) {
        var paired = true;
        this._identificationRequest(paired, callback);
      }
    }.bind(this));
}

Accessory.prototype._generateSetupID = function() {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var bytes = crypto.randomBytes(4);
  var setupID = '';

  for (var i = 0; i < 4; i++) {
    var index = bytes.readUInt8(i) % 26;
    setupID += chars.charAt(index);
  }

  return setupID;
}
