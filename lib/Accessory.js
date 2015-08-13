var debug = require('debug')('Accessory');
var crypto = require('crypto')
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

'use strict';

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
 * @event 'service-characteristic-change' => function({service, characteristic, oldValue, newValue, context}) { }
 *        Emitted after a change in the value of one of the provided Service's Characteristics.
 */

function Accessory(displayName, UUID) {
  
  if (!UUID) throw new Error("Accessories must be created with a valid UUID.");
  if (!uuid.isValid(UUID)) throw new Error("UUID '" + UUID + "' is not a valid UUID. Try using the provided 'generateUUID' function to create a valid UUID from any arbitrary string, like a serial number.");
  
  this.displayName = displayName;
  this.UUID = UUID;
  this.aid = null; // assigned by us in assignIDs() or by a Bridge
  this._isBridge = false; // true if we are a Bridge (creating a new instance of the Bridge subclass sets this to true)
  this.bridged = false; // true if we are hosted "behind" a Bridge Accessory
  this.bridgedAccessories = []; // If we are a Bridge, these are the Accessories we are bridging
  this.services = []; // of Service

  // create our initial "Accessory Information" Service that all Accessories are expected to have
  this
    .addService(new Service.AccessoryInformation())
    .setCharacteristic(Characteristic.Name, displayName)
    .setCharacteristic(Characteristic.Manufacturer, "Default-Manufacturer")
    .setCharacteristic(Characteristic.Model, "Default-Model")
    .setCharacteristic(Characteristic.SerialNumber, "Default-SerialNumber");
}

inherits(Accessory, EventEmitter);

// Known category values. Category is a hint to iOS clients about what "type" of Accessory this represents, for UI only.
Accessory.Categories = {
  OTHER: 1,
  FAN: 3,
  GARAGE_DOOR_OPENER: 4,
  LIGHTBULB: 5,
  DOOR_LOCK: 6,
  OUTLET: 7,
  SWITCH: 8,
  THERMOSTAT: 9,
  SENSOR: 10,
  ALARM_SYSTEM: 11,
  DOOR: 12,
  WINDOW: 13,
  WINDOW_COVERING: 14,
  PROGRAMMABLE_SWITCH: 15
}

Accessory.prototype.addService = function(service) {
  
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

  // listen for changes in characteristics and bubble them up
  service.on('characteristic-change', function(change) {
    this.emit('service-characteristic-change', clone(change, {service:service}));
    
    // if we're not bridged, when we'll want to process this event through our HAPServer
    if (!this.bridged)
      this._handleCharacteristicChange(clone(change, {accessory:this, service:service}));
    
  }.bind(this));
  
  this.services.push(service);
  return service;
}

Accessory.prototype.getService = function(name) {
  for (var index in this.services) {
    var service = this.services[index];
    
    if (typeof name === 'string' && (service.displayName === name || service.name === name))
      return service;
    else if (typeof name === 'function' && service instanceof name)
      return service;
  }
}

Accessory.prototype.addBridgedAccessory = function(accessory) {
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
  
  accessory.bridged = true;
  this.bridgedAccessories.push(accessory);
  return accessory;
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

/**
 * Assigns aid/iid to ourselves, any Accessories we are bridging, and all associated Services+Characteristics. Uses
 * the provided identifierCache to keep IDs stable.
 */
Accessory.prototype._assignIDs = function(identifierCache) {

  // if we are responsible for our own identifierCache, start the expiration process
  if (this._identifierCache) {
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
    service._assignIDs(identifierCache, this.UUID);
  }
  
  // now assign IDs for any Accessories we are bridging
  for (var index in this.bridgedAccessories) {
    var accessory = this.bridgedAccessories[index];
    
    accessory._assignIDs(identifierCache);
  }
  
  // expire any now-unused cache keys (for Accessories, Services, or Characteristics
  // that have been removed since the last call to assignIDs())
  if (this._identifierCache) {
    this._identifierCache.stopTrackingUsageAndExpireUnused();
    this._identifierCache.save();
  }
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
 * @param {number} info.port - The port to run the HAP server on for clients to use.
 * @param {string} info.pincode - The 8-digit pincode for clients to use when pairing this Accessory. Must be formatted
 *                               as a string like "031-45-154".
 * @param {string} info.category - One of the values of the Accessory.Category enum, like Accessory.Category.SWITCH.
 *                                This is a hint to iOS clients about what "type" of Accessory this represents, so
 *                                that for instance an appropriate icon can be drawn for the user while adding a
 *                                new Accessory.
 */
Accessory.prototype.publish = function(info) {
  
  // attempt to load existing AccessoryInfo from disk
  this._accessoryInfo = AccessoryInfo.load(info.username);
  
  // if we don't have one, create a new one.
  if (!this._accessoryInfo) {
    debug("[%s] Creating new AccessoryInfo for our HAP server", this.displayName);
    this._accessoryInfo = AccessoryInfo.create(info.username);
  }
  
  // make sure we have up-to-date values in AccessoryInfo, then save it in case they changed (or if we just created it)
  this._accessoryInfo.displayName = this.displayName;
  this._accessoryInfo.port = info.port;
  this._accessoryInfo.category = info.category || Accessory.Categories.OTHER;
  this._accessoryInfo.pincode = info.pincode;
  this._accessoryInfo.save();

  // create our IdentifierCache so we can provide clients with stable aid/iid's
  this._identifierCache = IdentifierCache.load(info.username);
  
  // if we don't have one, create a new one.
  if (!this._identifierCache) {
    debug("[%s] Creating new IdentifierCache", this.displayName);
    this._identifierCache = new IdentifierCache(info.username);
  }

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
  this._server = new HAPServer(this._accessoryInfo);
  this._server.on('listening', this._onListening.bind(this));
  this._server.on('pair', this._handlePair.bind(this));
  this._server.on('unpair', this._handleUnpair.bind(this));
  this._server.on('accessories', this._handleAccessories.bind(this));
  this._server.on('get-characteristic', this._handleGetCharacteristic.bind(this));
  this._server.on('set-characteristics', this._handleSetCharacteristics.bind(this));
  this._server.listen(this._accessoryInfo.port);
}

Accessory.prototype._onListening = function() {
  // the HAP server is listening, so we can now start advertising our presence.
  this._advertiser.startAdvertising();
}

// Called when HAPServer has completed the pairing process with a client
Accessory.prototype._handlePair = function(username, publicKey, callback) {

  debug("[%s] Paired with client %s", this.displayName, username);

  this._accessoryInfo.addPairedClient(username, publicKey);
  this._accessoryInfo.save();
  
  // restart our advertisement so it can pick up on the paired status of AccessoryInfo
  // (it will need to stop broadcasting as "discoverable" - see notes at top of Advertiser.js)
  this._advertiser.startAdvertising();
  
  callback();
}

// Called when HAPServer wishes to remove/unpair the pairing information of a client
Accessory.prototype._handleUnpair = function(username, callback) {
  
  debug("[%s] Unpairing with client %s", this.displayName, username);
  
  // Unpair
  this._accessoryInfo.removePairedClient(username);
  this._accessoryInfo.save();

  // restart our advertisement so it can pick up on the paired status of AccessoryInfo
  // (it will need to resume broadcasting as "discoverable" - see notes at top of Advertiser.js)
  this._advertiser.startAdvertising();
  
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

// Called when an iOS client wishes to query the state of a particular characteristic, like "door open"? or "light on?"
Accessory.prototype._handleGetCharacteristic = function(aid, iid, events, callback) {

  var characteristic = this.findCharacteristic(aid, iid);

  if (!characteristic) {
    callback(new Error("Could not find a Characteristic with iid of " + iid + " and aid of " + aid));
    return;
  }

  // Found the Characteristic! Get the value!
  debug('[%s] Getting Characteristic "%s" value', this.displayName, characteristic.displayName);
  
  // we want to remember "who" made this request, so that we don't send them an event notification
  // about any changes that occurred as a result of the request. For instance, if after querying
  // the current value of a characteristic, the value turns out to be different than the previously
  // cached Characteristic value, an internal 'change' event will be emitted which will cause us to
  // notify all connected clients about that new value. But this client is about to get the new value
  // anyway, so we don't want to notify it twice.
  var context = events;

  // set the value and wait for success
  characteristic.getValue(function(err, value) {
    
    if (err) {
      debug('[%s] Error getting Characteristic "%s" value: ', this.displayName, characteristic.displayName, err.message);
      callback(err);
    }
    
    // all done - compose the response and send it to the callback
    callback(null, {
      characteristics: [{
        aid: aid,
        iid: iid,
        value: value
      }]
    });
    
  }.bind(this), context);
}

// Called when an iOS client wishes to change the state of this accessory - like opening a door, or turning on a light.
// Or, to subscribe to change events for a particular Characteristic.
Accessory.prototype._handleSetCharacteristics = function(data, events, callback) {
  
  // data looks something like this:
  // { characteristics: [ { aid: 1, iid: 8, value: true, ev: true } ] }
  
  debug("[%s] Processing characteristic set: %s", this.displayName, JSON.stringify(data));
  
  // if we encounter an error while setting multiple characteristics, remember it here and move on
  var lastError = null;
  var pendingAsyncCalls = 0; // number of pending async calls to setValue by the end of this function
  var finishedLoop = false;
  
  for (var index in data.characteristics) {
    var setting = data.characteristics[index];
    var aid = setting.aid;
    var iid = setting.iid;
    var value = setting.value;
    var ev = setting.ev;
    
    var characteristic = this.findCharacteristic(aid, iid);

    if (!characteristic) {
      lastError = new Error("Could not find a Characteristic with iid of " + iid + " and aid of " + aid);
      continue;
    }
    
    // we want to remember "who" initiated this change, so that we don't send them an event notification
    // about the change they just made. We do this by leveraging the arbitrary "context" object supported
    // by Characteristic and passed on to the corresponding 'change' events bubbled up from Characteristic
    // through Service and Accessory. We'll assign it to the events object since it essentially represents
    // the connection requesting the change.
    var context = events;
    
    // Found the characteristic - set the value if there is one
    if (typeof value !== 'undefined') {

      debug('[%s] Setting Characteristic "%s" to value %s', this.displayName, characteristic.displayName, value);
      
      // set the value and wait for success
      pendingAsyncCalls++;
      characteristic.setValue(value, function(err) {
        pendingAsyncCalls--;
        
        if (err) {
          debug('[%s] Error setting Characteristic "%s" to value %s: ', this.displayName, characteristic.displayName, value, err.message);
          lastError = err;
        }
        
        // was this the last setValue callback called? and we're done looping? then we need to call the callback.
        if (finishedLoop && pendingAsyncCalls == 0)
          callback(lastError);
        
      }.bind(this), context);
    }
    
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
  }
  
  // so that if the setValue callback was called synchronously during the loop above, we can hold off
  // calling the final callback until now.
  finishedLoop = true;
  
  if (pendingAsyncCalls == 0)
    callback(lastError);
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