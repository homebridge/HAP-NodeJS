var path = require('path');
var storage = require('node-persist');
var uuid = require('./').uuid;
var Accessory = require('./').Accessory;
var accessoryLoader = require('./lib/AccessoryLoader');

console.log("HAP-NodeJS starting...");

// Checks is a tcp port available. 
var isPortTaken = function(port, fn) {
  var net = require('net');
  var tester = net.createServer().once('error', function (err) {
    if (err.code != 'EADDRINUSE') return fn(err, true);
    fn(null, true);
  }).once('listening', function() {
    tester.once('close', function() { fn(null, false) }).close();
  }).listen(port);
}

// Initialize our storage system
storage.initSync();

// Our Accessories will each have their own HAP server; we will assign ports sequentially
var targetPort = 51826;
var targetPortMax = 52826;

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

  // Find available port for listening
  var port = targetPort++;
  var onPortStatus = function(err, isTaken) {
    if(isTaken) {
      if(targetPort < targetPortMax)
        isPortTaken(port = targetPort++, onPortStatus);
      else
        console.error("\x1b[41m\x1b[37mCan't find available tcp port. Investigate your network with: `netstat -ltnp`\x1b[0m");
    } else {
      // publish this Accessory on the local network
      accessory.publish({
        port: port,
        username: accessory.username,
        pincode: accessory.pincode
      });
    }
  }
  isPortTaken(port, onPortStatus);
});
