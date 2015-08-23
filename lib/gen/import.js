var path = require('path');
var fs = require('fs');
var plist = require('simple-plist');

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
  
  // index classyName for when we want to declare these in Services below
  characteristics[characteristic.UUID] = classyName;
  
  output.write("/**\n * Characteristic \"" + characteristic.Name + "\"\n */\n\n");
  output.write("Characteristic." + classyName + " = function() {\n");
  output.write("  Characteristic.call(this, '" + characteristic.Name + "', '" + characteristic.UUID + "');\n");
  
  // apply Characteristic properties
  output.write("  this.format = '" + characteristic.Format + "';\n");
  
  // special unit type?
  if (characteristic.Unit)
    output.write("  this.unit = '" + characteristic.Unit + "';\n");
  
  // apply any basic constraints if present
  if (characteristic.Constraints && typeof characteristic.Constraints.MaximumValue !== 'undefined')
    output.write("  this.maximumValue = " + characteristic.Constraints.MaximumValue + ";\n");

  if (characteristic.Constraints && typeof characteristic.Constraints.MinimumValue !== 'undefined')
    output.write("  this.minimumValue = " + characteristic.Constraints.MinimumValue + ";\n");

  if (characteristic.Constraints && typeof characteristic.Constraints.StepValue !== 'undefined')
    output.write("  this.stepValue = " + characteristic.Constraints.StepValue + ";\n");

  // apply Properties via search
  if (characteristic.Properties && characteristic.Properties.indexOf('read') != -1)
    output.write("  this.readable = true;\n");
  
  if (characteristic.Properties && characteristic.Properties.indexOf('write') != -1)
    output.write("  this.writable = true;\n");

  if (characteristic.Properties && characteristic.Properties.indexOf('notify') != -1)
    output.write("  this.supportsEventNotification = true;\n");
  
  output.write("  this.value = this.getDefaultValue();\n");
  output.write("};\n\n");
  output.write("inherits(Characteristic." + classyName + ", Characteristic);\n\n");
  
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
  output.write("Service." + classyName + " = function(displayName) {\n");
  output.write("  Service.call(this, displayName, '" + service.UUID + "');\n");
  
  // apply Service properties
  output.write("  this.name = \"" + service.Name + "\";\n");

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
}


/**
 * Done!
 */

output.end();