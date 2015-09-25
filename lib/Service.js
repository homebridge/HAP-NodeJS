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

function Service(displayName, UUID, subtype) {
  
  if (!UUID) throw new Error("Services must be created with a valid UUID.");

  this.displayName = displayName;
  this.UUID = UUID;
  this.subtype = subtype;
  this.iid = null; // assigned later by our containing Accessory
  this.characteristics = [];
  this.optionalCharacteristics = [];
  
  // every service has an optional Characteristic.Name property - we'll set it to our displayName
  // if one was given
  if (displayName) {
    // create the characteristic if necessary
    var nameCharacteristic =
      this.getCharacteristic(Characteristic.Name, true) ||
      this.addCharacteristic(Characteristic.Name, true);
    
    nameCharacteristic.setValue(displayName);
  }
}

inherits(Service, EventEmitter);

Service.prototype.addCharacteristic = function(characteristic, nowarn) {
	// characteristic might be a constructor like `Characteristic.Brightness` instead of an instance
	// of Characteristic. Coerce if necessary.
	var optFound = false;
	if (typeof characteristic === 'function') {
		// Look in the optionals for the type
		for (var index in this.optionalCharacteristics) {
			var optcharacteristic = this.characteristics[index];
			if (optcharacteristic instanceof characteristic) {
				optFound = true;
			}
		}
		if (!optFound && !nowarn) {
			console.log("WARNING: Service.prototype.addCharacteristic: adding characteristic that is not a know optional type for the service "+this.UUID);
		}
		characteristic = new (Function.prototype.bind.apply(characteristic, arguments));
	}

	// check for UUID conflict
	for (var index in this.characteristics) {
		var existing = this.characteristics[index];
		if (existing.UUID === characteristic.UUID)
			throw new Error("Cannot add a Characteristic with the same UUID as another Characteristic in this Service: " + existing.UUID + ". Duplicate display names used?");
	}

	// listen for changes in characteristics and bubble them up
	characteristic.on('change', function(change) {
		// make a new object with the relevant characteristic added, and bubble it up
		this.emit('characteristic-change', clone(change, {characteristic:characteristic}));
	}.bind(this));

	this.characteristics.push(characteristic);
	return characteristic;
}

Service.prototype.getCharacteristic = function(name, nofail) {
	// returns a characteristic object from the service
	//If  Service.prototype.getCharacteristic(Characteristic.Type)  does not find the characteristic, 
	// 	AND it is no optionalCharacteristic match, it fails ungracefully and throws an error; programmer can use  addCharacteristic()  
	//	to add it anyhow, but will then receive a WARNING in console log entry.
	//If  Service.prototype.getCharacteristic(Characteristic.Type)  does not find the characteristic, 
	//  BUT the type is in optionalCharacteristic, it adds the characteristic.type and returns it.
	// If nofail is true it will return undefined instead of throwing!

	for (var index in this.characteristics) {
		var characteristic = this.characteristics[index];

		if (typeof name === 'string' && characteristic.displayName === name) {
			return characteristic;
		} else if (typeof name === 'function' && characteristic instanceof name) {
			return characteristic;
		}
	}
	// not found yet, look in the optionals
	if (typeof name === 'function')  {
		for (var index in this.optionalCharacteristics) {
			var characteristic = this.characteristics[index];
			if (characteristic instanceof name) {
				return this.addCharacteristic(name);
			}
		}
	}
	// fail with exception if made it to here without a valid match
	if (!nofail) {
		throw new Error("Service.GetCharacteristic(name) failed: no such characteristic - you may add it first");
	} else {
		return undefined;
	}
}

Service.prototype.setCharacteristic = function(name, value) {
  this.getCharacteristic(name).setValue(value);
  return this; // for chaining
}

Service.prototype.addOptionalCharacteristic = function(characteristic) {
  // characteristic might be a constructor like `Characteristic.Brightness` instead of an instance
  // of Characteristic. Coerce if necessary.
  if (typeof characteristic === 'function')
    characteristic = new characteristic();

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
  
  // the Accessory Information service must have a (reserved by IdentifierCache) ID of 1
  if (this.UUID === '0000003E-0000-1000-8000-0026BB765291') {
    this.iid = 1;
  }
  else {
    // assign our own ID based on our UUID
    this.iid = identifierCache.getIID(accessoryName, this.UUID, this.subtype);
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
