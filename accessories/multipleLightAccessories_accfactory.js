var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var lights = [{
  name: "LED1", //visible name of the accessory
  username: "A1:A1:A1:A1:A1:A1", //MAC like address used by HomeKit to differentiate accessories.
  pincode: "031-45-154", //pincode, don't change
  brightnessAvailable: true, //can you control the brightness?
  saturationAndHueAvailable: true, //can you control the saturation and hue?
  logs: true, //print logs?

  manufacturer: "Manufacturer", //optional
  model: "Model", //optional
  serialNumber: "Serial Number" //optional
}, {
  name: "LED2",
  username: "A2:A1:A1:A1:A1:A1",
  pincode: "031-45-154",
  brightnessAvailable: false,
  saturationAndHueAvailable: false,
  logs: true,

  manufacturer: "Manufacturer",
  model: "Model",
  serialNumber: "Serial Number"
}];

/* Creating accessories, you don't need to touch anything down here */

var accessoriesToExport = []; //array containing all accessories

lights.forEach(function(item) { //iterate through each element of array
  item.state = false, item.brightness = 100, item.hue = 0, item.saturation = 0; //default values
  console.log("Loading accessory '%s'", item.name); //inform about loading
  item.setState = function(state) { //set state
    if(item.logs) console.log("Turning the '%s' %s", item.name, state ? "on" : "off");
    item.state = state;
  }
  item.getState = function() { //get current state [on/off]
    if(item.logs) console.log("'%s' is %s.", item.name, item.state ? "on" : "off");
    return item.state;
  }
  item.setBrightness = function(brightness) { //set brightness
    if(item.logs) console.log("Setting '%s' brightness to %s", item.name, brightness);
    item.brightness = brightness;
  }
  item.getBrightness = function() { //get brightness
    if(item.logs) console.log("'%s' brightness is %s", item.name, item.brightness);
    return item.brightness;
  }
  item.setSaturation = function(saturation) { //set brightness
    if(item.logs) console.log("Setting '%s' saturation to %s", item.name, saturation);
    item.saturation = saturation;
  }
  item.getSaturation = function() { //get brightness
    if(item.logs) console.log("'%s' saturation is %s", item.name, item.saturation);
    return item.saturation;
  }
  item.setHue = function(hue) { //set brightness
    if(item.logs) console.log("Setting '%s' hue to %s", item.name, hue);
    item.hue = hue;
  }
  item.getHue = function() { //get hue
    if(item.logs) console.log("'%s' hue is %s", item.name, item.hue);
    return item.hue;
  }
  item.identify = function() {
    if(item.logs) console.log("Identify the '%s'", item.name);
  }

  // Generate a consistent UUID for our light Accessory that will remain the same even when
  // restarting our server. We use the `uuid.generate` helper function to create a deterministic
  // UUID based on an arbitrary "namespace" and the word "light".
  var accUUID = uuid.generate('hap-nodejs:accessories:light:' + item.name + '->' + item.username);

  //this is the Accessory that we'll return to HAP-NodeJS that represents our light
  var accessory = new Accessory(item.name, accUUID);

  //add properties for publishing (in case of using Core.js instead of BridgedCore.js)
  accessory.username = item.username, accessory.pincode = item.pincode;

  //set some basic properties (setting them is optional)
  if(item.manufacturer.length) accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, item.manufacturer)
  if(item.model.length) accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, item.model)
  if(item.serialNumber.length) accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, item.serialNumber);

  accessory.on("identify", function(paired, callback) { //listen for the identify event
    item.identify();
    callback();
  });

  // Add the actual Lightbulb Service and listen for change events from iOS.
  // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`

  accessory.addService(Service.Lightbulb, item.name)
    .getCharacteristic(Characteristic.On)
      .on('set', function(value, callback) {
        item.setState(value);

        // Our light is synchronous - this value has been successfully set
        // Invoke the callback when you finished processing the request
        // If it's going to take more than 1s to finish the request, try to invoke the callback
        // after getting the request instead of after finishing it. This avoids blocking other
        // requests from HomeKit.

        callback();
      })
      // We want to intercept requests for our current power state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', function(callback) {
        callback(null, item.getState());
      });

  // To inform HomeKit about changes occurred outside of HomeKit (like user physically turn on the light)
  // Please use Characteristic.updateValue
  //
  // lightAccessory
  //   .getService(Service.Lightbulb)
  //   .getCharacteristic(Characteristic.On)
  //   .updateValue(true);

  /* Optional characteristics \/  (brightness/saturation/hue) */

  if(item.brightnessAvailable) { //configure brightness
    accessory.getService(Service.Lightbulb)
      .addCharacteristic(Characteristic.Brightness)
        .on('set', function(value, callback) {
          item.setBrightness(value);
          callback();
        })
        .on('get', function(callback) {
          callback(null, item.getBrightness());
        });
  }

  if(item.saturationAndHueAvailable) { //configure saturation and hue
    accessory.getService(Service.Lightbulb)
      .addCharacteristic(Characteristic.Saturation)
        .on('set', function(value, callback) {
          item.setSaturation(value);
          callback();
        })
        .on('get', function(callback) {
          callback(null, item.getSaturation());
        });
    accessory.getService(Service.Lightbulb)
      .addCharacteristic(Characteristic.Hue)
        .on('set', function(value, callback) {
          item.setHue(value);
          callback();
        })
        .on('get', function(callback) {
          callback(null, item.getHue());
        });
  }

  accessoriesToExport.push(accessory); //push accessory to array
});

module.exports = accessoriesToExport; //export all accessories


//written by OczkoSX
