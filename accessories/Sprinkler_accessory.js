var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

// here's a fake hardware device that we'll expose to HomeKit
var SPRINKLER = {
  active: false,
  name: "Garten Hinten",
  timerEnd: 0,
  defaultDuration: 3600,

  getStatus: function() {
    //set the boolean here, this will be returned to the device
    SPRINKLER.motionDetected = false;
  },
  identify: function() {
    console.log("Identify the sprinkler!");
  }
}


// Generate a consistent UUID for our Motion Sensor Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "motionsensor".
var sprinklerUUID = uuid.generate('hap-nodejs:accessories:sprinkler');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake motionSensor.
var sprinkler = exports.accessory = new Accessory('💦 Sprinkler', sprinklerUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
sprinkler.username = "A3:AB:3D:4D:2E:A3";
sprinkler.pincode = "123-44-567";

// Add the actual Valve Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
var sprinklerService = sprinkler.addService(Service.Valve, "💦 Sprinkler")


// set some basic properties (these values are arbitrary and setting them is optional)
sprinkler
  .getService(Service.Valve)
  .setCharacteristic(Characteristic.ValveType, "1") // IRRIGATION/SPRINKLER = 1; SHOWER_HEAD = 2; WATER_FAUCET = 3;
  .setCharacteristic(Characteristic.Name, SPRINKLER.name)
  ;

sprinkler
  .getService(Service.Valve)
  .getCharacteristic(Characteristic.Active)
  .on('get', function(callback) {

    console.log("get Active");
    var err = null; // in case there were any problems

    if (SPRINKLER.active) {
      callback(err, true);
    }
    else {
      callback(err, false);
    }
  })
  .on('set', function(newValue, callback) {

    console.log("set Active => setNewValue: " + newValue);
    
    if (SPRINKLER.active) {
      SPRINKLER.active = false;
      closeVentile();
      setTimeout(function() {
        console.log("Ausgeschaltet");        
        SPRINKLER.timerEnd = SPRINKLER.defaultDuration + Math.floor(new Date() / 1000);
        callback(null);

        sprinkler
        .getService(Service.Valve)
        .setCharacteristic(Characteristic.SetDuration, 0);        

        sprinkler
        .getService(Service.Valve)
        .setCharacteristic(Characteristic.InUse, 0);

      }, 1000);
    }
    else {
      SPRINKLER.active = true;
      openVentile();
      setTimeout(function() {
        console.log("Eingeschaltet");
        SPRINKLER.timerEnd = SPRINKLER.defaultDuration + Math.floor(new Date() / 1000);
        callback(null, SPRINKLER.defaultDuration);
        
        sprinkler
        .getService(Service.Valve)
        .setCharacteristic(Characteristic.InUse, 1);

        sprinkler
        .getService(Service.Valve)
        .setCharacteristic(Characteristic.RemainingDuration, SPRINKLER.defaultDuration);        

        sprinkler
        .getService(Service.Valve)
        .setCharacteristic(Characteristic.SetDuration, SPRINKLER.defaultDuration);
        
      }, 1000);
    }
  });


sprinkler
  .getService(Service.Valve)
  .getCharacteristic(Characteristic.InUse)
  .on('get', function(callback) {
    console.log("get In_Use");
    var err = null; // in case there were any problems

    if (SPRINKLER.active) {
      callback(err, true);
    }
    else {
      callback(err, false);
    }
  })
  .on('set', function(newValue, callback) {
    console.log("set In_Use => NewValue: " + newValue);    
  });


  sprinkler
  .getService(Service.Valve)
  .getCharacteristic(Characteristic.RemainingDuration)
  .on('get', function(callback) {

    var err = null; // in case there were any problems

    if (SPRINKLER.active) {
      
      var duration = SPRINKLER.timerEnd - Math.floor(new Date() / 1000);
      console.log("RemainingDuration: " + duration)
      callback(err, duration);
    }
    else {
      callback(err, 0);
    }
  });


  sprinkler
  .getService(Service.Valve)
  .getCharacteristic(Characteristic.SetDuration)
  .on('set', function(newValue, callback) {
    console.log("SetDuration => NewValue: " + newValue);
    
    var err = null; // in case there were any problems
    SPRINKLER.defaultDuration = newValue;
    callback();  
  });


  // Sprinkler Controll
  function openVentile() {
    // Add your code here
  }

  function closeVentile() {
    // Add your code here
  }
  
