var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

'use strict';

module.exports = {
  Characteristic: Characteristic
}


/**
 * Characteristic represents a particular typed variable that can be assigned to a Service. For instance, a
 * "Hue" Characteristic might store a 'float' value of type 'arcdegrees'. You could add the Hue Characteristic
 * to a Service in order to store that value. A particular Characteristic is distinguished from others by its
 * UUID. HomeKit provides a set of known Characteristic UUIDs defined in HomeKitTypes.js along with a
 * corresponding concrete subclass.
 *
 * You can also define custom Characteristics by providing your own UUID. Custom Characteristics can be added
 * to any native or custom Services, but Siri will likely not be able to work with these.
 *
 * Note that you can get the "value" of a Characteristic by accessing the "value" property directly, but this
 * is really a "cached value". If you want to fetch the latest value, which may involve doing some work, then
 * call getValue().
 *
 * @event 'get' => function(callback(err, newValue)) { }
 *        Emitted when someone calls getValue() on this Characteristic and desires the latest non-cached
 *        value. If there are any listeners to this event, one of them MUST call the callback in order
 *        for the value to ever be delivered.
 *
 * @event 'set' => function(newValue, callback(err)) { }
 *        Emitted when someone calls setValue() on this Characteristic with a desired new value. If there
 *        are any listeners to this event, one of them MUST call the callback in order for this.value to
 *        actually be set.
 *
 * @event 'change' => function({ oldValue, newValue, context }) { }
 *        Emitted after a change in our value has occurred. The new value will also be immediately accessible
 *        in this.value. The event object contains the new value as well as the context object originally
 *        passed in by the initiator of this change (if known).
 */

function Characteristic(displayName, UUID) {
  this.displayName = displayName;
  this.UUID = UUID;
  this.iid = null; // assigned by our containing Service
  this.format = null;
  this.unit = null;
  this.maximumValue = null;
  this.minimumValue = null;
  this.stepValue = null;
  this.readable = false;
  this.writable = false;
  this.supportsEventNotification = false;
  this.value = null;
}

inherits(Characteristic, EventEmitter);

// Known HomeKit formats
Characteristic.Formats = {
  BOOL: 'bool',
  INT: 'int',
  FLOAT: 'float',
  STRING: 'string',
  ARRAY: 'array', // unconfirmed
  DICTIONARY: 'dictionary', // unconfirmed
  UINT8: 'uint8',
  UINT16: 'uint16',
  UINT32: 'uint32',
  UINT64: 'uint64',
  DATA: 'data', // unconfirmed
  TLV8: 'tlv8'
}

// Known HomeKit unit types
Characteristic.Units = {
  CELSIUS: 'celsius',
  FAHRENHEIT: 'fahrenheit',
  PERCENTAGE: 'percentage',
  ARC_DEGREE: 'arcdegrees',
  LUX: 'lux',
  SECONDS: 'seconds'
}

Characteristic.prototype.getValue = function(callback, context) {
  
  if (this.listeners('get').length > 0) {
    
    // allow a listener to handle the fetching of this value, and wait for completion
    this.emit('get', function(err, newValue) {
      
      if (err) {
        // pass the error along to our callback
        if (callback) callback(err);
      }
      else {
        // getting the value was a success; we can pass it along and also update our cached value
        var oldValue = this.value;
        this.value = newValue;
        if (callback) callback(null, newValue);
        
        // emit a change event if necessary
        if (oldValue !== newValue)
          this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
      }
    
    }.bind(this));
  }
  else {
    
    // no one is listening to the 'get' event, so just return the cached value
    if (callback)
      callback(null, this.value);
  }
}

Characteristic.prototype.setValue = function(newValue, callback, context) {

  if (this.listeners('set').length > 0) {
    
    // allow a listener to handle the setting of this value, and wait for completion
    this.emit('set', newValue, function(err) {
      
      if (err) {
        // pass the error along to our callback
        if (callback) callback(err);
      }
      else {
        // setting the value was a success; so we can cache it now
        var oldValue = this.value;
        this.value = newValue;
        if (callback) callback();

        // emit a change event if necessary
        if (oldValue !== newValue)
          this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
      }
    
    }.bind(this));
    
  }
  else {
    
    // no one is listening to the 'set' event, so just assign the value blindly
    var oldValue = this.value;
    this.value = newValue;
    if (callback) callback();

    // emit a change event if necessary
    if (oldValue !== newValue)
      this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
  }
}

Characteristic.prototype.getDefaultValue = function() {
  switch (this.format) {
    case Characteristic.Formats.BOOL: return false;
    case Characteristic.Formats.STRING: return null;
    case Characteristic.Formats.ARRAY: return []; // who knows!
    case Characteristic.Formats.DICTIONARY: return {}; // who knows!
    case Characteristic.Formats.DATA: return null; // who knows!
    case Characteristic.Formats.TLV8: return null; // who knows!
    default: return this.minimumValue || 0;
  }
}

Characteristic.prototype._assignID = function(identifierCache, accessoryName, serviceUUID) {
  
  // generate our IID based on our UUID
  this.iid = identifierCache.getIID(accessoryName, serviceUUID, this.UUID);
}

/**
 * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
 */
Characteristic.prototype.toHAP = function(opt) {
  
  // build "perms" array
  var permsHAP = [];
  if (this.readable) permsHAP.push('pr');
  if (this.writable) permsHAP.push('pw');
  if (this.supportsEventNotification) permsHAP.push('ev');
  
  var hap = {
    iid: this.iid,
    type: this.UUID,
    perms: permsHAP,
    format: this.format,
    value: this.value,
    description: this.displayName
    
    // These properties used to be sent but do not seem to be used:
    //
    // maxLen: this.format === Characteristic.Formats.STRING ? 255 : 1,
    // events: false,
    // bonjour: false
  };
  
  // extra properties
  if (this.unit != null) hap.unit = this.unit;
  if (this.maximumValue != null) hap.maximumValue = this.maximumValue;
  if (this.minimumValue != null) hap.minimumValue = this.minimumValue;
  if (this.stepValue != null) hap.stepValue = this.stepValue;
  
  // if we're not readable, omit the "value" property - otherwise iOS will complain about non-compliance
  if (!this.readable)
    delete hap.value;

  // delete the "value" property anyway if we were asked to
  if (opt && opt.omitValues)
    delete hap.value;

  return hap;
}
