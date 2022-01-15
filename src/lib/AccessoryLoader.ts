import createDebug from "debug";
import fs from "fs";
import path from "path";
import { CharacteristicValue, Nullable } from "../types";
import { Accessory } from "./Accessory";
import {
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
} from "./Characteristic";
import { Service } from "./Service";
import * as uuid from "./util/uuid";

const debug = createDebug("HAP-NodeJS:AccessoryLoader");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export function parseCharacteristicJSON(json: any): Characteristic {
  const characteristicUUID = json.cType;

  const characteristic = new Characteristic(json.manfDescription || characteristicUUID, characteristicUUID, {
    format: json.format, // example: "int"
    minValue: json.designedMinValue,
    maxValue: json.designedMaxValue,
    minStep: json.designedMinStep,
    unit: json.unit,
    perms: json.perms, // example: ["pw","pr","ev"]
  });

  // copy simple properties
  characteristic.value = json.initialValue;

  // @ts-expect-error: monkey-patch legacy "locals" property which used to exist.
  characteristic.locals = json.locals;

  const updateFunc = json.onUpdate; // optional function(value)
  const readFunc = json.onRead; // optional function(callback(value))
  const registerFunc = json.onRegister; // optional function

  if (updateFunc) {
    characteristic.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      updateFunc(value);
      callback && callback();
    });
  }

  if (readFunc) {
    characteristic.on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readFunc((value: any) => {
        callback(null, value); // old onRead callbacks don't use Error as first param
      });
    });
  }

  if (registerFunc) {
    registerFunc(characteristic);
  }

  return characteristic;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function parseServiceJSON(json: any): Service {
  const serviceUUID = json.sType;

  // build characteristics first, so we can extract the Name (if present)
  const characteristics: Characteristic[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json.characteristics.forEach((characteristicJSON: any) => {
    const characteristic = parseCharacteristicJSON(characteristicJSON);
    characteristics.push(characteristic);
  });

  let displayName: Nullable<CharacteristicValue> = null;

  // extract the "Name" characteristic to use for 'type' discrimination if necessary
  characteristics.forEach((characteristic) => {
    if (characteristic.UUID === "00000023-0000-1000-8000-0026BB765291") { // Characteristic.Name.UUID
      displayName = characteristic.value;
    }
  });

  // Use UUID for "displayName" if necessary, as the JSON structures don't have a value for this
  const service = new Service(displayName || serviceUUID, serviceUUID, `${displayName}`);

  characteristics.forEach((characteristic) => {
    if (characteristic.UUID !== "00000023-0000-1000-8000-0026BB765291") { // Characteristic.Name.UUID, already present in all Services
      service.addCharacteristic(characteristic);
    }
  });

  return service;
}


/**
 * Accepts object-literal JSON structures from previous versions of HAP-NodeJS and parses them into
 * newer-style structures of Accessory/Service/Characteristic objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function parseAccessoryJSON(json: any): Accessory {

  // parse services first so we can extract the accessory name
  const services: Service[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json.services.forEach((serviceJSON: any) => {
    const service = parseServiceJSON(serviceJSON);
    services.push(service);
  });

  let displayName = json.displayName;

  services.forEach((service) => {
    if (service.UUID === "0000003E-0000-1000-8000-0026BB765291") { // Service.AccessoryInformation.UUID
      service.characteristics.forEach((characteristic) => {
        if (characteristic.UUID === "00000023-0000-1000-8000-0026BB765291") {// Characteristic.Name.UUID
          displayName = characteristic.value;
        }
      });
    }
  });

  const accessory = new Accessory(displayName, uuid.generate(displayName));

  // create custom properties for "username" and "pincode" for Core.js to find later (if using Core.js)
  // @ts-expect-error: Core/BridgeCore API
  accessory.username = json.username;
  // @ts-expect-error: Core/BridgeCore API
  accessory.pincode = json.pincode;

  // clear out the default services
  accessory.services.length = 0;

  // add services
  services.forEach((service) => {
    accessory.addService(service);
  });

  return accessory;
}

/**
 * Loads all accessories from the given folder. Handles object-literal-style accessories, "accessory factories",
 * and new-API style modules.
 */
export function loadDirectory(dir: string): Accessory[] {

  // exported accessory objects loaded from this dir
  let accessories: unknown[] = [];

  fs.readdirSync(dir).forEach((file) => {
    const suffix = file.split("_").pop();

    // "Accessories" are modules that export a single accessory.
    if (suffix === "accessory.js" || suffix === "accessory.ts") {
      debug("Parsing accessory: %s", file);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const loadedAccessory = require(path.join(dir, file)).accessory;
      accessories.push(loadedAccessory);
    } else if (suffix === "accfactory.js" ||suffix === "accfactory.ts") { // "Accessory Factories" are modules that export an array of accessories.
      debug("Parsing accessory factory: %s", file);

      // should return an array of objects { accessory: accessory-json }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const loadedAccessories = require(path.join(dir, file));
      accessories = accessories.concat(loadedAccessories);
    }
  });

  // now we need to coerce all accessory objects into instances of Accessory (some or all of them may
  // be object-literal JSON-style accessories)
  return accessories.map((accessory) => {
    if(accessory === null || accessory === undefined) { //check if accessory is not empty
      console.log("Invalid accessory!");
      return false;
    } else {
      return (accessory instanceof Accessory) ? accessory : parseAccessoryJSON(accessory);
    }
  }).filter((accessory: Accessory | false) => {
    return !!accessory;
  }) as Accessory[];
}
