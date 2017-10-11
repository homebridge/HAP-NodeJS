'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var once = require('./util/once').once;
var Decimal = require('decimal.js');

module.exports = {
  Characteristic: Characteristic
};


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

function Characteristic(displayName, UUID, props) {
  this.displayName = displayName;
  this.UUID = UUID;
  this.iid = null; // assigned by our containing Service
  this.value = null;
  this.eventOnlyCharacteristic = false;
  this.props = props || {
    format: null,
    unit: null,
    minValue: null,
    maxValue: null,
    minStep: null,
    perms: []
  };
}

inherits(Characteristic, EventEmitter);

// Known HomeKit formats
Characteristic.Formats = {
  BOOL: 'bool',
  INT: 'int',
  FLOAT: 'float',
  STRING: 'string',
  UINT8: 'uint8',
  UINT16: 'uint16',
  UINT32: 'uint32',
  UINT64: 'uint64',
  DATA: 'data',
  TLV8: 'tlv8',
  ARRAY: 'array', //Not in HAP Spec
  DICTIONARY: 'dictionary' //Not in HAP Spec
}

// Known HomeKit unit types
Characteristic.Units = {
  // HomeKit only defines Celsius, for Fahrenheit, it requires iOS app to do the conversion.
  CELSIUS: 'celsius',
  PERCENTAGE: 'percentage',
  ARC_DEGREE: 'arcdegrees',
  LUX: 'lux',
  SECONDS: 'seconds'
}

// Known HomeKit permission types
Characteristic.Perms = {
  READ: 'pr', //Kept for backwards compatability
  PAIRED_READ: 'pr', //Added to match HAP's terminology
  WRITE: 'pw', //Kept for backwards compatability
  PAIRED_WRITE: 'pw', //Added to match HAP's terminology
  NOTIFY: 'ev', //Kept for backwards compatability
  EVENTS: 'ev', //Added to match HAP's terminology
  ADDITIONAL_AUTHORIZATION: 'aa',
  TIMED_WRITE: 'tw', //Not currently supported by IP
  HIDDEN: 'hd'
}

/**
 * Copies the given properties to our props member variable,
 * and returns 'this' for chaining.
 *
 * @param 'props' {
 *   format: <one of Characteristic.Formats>,
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

Characteristic.prototype.setProps = function(props) {
  for (var key in (props || {}))
    if (Object.prototype.hasOwnProperty.call(props, key))
      this.props[key] = props[key];
  return this;
}

Characteristic.prototype.getValue = function(callback, context, connectionID) {
  // Handle special event only characteristics.
  if (this.eventOnlyCharacteristic === true) {
    if (callback) {
      callback(null, null);
    }

    return;
  }

  if (this.listeners('get').length > 0) {

    // allow a listener to handle the fetching of this value, and wait for completion
    this.emit('get', once(function(err, newValue) {

      if (err) {
        // pass the error along to our callback
        if (callback) callback(err);
      }
      else {
        newValue = this.validateValue(newValue); //validateValue returns a value that has be cooerced into a valid value.
        if (newValue === undefined || newValue === null)
          newValue = this.getDefaultValue();

        // getting the value was a success; we can pass it along and also update our cached value
        var oldValue = this.value;
        this.value = newValue;
        if (callback) callback(null, newValue);

        // emit a change event if necessary
        if (oldValue !== newValue)
          this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
      }

    }.bind(this)), context, connectionID);
  }
  else {

    // no one is listening to the 'get' event, so just return the cached value
    if (callback)
      callback(null, this.value);
  }
}

Characteristic.prototype.validateValue = function(newValue) {

 var isNumericType = false;
 var minValue_resolved = 0;
 var maxValue_resolved = 0;
 var minStep_resolved = undefined;
 var stepDecimals = 0;

  switch(this.props.format) {
    case 'int':
      minStep_resolved=1;
      minValue_resolved=-2147483648;
      maxValue_resolved=2147483647;
      isNumericType=true;
      break;
    case 'float':
      minStep_resolved=undefined;
      minValue_resolved=undefined;
      maxValue_resolved=undefined;
      isNumericType=true;
      break;
    case 'uint8':
      minStep_resolved=1;
      minValue_resolved=0;
      maxValue_resolved=255;
      isNumericType=true;
      break;
    case 'uint16':
      minStep_resolved=1;
      minValue_resolved=0;
      maxValue_resolved=65535;
      isNumericType=true;
      break;
    case 'uint32':
      minStep_resolved=1;
      minValue_resolved=0;
      maxValue_resolved=4294967295;
      isNumericType=true;
      break;
    case 'uint64':
      minStep_resolved=1;
      minValue_resolved=0;
      maxValue_resolved=18446744073709551615;
      isNumericType=true;
      break;
    //All of the following datatypes return from this switch.    
     case 'bool':
      return (newValue == true); //We don't need to make sure this returns true or false
      break;
    case 'string':
      var myString = newValue || ''; //If null or undefined or anything odd, make it a blank string
      myString = String(myString);
      var maxLength = this.props.maxLen;
      if (maxLength === undefined) maxLength=64; //Default Max Length is 64.
      if (myString.length>maxLength) myString = myString.substring(0,maxLength); //Truncate strings that are too long
      return myString; //We don't need to do any validation after having truncated the string   
      break;
    case 'data':
      var maxLength = this.props.maxDataLen;
      if (maxLength===undefined) maxLength=2097152; //Default Max Length is 2097152.
      //if (newValue.length>maxLength) //I don't know the best way to handle this since it's unknown binary data.
      //I suspect that it will crash HomeKit for this bridge if the length is too long.
      return newValue;
      break;
    case 'tlv8':
      //Should we parse this to make sure the tlv8 is valid?
      break;
    default: //Datatype out of HAP Spec encountered. We'll assume the developer knows what they're doing.
      return newValue;
    };
    
  if (isNumericType) {
    if (isNaN(newValue)) return this.value; //This is not a number so we'll just pass out the last value.
    if (newValue === false) return 0;
    if (newValue === true) return 1;
    if ((!isNaN(this.props.maxValue))&&(this.props.maxValue!==null)) maxValue_resolved=this.props.maxValue;
    if ((!isNaN(this.props.minValue))&&(this.props.minValue!==null)) minValue_resolved=this.props.minValue;
    if ((!isNaN(this.props.minStep))&&(this.props.minStep!==null)) minStep_resolved=this.props.minStep;
  
    if (newValue<minValue_resolved) newValue = minValue_resolved; //Fails Minimum Value Test
    if (newValue>maxValue_resolved) newValue = maxValue_resolved; //Fails Maximum Value Test
    if (minStep_resolved!==undefined) {
      //Determine how many decimals we need to display
      if (Math.floor(minStep_resolved) === minStep_resolved) 
        stepDecimals = 0;
      else
        stepDecimals = minStep_resolved.toString().split(".")[1].length || 0;

      //Use Decimal to detemine the lowest value within the step.
      try {
        var decimalVal = new Decimal(newValue);
        var decimalDiff = decimalVal.mod(minStep_resolved);
        decimalVal = decimalVal.minus(decimalDiff);
        if (stepDecimals === 0) {
          newValue = parseInt(decimalVal.toFixed(0));
        } else {
          newValue = parseFloat(decimalVal.toFixed(stepDecimals)); //Convert it to a fixed decimal
        }
      } catch (e) {
        return this.value; //If we had an error, return the current value.
      }      
    }

    if (this['valid-values']!==undefined) 
      if (!this['valid-values'].includes(newValue)) return this.value; //Fails Valid Values Test
    if (this['valid-values-range']!==undefined) { //This is another way Apple has to handle min/max
      if (newValue<this['valid-values-range'][0]) newValue=this['valid-values-range'][0];
      if (newValue>this['valid-values-range'][1]) newValue=this['valid-values-range'][1];
    }
  }
  return newValue;
}

Characteristic.prototype.setValue = function(newValue, callback, context, connectionID) {
  newValue = this.validateValue(newValue); //validateValue returns a value that has be cooerced into a valid value.

  if (this.listeners('set').length > 0) {

    // allow a listener to handle the setting of this value, and wait for completion
    this.emit('set', newValue, once(function(err) {

      if (err) {
        // pass the error along to our callback
        if (callback) callback(err);
      }
      else {
        if (newValue === undefined || newValue === null)
          newValue = this.getDefaultValue();
        // setting the value was a success; so we can cache it now
        var oldValue = this.value;
        this.value = newValue;
        if (callback) callback();

        if (this.eventOnlyCharacteristic === true || oldValue !== newValue)
          this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
      }

    }.bind(this)), context, connectionID);

  }
  else {
    if (newValue === undefined || newValue === null)
      newValue = this.getDefaultValue();
    // no one is listening to the 'set' event, so just assign the value blindly
    var oldValue = this.value;
    this.value = newValue;
    if (callback) callback();

    if (this.eventOnlyCharacteristic === true || oldValue !== newValue)
      this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
  }

  return this; // for chaining
}

Characteristic.prototype.updateValue = function(newValue, callback, context) {
  newValue = this.validateValue(newValue); //validateValue returns a value that has be cooerced into a valid value.
  
  if (newValue === undefined || newValue === null)
    newValue = this.getDefaultValue();
    // no one is listening to the 'set' event, so just assign the value blindly
  var oldValue = this.value;
  this.value = newValue;
  if (callback) callback();

  if (this.eventOnlyCharacteristic === true || oldValue !== newValue)
    this.emit('change', { oldValue:oldValue, newValue:newValue, context:context });
  return this; // for chaining
}

Characteristic.prototype.getDefaultValue = function() {
  switch (this.props.format) {
    case Characteristic.Formats.BOOL: return false;
    case Characteristic.Formats.STRING: return "";
    case Characteristic.Formats.DATA: return null; // who knows!
    case Characteristic.Formats.TLV8: return null; // who knows!
    default: return this.props.minValue || 0;
  }
}

Characteristic.prototype._assignID = function(identifierCache, accessoryName, serviceUUID, serviceSubtype) {

  // generate our IID based on our UUID
  this.iid = identifierCache.getIID(accessoryName, serviceUUID, serviceSubtype, this.UUID);
}

/**
 * Returns a JSON representation of this Accessory suitable for delivering to HAP clients.
 */
Characteristic.prototype.toHAP = function(opt) {

  // ensure our value fits within our constraints if present
  var value = this.value;
  if (this.props.minValue != null && value < this.props.minValue) value = this.props.minValue;
  if (this.props.maxValue != null && value > this.props.maxValue) value = this.props.maxValue;
  if (this.props.format != null) {
    if (this.props.format === Characteristic.Formats.INT)
      value = parseInt(value);
    else if (this.props.format === Characteristic.Formats.UINT8)
      value = parseInt(value);
    else if (this.props.format === Characteristic.Formats.UINT16)
      value = parseInt(value);
    else if (this.props.format === Characteristic.Formats.UINT32)
      value = parseInt(value);
    else if (this.props.format === Characteristic.Formats.UINT64)
      value = parseInt(value);
    else if (this.props.format === Characteristic.Formats.FLOAT) {
      value = parseFloat(value);
      if (this.props.minStep != null) {
        var pow = Math.pow(10, decimalPlaces(this.props.minStep));
        value = Math.round(value * pow) / pow;
      }
    }
  }

  if (this.eventOnlyCharacteristic === true) {
    value = null;
  }

  var hap = {
    iid: this.iid,
    type: this.UUID,
    perms: this.props.perms,
    format: this.props.format,
    value: value,
    description: this.displayName

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
  if (this.props.unit != null) hap.unit = this.props.unit;
  if (this.props.maxValue != null) hap.maxValue = this.props.maxValue;
  if (this.props.minValue != null) hap.minValue = this.props.minValue;
  if (this.props.minStep != null) hap.minStep = this.props.minStep;

  // add maxLen if string length is > 64 bytes and trim to max 256 bytes
  if (this.props.format === Characteristic.Formats.STRING) {
    var str = new Buffer(value, 'utf8'),
        len = str.byteLength;
    if (len > 256) { // 256 bytes is the max allowed length
      hap.value = str.toString('utf8', 0, 256);
      hap.maxLen = 256;
    } else if (len > 64) { // values below can be ommited
      hap.maxLen = len;
    }
  }

  // if we're not readable, omit the "value" property - otherwise iOS will complain about non-compliance
  if (this.props.perms.indexOf(Characteristic.Perms.READ) == -1)
    delete hap.value;

  // delete the "value" property anyway if we were asked to
  if (opt && opt.omitValues)
    delete hap.value;

  return hap;
}

// Mike Samuel
// http://stackoverflow.com/questions/10454518/javascript-how-to-retrieve-the-number-of-decimals-of-a-string-number
function decimalPlaces(num) {
  var match = (''+num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) { return 0; }
  return Math.max(
       0,
       // Number of digits right of decimal point.
       (match[1] ? match[1].length : 0)
       // Adjust for scientific notation.
       - (match[2] ? +match[2] : 0));
}
