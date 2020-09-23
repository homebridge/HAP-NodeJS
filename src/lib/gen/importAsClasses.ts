/// <reference path="../../../@types/simple-plist.d.ts" />
import fs from 'fs';
import path from 'path';
import plist from 'simple-plist';
import { Formats, Units } from "../Characteristic";

/**
 * This module is intended to be run from the command line. It is a script that extracts Apple's Service
 * and Characteristic UUIDs and structures from Apple's own HomeKit Accessory Simulator app.
 */
const plistPath = '/Applications/HomeKit Accessory Simulator.app/Contents/Frameworks/HAPAccessoryKit.framework/Versions/A/Resources/default.metadata.plist';
const metadata = plist.readFileSync(plistPath);

// begin writing the output file
const outputPath = path.join(__dirname, '..', '..', '..', 'src', 'lib', 'gen', 'HomeKitTypes.generated.ts');
const output = fs.createWriteStream(outputPath);

output.write("// THIS FILE IS AUTO-GENERATED - DO NOT MODIFY\n");
output.write("\n");
// output.write("var inherits = require('util').inherits;\n");
output.write("import {\n");
output.write("  Characteristic,\n");
output.write("  CharacteristicProps,\n");
output.write("  Formats,\n");
output.write("  Perms,\n");
output.write("  Units,\n");
output.write("} from '../Characteristic';\n");
output.write("import { Service } from '../Service';\n");
output.write("\n");

/**
 * Characteristics
 */

// index Characteristics for quick access while building Services
const characteristics: Record<string, string> = {}; // characteristics[UUID] = classyName

for (let index in metadata.Characteristics) {
  const characteristic = metadata.Characteristics[index];
  let classyName = characteristic.Name.replace(/[\s\-]/g, ""); // "Target Door State" -> "TargetDoorState"
  classyName = classyName.replace(/[.]/g, "_"); // "PM2.5" -> "PM2_5"

  // index classyName for when we want to declare these in Services below
  characteristics[characteristic.UUID] = classyName;

  output.write(`/**\n * Characteristic "${characteristic.Name}"\n */\n\n`);
  output.write(`export class ${classyName} extends Characteristic {\n\n`);
  output.write(`  static readonly UUID: string = "${characteristic.UUID}";\n\n`);

  if (characteristic.Constraints && characteristic.Constraints.ValidValues) {
    // this characteristic can only have one of a defined set of values (like an enum). Define the values
    // as static members of our subclass.
    output.write("  // The value property of " + classyName + " must be one of the following:\n");

    for (let value in characteristic.Constraints.ValidValues) {
      const name = characteristic.Constraints.ValidValues[value];

      let constName = name.toUpperCase().replace(/[^\w]+/g, '_');
      if ((/^[1-9]/).test(constName)) constName = "_" + constName; // variables can't start with a number
      output.write(`  static readonly ${constName} = ${value};\n`);
    }
    output.write('\n');
  }

  // constructor
  output.write("  constructor(\n");
  output.write("    displayName = \"\",\n");
  output.write("    props?: CharacteristicProps,\n");
  output.write("  ) {\n");
  output.write("    props = props || {\n");

  // apply Characteristic properties
  // output.write("  this.setProps({\n");
  output.write("      format: Formats." + getCharacteristicFormatsKey(characteristic.Format));

  // special unit type?
  if (characteristic.Unit)
    output.write(",\n      unit: Units." + getCharacteristicUnitsKey(characteristic.Unit));

  // apply any basic constraints if present
  if (characteristic.Constraints && typeof characteristic.Constraints.MaximumValue !== 'undefined')
    output.write(",\n      maxValue: " + characteristic.Constraints.MaximumValue);

  if (characteristic.Constraints && typeof characteristic.Constraints.MinimumValue !== 'undefined')
    output.write(",\n      minValue: " + characteristic.Constraints.MinimumValue);

  if (characteristic.Constraints && typeof characteristic.Constraints.StepValue !== 'undefined')
    output.write(",\n      minStep: " + characteristic.Constraints.StepValue);

  output.write(",\n      perms: [");
  let sep = "";
  for (let i in characteristic.Properties) {
    const perms = getCharacteristicPermsKey(characteristic.Properties[i]);
    if (perms) {
        output.write(sep + "Perms." + getCharacteristicPermsKey(characteristic.Properties[i]));
        sep = ", "
    }
  }
  output.write("]");

  output.write("\n    };\n");
  output.write(`    super(displayName, ${classyName}.UUID, props);\n\n`);
  output.write("    this.value = this.getDefaultValue();\n");
  output.write(`  }\n`);

  // set default value

  output.write("};\n\n");
  // output.write("inherits(Characteristic." + classyName + ", Characteristic);\n\n");
  // output.write("Characteristic." + classyName + ".UUID = '" + characteristic.UUID + "';\n\n");
}

/**
 * Services
 */

for (let index in metadata.Services) {
  const service = metadata.Services[index];
  const classyName = service.Name.replace(/[\s\-]/g, ""); // "Smoke Sensor" -> "SmokeSensor"

  output.write(`/**\n * Service "${service.Name}"\n */\n\n`);
  output.write(`export class ${classyName} extends Service {\n\n`);
  output.write(`  static readonly UUID = '${service.UUID}';\n\n`);

  // constructor
  output.write("  constructor(displayName: string, subtype: string) {\n");
  output.write("    super(displayName, ${classyName}.UUID, subtype);\n\n");

  // add Characteristics for this Service
  if (service.RequiredCharacteristics) {
    output.write("\n    // Required Characteristics\n");

    for (let index in service.RequiredCharacteristics) {
      let characteristicUUID = service.RequiredCharacteristics[index];

      // look up the classyName from the hash we built above
      let characteristicClassyName = characteristics[characteristicUUID];

      output.write("    this.addCharacteristic(Characteristic." + characteristicClassyName + ");\n");
    }
  }

  // add "Optional" Characteristics for this Service
  if (service.OptionalCharacteristics) {
    output.write("\n    // Optional Characteristics\n");

    for (let index in service.OptionalCharacteristics) {
      let characteristicUUID = service.OptionalCharacteristics[index];

      // look up the classyName from the hash we built above
      let characteristicClassyName = characteristics[characteristicUUID];

      output.write("    this.addOptionalCharacteristic(Characteristic." + characteristicClassyName + ");\n");
    }
  }

  output.write("  }\n");
  output.write("}\n\n");
}

output.write("var HomeKitTypesBridge = require('./HomeKitTypes-Bridge');\n\n");

/**
 * Done!
 */

output.end();

/**
 * Useful functions
 */

function getCharacteristicFormatsKey(format: string) {
  // coerce 'int32' to 'int'
  if (format == 'int32') format = 'int';

  // look up the key in our known-formats dict
  // @ts-ignore
  for (let key in Formats) {
    // @ts-ignore
    if (Formats[key as keyof typeof Formats] == format) {
      return key;
    }
  }

  throw new Error("Unknown characteristic format '" + format + "'");
}

function getCharacteristicUnitsKey(units: string) {
  // look up the key in our known-units dict
  // @ts-ignore
  for (let key in Units) {
    // @ts-ignore
    if (Units[key as keyof typeof Units] == units) {
      return key;
    }
  }

  throw new Error("Unknown characteristic units '" + units + "'");
}

function getCharacteristicPermsKey(perm: string) {
  switch (perm) {
    case "read": return "READ";
    case "write": return "WRITE";
    case "cnotify": return "NOTIFY";
    case "uncnotify": return undefined;
    default: throw new Error("Unknown characteristic permission '" + perm + "'");
  }
}
