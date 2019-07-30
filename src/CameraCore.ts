import storage from 'node-persist';

import { Accessory, AccessoryEventTypes, Camera, Categories, uuid, VoidCallback } from './';

console.log("HAP-NodeJS starting...");

// Initialize our storage system
storage.initSync();

// Start by creating our Bridge which will host all loaded Accessories
var cameraAccessory = new Accessory('Node Camera', uuid.generate("Node Camera"));

var cameraSource = new Camera();

cameraAccessory.configureCameraSource(cameraSource);

cameraAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  console.log("Node Camera identify");
  callback(); // success
});

// Publish the camera on the local network.
cameraAccessory.publish({
  username: "EC:22:3D:D3:CE:CE",
  port: 51062,
  pincode: "031-45-154",
  category: Categories.CAMERA
}, true);

var signals = { 'SIGINT': 2, 'SIGTERM': 15 } as Record<string, number>;
Object.keys(signals).forEach((signal: any) => {
  process.on(signal, () => {
    cameraAccessory.unpublish();
    setTimeout(() => {
        process.exit(128 + signals[signal]);
    }, 1000)
  });
});
