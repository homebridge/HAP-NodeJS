var Accessory = require('../').Accessory;
var Bridge = require('../').Bridge;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

// here's a fake hardware device that we'll expose to HomeKit
var FAKE_LOCK = {
  locked: false,
  lock: function() { 
    console.log("Locking the lock!");
    FAKE_LOCK.locked = true;
  },
  unlock: function() { 
    console.log("Unlocking the lock!");
    FAKE_LOCK.locked = false;
  },
  identify: function() {
    console.log("Identify the lock!");
  }
}

// Generate a consistent UUID for our Lock Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "lock".
var lockUUID = uuid.generate('hap-nodejs:accessories:lock');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
var lock = exports.accessory = new Accessory('Lock', lockUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
lock.username = "C1:5D:3A:EE:5E:FA";
lock.pincode = "031-45-154";

// set some basic properties (these values are arbitrary)
lock
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Oltica")
  .setCharacteristic(Characteristic.Model, "Rev-1")
  .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

// listen for the "identify" event for this Accessory
lock
  .getService(Service.AccessoryInformation)
  .getCharacteristic(Characteristic.Identify)
  .on('set', function(value, callback) {
    if (value) {
      // called when the iOS user wants to identify which Lock this is
      FAKE_LOCK.identify();
    }
    callback();
  });

// Add the actual Door Lock Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
lock
  .addService(new Service.LockMechanism())
  .getCharacteristic(Characteristic.LockTargetState)
  .on('set', function(value, callback) {
    
    if (value == Characteristic.LockTargetState.UNSECURED) {
      FAKE_LOCK.unlock();
      callback(); // Our fake Lock is synchronous - this value has been successfully set
      
      // now we want to set our lock's "actual state" to be unsecured so it shows as unlocked in iOS apps
      lock
        .getService(Service.LockMechanism)
        .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
    }
    else if (value == Characteristic.LockTargetState.SECURED) {
      FAKE_LOCK.lock();
      callback(); // Our fake Lock is synchronous - this value has been successfully set
      
      // now we want to set our lock's "actual state" to be locked so it shows as open in iOS apps
      lock
        .getService(Service.LockMechanism)
        .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
    }
  });

// We want to intercept requests for our current state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
lock
  .getService(Service.LockMechanism)
  .getCharacteristic(Characteristic.LockCurrentState)
  .on('get', function(callback) {
    
    // this event is emitted when you ask Siri directly whether your lock is locked or not. you might query
    // the lock hardware itself to find this out, then call the callback. But if you take longer than a
    // few seconds to respond, Siri will give up.
    
    var err = null; // in case there were any problems
    
    if (FAKE_LOCK.locked) {
      console.log("Are we locked? Yes.");
      callback(err, Characteristic.LockCurrentState.SECURED);
    }
    else {
      console.log("Are we locked? No.");
      callback(err, Characteristic.LockCurrentState.UNSECURED);
    }
  });
