var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

//In This example we create an Airconditioner Accessory that Has a Thermostat linked to a Fan Service.
//For example, I've also put a Light Service that should be hidden to represent a light in the closet that is part of the AC. It is to show how to hide services.
//The linking and Hiding does NOT appear to be reflected in Home

// here's a fake hardware device that we'll expose to HomeKit
var ACTest_data = {
  fanPowerOn: false,
  rSpeed: 100,
  CurrentHeatingCoolingState: 1,
  TargetHeatingCoolingState: 1,
  CurrentTemperature: 33,
  TargetTemperature: 32,
  TemperatureDisplayUnits: 1,
  LightOn: false
}

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake fan.
var ACTest = exports.accessory = new Accessory('Fan', uuid.generate('hap-nodejs:accessories:Fan'));

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
ACTest.username = "1A:2B:3C:4D:5E:FF";
ACTest.pincode = "031-45-154";

// set some basic properties (these values are arbitrary and setting them is optional)
ACTest
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Sample Company")

// listen for the "identify" event for this Accessory
ACTest.on('identify', function(paired, callback) {
  console.log("Fan Identified!");
  callback(); // success
});

// Add the actual Fan Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`

var FanService = ACTest.addService(Service.Fan, "Blower") // services exposed to the user should have "names" like "Fake Light" for us
FanService.getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    console.log("Fan Power Changed To "+value);
    ACTest_data.fanPowerOn=value
    callback(); // Our fake Fan is synchronous - this value has been successfully set
  });

// We want to intercept requests for our current power state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
FanService.getCharacteristic(Characteristic.On)
  .on('get', function(callback) {

    // this event is emitted when you ask Siri directly whether your fan is on or not. you might query
    // the fan hardware itself to find this out, then call the callback. But if you take longer than a
    // few seconds to respond, Siri will give up.

    var err = null; // in case there were any problems

    if (ACTest_data.fanPowerOn) {
      callback(err, true);
    }
    else {
      callback(err, false);
    }
  });


// also add an "optional" Characteristic for spped
FanService.addCharacteristic(Characteristic.RotationSpeed)
  .on('get', function(callback) {
    callback(null, ACTest_data.rSpeed);
  })
  .on('set', function(value, callback) {
    console.log("Setting fan rSpeed to %s", value);
    ACTest_data.rSpeed=value
    callback();
  })

var ThermostatService = ACTest.addService(Service.Thermostat,"Thermostat");
ThermostatService.addLinkedService(FanService);

ThermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)

  .on('get', function(callback) {
    callback(null, ACTest_data.CurrentHeatingCoolingState);
  })
  .on('set',function(value, callback) {
      ACTest_data.CurrentHeatingCoolingState=value;
      console.log( "Characteristic CurrentHeatingCoolingState changed to %s",value);
      callback();
    });

 ThermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
  .on('get', function(callback) {
    callback(null, ACTest_data.TargetHeatingCoolingState);
  })
  .on('set',function(value, callback) {
      ACTest_data.TargetHeatingCoolingState=value;
      console.log( "Characteristic TargetHeatingCoolingState changed to %s",value);
      callback();
    });

 ThermostatService.getCharacteristic(Characteristic.CurrentTemperature)
  .on('get', function(callback) {
    callback(null, ACTest_data.CurrentTemperature);
  })
  .on('set',function(value, callback) {
      ACTest_data.CurrentTemperature=value;
      console.log( "Characteristic CurrentTemperature changed to %s",value);
      callback();
    });

 ThermostatService.getCharacteristic(Characteristic.TargetTemperature)
  .on('get', function(callback) {
    callback(null, ACTest_data.TargetTemperature);
  })
  .on('set',function(value, callback) {
      ACTest_data.TargetTemperature=value;
      console.log( "Characteristic TargetTemperature changed to %s",value);
      callback();
    });

 ThermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
  .on('get', function(callback) {
    callback(null, ACTest_data.TemperatureDisplayUnits);
  })
  .on('set',function(value, callback) {
      ACTest_data.TemperatureDisplayUnits=value;
      console.log( "Characteristic TemperatureDisplayUnits changed to %s",value);
      callback();
    });
    


var LightService = ACTest.addService(Service.Lightbulb, 'AC Light');
LightService.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      callback(null, ACTest_data.LightOn);
    })
    .on('set', function(value, callback) {
      ACTest_data.LightOn=value;
      console.log( "Characteristic Light On changed to %s",value);
      callback();
    });
LightService.setHiddenService(true);
ACTest.setPrimaryService(ThermostatService);