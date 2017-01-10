'use strict';

var path = require('path');
var fs = require('fs');
var plist = require('simple-plist');
var Characteristic = require('../Characteristic').Characteristic;

/**
 * This module is intended to be run from the command line. It is a script that extracts Apple's Service
 * and Characteristic UUIDs and structures from Apple's own HomeKit Accessory Simulator app.
 */

// assumed location of the plist we need (might want to make this a command-line argument at some point)
var plistPath = '/Applications/HomeKit Accessory Simulator.app/Contents/Frameworks/HAPAccessoryKit.framework/Versions/A/Resources/default.metadata.plist';
var metadata = plist.readFileSync(plistPath);

// begin writing the output file
var outputPath = path.join(__dirname, 'HomeKitTypes.js');
var output = fs.createWriteStream(outputPath);

output.write("// THIS FILE IS AUTO-GENERATED - DO NOT MODIFY\n");
output.write("\n");
output.write("var inherits = require('util').inherits;\n");
output.write("var Characteristic = require('../Characteristic').Characteristic;\n");
output.write("var Service = require('../Service').Service;\n");
output.write("\n");

/**
 * Characteristics
 */

// index Characteristics for quick access while building Services
var characteristics = {}; // characteristics[UUID] = classyName

for (var index in metadata.Characteristics) {
  var characteristic = metadata.Characteristics[index];
  var classyName = characteristic.Name.replace(/[\s\-]/g, ""); // "Target Door State" -> "TargetDoorState"
  classyName = classyName.replace(/[.]/g, "_"); // "PM2.5" -> "PM2_5"

  // index classyName for when we want to declare these in Services below
  characteristics[characteristic.UUID] = classyName;

  output.write("/**\n * Characteristic \"" + characteristic.Name + "\"\n */\n\n");
  output.write("Characteristic." + classyName + " = function() {\n");
  output.write("  Characteristic.call(this, '" + characteristic.Name + "', '" + characteristic.UUID + "');\n");

  // apply Characteristic properties
  output.write("  this.setProps({\n");
  output.write("    format: Characteristic.Formats." + getCharacteristicFormatsKey(characteristic.Format));

  // special unit type?
  if (characteristic.Unit)
    output.write(",\n    unit: Characteristic.Units." + getCharacteristicUnitsKey(characteristic.Unit));

  // apply any basic constraints if present
  if (characteristic.Constraints && typeof characteristic.Constraints.MaximumValue !== 'undefined')
    output.write(",\n    maxValue: " + characteristic.Constraints.MaximumValue);

  if (characteristic.Constraints && typeof characteristic.Constraints.MinimumValue !== 'undefined')
    output.write(",\n    minValue: " + characteristic.Constraints.MinimumValue);

  if (characteristic.Constraints && typeof characteristic.Constraints.StepValue !== 'undefined')
    output.write(",\n    minStep: " + characteristic.Constraints.StepValue);

  output.write(",\n    perms: [");
  var sep = ""
  for (var i in characteristic.Properties) {
    var perms = getCharacteristicPermsKey(characteristic.Properties[i]);
    if (perms) {
        output.write(sep + "Characteristic.Perms." + getCharacteristicPermsKey(characteristic.Properties[i]));
        sep = ", "
    }
  }
  output.write("]");

  output.write("\n  });\n");

  // set default value
  output.write("  this.value = this.getDefaultValue();\n");

  output.write("};\n\n");
  output.write("inherits(Characteristic." + classyName + ", Characteristic);\n\n");
  output.write("Characteristic." + classyName + ".UUID = '" + characteristic.UUID + "';\n\n");

  if (characteristic.Constraints && characteristic.Constraints.ValidValues) {
    // this characteristic can only have one of a defined set of values (like an enum). Define the values
    // as static members of our subclass.
    output.write("// The value property of " + classyName + " must be one of the following:\n");

    for (var value in characteristic.Constraints.ValidValues) {
      var name = characteristic.Constraints.ValidValues[value];

      var constName = name.toUpperCase().replace(/[^\w]+/g, '_');
      if ((/^[1-9]/).test(constName)) constName = "_" + constName; // variables can't start with a number
      output.write("Characteristic." + classyName + "." + constName + " = " + value + ";\n");
    }

    output.write("\n");
  }
}


/**
 * Services
 */

for (var index in metadata.Services) {
  var service = metadata.Services[index];
  var classyName = service.Name.replace(/[\s\-]/g, ""); // "Smoke Sensor" -> "SmokeSensor"

  output.write("/**\n * Service \"" + service.Name + "\"\n */\n\n");
  output.write("Service." + classyName + " = function(displayName, subtype) {\n");
  // call superclass constructor
  output.write("  Service.call(this, displayName, '" + service.UUID + "', subtype);\n");

  // add Characteristics for this Service
  if (service.RequiredCharacteristics) {
    output.write("\n  // Required Characteristics\n");

    for (var index in service.RequiredCharacteristics) {
      var characteristicUUID = service.RequiredCharacteristics[index];

      // look up the classyName from the hash we built above
      var characteristicClassyName = characteristics[characteristicUUID];

      output.write("  this.addCharacteristic(Characteristic." + characteristicClassyName + ");\n");
    }
  }

  // add "Optional" Characteristics for this Service
  if (service.OptionalCharacteristics) {
    output.write("\n  // Optional Characteristics\n");

    for (var index in service.OptionalCharacteristics) {
      var characteristicUUID = service.OptionalCharacteristics[index];

      // look up the classyName from the hash we built above
      var characteristicClassyName = characteristics[characteristicUUID];

      output.write("  this.addOptionalCharacteristic(Characteristic." + characteristicClassyName + ");\n");
    }
  }

  output.write("};\n\n");
  output.write("inherits(Service." + classyName + ", Service);\n\n");
  output.write("Service." + classyName + ".UUID = '" + service.UUID + "';\n\n");
}

output.write("var HomeKitTypesBridge = require('./HomeKitTypes-Bridge');\n\n");

/**
 * Done!
 */

output.end();

/**
 * Useful functions
 */

function getCharacteristicFormatsKey(format) {
  // coerce 'int32' to 'int'
  if (format == 'int32') format = 'int';

  // look up the key in our known-formats dict
  for (var key in Characteristic.Formats)
    if (Characteristic.Formats[key] == format)
      return key;

  throw new Error("Unknown characteristic format '" + format + "'");
}

function getCharacteristicUnitsKey(units) {
  // look up the key in our known-units dict
  for (var key in Characteristic.Units)
    if (Characteristic.Units[key] == units)
      return key;

  throw new Error("Unknown characteristic units '" + units + "'");
}

function getCharacteristicPermsKey(perm) {
  switch (perm) {
    case "read": return "READ";
    case "write": return "WRITE";
    case "cnotify": return "NOTIFY";
    case "uncnotify": return undefined;
    default: throw new Error("Unknown characteristic permission '" + perm + "'");
  }
}
