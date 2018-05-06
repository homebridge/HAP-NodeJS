var path = require('path');
var storage = require('node-persist');
var uuid = require('./').uuid;
var Accessory = require('./').Accessory;
var accessoryLoader = require('./lib/AccessoryLoader');

console.log("HAP-NodeJS starting...");

// Initialize our storage system
storage.initSync();

// Our Accessories will each have their own HAP server; we will assign ports sequentially
var targetPort = 51826;

// Load up all accessories in the /accessories folder
var dir = path.join(__dirname, "accessories");
var accessories = accessoryLoader.loadDirectory(dir);

// Publish them all separately (as opposed to BridgedCore which publishes them behind a single Bridge accessory)
accessories.forEach(function(accessory) {

  // To push Accessories separately, we'll need a few extra properties
  if (!accessory.username)
    throw new Error("Username not found on accessory '" + accessory.displayName +
                    "'. Core.js requires all accessories to define a unique 'username' property.");

  if (!accessory.pincode)
    throw new Error("Pincode not found on accessory '" + accessory.displayName +
                    "'. Core.js requires all accessories to define a 'pincode' property.");

  // publish this Accessory on the local network
  accessory.publish({
    port: targetPort++,
    username: accessory.username,
    pincode: accessory.pincode
  });
});

var signals = { 'SIGINT': 2, 'SIGTERM': 15 };
Object.keys(signals).forEach(function (signal) {
  process.on(signal, function () {
    for (var i = 0; i < accessories.length; i++) {
      accessories[i].unpublish();
    }

    setTimeout(function (){
        process.exit(128 + signals[signal]);
    }, 1000)
  });
});
