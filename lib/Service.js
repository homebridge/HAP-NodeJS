var inherits = require('util').inherits;
var clone = require('./util/clone').clone;
var EventEmitter = require('events').EventEmitter;
var Characteristic = require('./Characteristic').Characteristic;

'use strict';

module.exports = {
  Service: Service
}

/**
 * Service represents a set of grouped values necessary to provide a logical function. For instance, a
 * "Door Lock Mechanism" service might contain two values, one for the "desired lock state" and one for the
 * "current lock state". A particular Service is distinguished from others by its "type", which is a UUID.
 * HomeKit provides a set of known Service UUIDs defined in HomeKitTypes.js along with a corresponding
 * concrete subclass that you can instantiate directly to setup the necessary values. These natively-supported
 * Services are expected to contain a particular set of Characteristics.
 *
 * You can also define custom Services by providing your own UUID for the type that you generate yourself.
 * Custom Services can contain an arbitrary set of Characteristics, but Siri will likely not be able to
 * work with these.
 *
 * @event 'characteristic-change' => function({characteristic, oldValue, newValue, context}) { }
 *        Emitted after a change in the value of one of our Characteristics has occurred.
 */

function Service(displayName, UUID) {
  this.displayName = displayName;
  this.UUID = UUID;
  this.iid = null; // assigned later by our containing Accessory
  this.characteristics = [];
  this.optionalCharacteristics = [];
}

inherits(Service, EventEmitter);

Service.prototype.addCharacteristic = function(characteristic) {
  // check for UUID conflict
  for (var index in this.characteristics) {
    var existing = this.characteristics[index];
    if (existing.UUID === characteristic.UUID)
      throw new Error("Cannot add a Characteristic with the same UUID as another Characteristic in this Service: " + existing.UUID);
  }
  
  // listen for changes in characteristics and bubble them up
  characteristic.on('change', function(change) {
    // make a new object with the relevant characteristic added, and bubble it up
    this.emit('characteristic-change', clone(change, {characteristic:characteristic}));
  }.bind(this));

  this.characteristics.push(characteristic);
  return characteristic;
}

Service.prototype.getCharacteristic = function(name) {
  for (var index in this.characteristics) {
    var characteristic = this.characteristics[index];
    
    if (typeof name === 'string' && characteristic.displayName === name)
      return characteristic;
    else if (typeof name === 'function' && characteristic instanceof name)
      return characteristic;
  }
}

Service.prototype.setCharacteristic = function(name, value) {
  this.getCharacteristic(name).setValue(value);
  return this; // for chaining
}

Service.prototype.addOptionalCharacteristic = function(characteristic) {
  this.optionalCharacteristics.push(characteristic);
}

Service.prototype.getCharacteristicByIID = function(iid) {
  for (var index in this.characteristics) {
    var characteristic = this.characteristics[index];
    if (characteristic.iid === iid)
      return characteristic;
  }
}

Service.prototype._assignIDs = function(identifierCache, accessoryName) {
  
  // assign our own ID based on our UUID
  this.iid = identifierCache.getIID(accessoryName, this.UUID);
  
  // assign IIDs to our Characteristics
  for (var index in this.characteristics) {
    var characteristic = this.characteristics[index];
    characteristic._assignID(identifierCache, accessoryName, this.UUID);
  }
}

/**
 * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
 */
Service.prototype.toHAP = function(opt) {
  
  var characteristicsHAP = [];
  
  for (var index in this.characteristics) {
    var characteristic = this.characteristics[index];
    characteristicsHAP.push(characteristic.toHAP(opt));
  }
  
  return {
    iid: this.iid,
    type: this.UUID,
    characteristics: characteristicsHAP
  }
}
