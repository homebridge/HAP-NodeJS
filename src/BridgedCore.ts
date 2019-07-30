import path from 'path';

import storage from 'node-persist';

import { Accessory, AccessoryEventTypes, AccessoryLoader, Bridge, Categories, uuid, VoidCallback } from './';

console.log("HAP-NodeJS starting...");

// Initialize our storage system
storage.initSync();

// Start by creating our Bridge which will host all loaded Accessories
const bridge = new Bridge('Node Bridge', uuid.generate("Node Bridge"));

// Listen for bridge identification event
bridge.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  console.log("Node Bridge identify");
  callback(); // success
});

// Load up all accessories in the /accessories folder
var dir = path.join(__dirname, "accessories");
var accessories = AccessoryLoader.loadDirectory(dir);

// Add them all to the bridge
accessories.forEach((accessory: Accessory) => {
  bridge.addBridgedAccessory(accessory);
});

// Publish the Bridge on the local network.
bridge.publish({
  username: "CC:22:3D:E3:CE:F6",
  port: 51826,
  pincode: "031-45-154",
  category: Categories.BRIDGE
});

var signals = { 'SIGINT': 2, 'SIGTERM': 15 } as Record<string, number>;
Object.keys(signals).forEach((signal: any) => {
  process.on(signal, function () {
    bridge.unpublish();
    setTimeout(function (){
        process.exit(128 + signals[signal]);
    }, 1000)
  });
});
