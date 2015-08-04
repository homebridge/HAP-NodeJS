var fs = require('fs');
var path = require('path');
var Accessory = require('./Accessory').Accessory;
var Service = require('./Service').Service;
var Characteristic = require('./Characteristic').Characteristic;
var uuid = require('./util/uuid');
var storage = require('node-persist');

module.exports = {
  loadDirectory: loadDirectory,
  parseAccessoryJSON: parseAccessoryJSON,
  parseServiceJSON: parseServiceJSON,
  parseCharacteristicJSON: parseCharacteristicJSON
};

/**
 * Loads all accessories from the given folder. Handles object-literal-style accessories, "accessory factories",
 * and new-API style modules.
 */

function loadDirectory(dir) {
  
  // exported accessory objects loaded from this dir
  var accessories = [];

  fs.readdirSync(dir).forEach(function(file) {
        
    // "Accessories" are modules that export a single accessory.
    if (file.split('_').pop() === "accessory.js") {
      console.log("Parsing accessory: " + file);
      
      var loadedAccessory = require(path.join(dir, file)).accessory;
      accessories.push(loadedAccessory);
    }
    // "Accessory Factories" are modules that export an array of accessories.
    else if (file.split('_').pop() === "accfactory.js") {
      console.log("Parsing accessory factory: " + file);
      
      // should return an array of objects { accessory: accessory-json }
      var loadedAccessories = require(path.join(dir, file));
      accessories = accessories.concat(loadedAccessories);
    }
  });
  
  // now we need to coerce all accessory objects into instances of Accessory (some or all of them may
  // be object-literal JSON-style accessories)
  return accessories.map(function(accessory) {
    return (accessory instanceof Accessory) ? accessory : parseAccessoryJSON(accessory);
  })
}

/**
 * Accepts object-literal JSON structures from previous versions of HAP-NodeJS and parses them into
 * newer-style structures of Accessory/Service/Characteristic objects.
 */

function parseAccessoryJSON(json) {

  // parse services first so we can extract the accessory name
  var services = [];
  
  json.services.forEach(function(serviceJSON) {
    var service = parseServiceJSON(serviceJSON);
    services.push(service);
  });
  
  var displayName = json.displayName;
  
  services.forEach(function(service) {
    if (service.UUID == '0000003E-0000-1000-8000-0026BB765291') // Service.AccessoryInformation.UUID
      service.characteristics.forEach(function(characteristic) {
        if (characteristic.UUID == '00000023-0000-1000-8000-0026BB765291') // Characteristic.Name.UUID
          displayName = characteristic.value;
      });
  });
  console.log("Creating accessory with name " + displayName);
  var accessory = new Accessory(displayName, uuid.generate(displayName));

  // create custom properties for "username" and "pincode" for Core.js to find later (if using Core.js)
  accessory.username = json.username;
  accessory.pincode = json.pincode;
  
  // clear out the default services
  accessory.services.length = 0;
  
  // add services
  services.forEach(function(service) {
    accessory.addService(service);
  });
  
  return accessory;
}

function parseServiceJSON(json) {
  var serviceUUID = json.sType;
  
  // Use UUID for "displayName" as the JSON structures don't have a value for this
  var service = new Service(serviceUUID, serviceUUID);
  
  json.characteristics.forEach(function(characteristicJSON) {
    var characteristic = parseCharacteristicJSON(characteristicJSON);
    service.addCharacteristic(characteristic);
  })
  
  return service;
}

function parseCharacteristicJSON(json) {
  var characteristicUUID = json.cType;
    
  var characteristic = new Characteristic(json.manfDescription || characteristicUUID, characteristicUUID);
  
  // copy simple properties
  characteristic.format = json.format; // example: "int"
  characteristic.value = json.initialValue;
  characteristic.minValue = json.designedMinValue;
  characteristic.maxValue = json.designedMaxValue;
  characteristic.step = json.designedMinStep;
  characteristic.unit = json.unit
  
  // create custom property
  characteristic.locals = json.locals;
  
  // extract perms
  var perms = json.perms; // example: ["pw","pr","ev"]
  characteristic.readable = (perms.indexOf('pr') > -1);
  characteristic.writable = (perms.indexOf('pw') > -1);
  characteristic.supportsEventNotification = (perms.indexOf('ev') > -1);
  
  var updateFunc = json.onUpdate; // optional function(value)
  var readFunc = json.onRead; // optional function(callback(value))
  var registerFunc = json.onRegister; // optional function
  
  if (updateFunc) {
    characteristic.on('set', function(value, callback) {
      updateFunc(value);
      callback();
    });
  }
  
  if (readFunc) {
    characteristic.on('get', function(callback) {
      readFunc(function(value) {
        callback(null, value); // old onRead callbacks don't use Error as first param
      });
    });
  }
  
  if (registerFunc) {
    registerFunc(characteristic);
  }
  
  return characteristic;
}