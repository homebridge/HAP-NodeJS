import path from "path";

import storage from "node-persist";

import { AccessoryLoader, HAPLibraryVersion } from "./";

console.log(`HAP-NodeJS v${HAPLibraryVersion()} starting...`);

console.warn("DEPRECATION NOTICE: The use of Core and BridgeCore are deprecated and are scheduled to be remove in October 2020. " +
  "For more information and some guidance on how to migrate, have a look at https://github.com/homebridge/HAP-NodeJS/wiki/Deprecation-of-Core-and-BridgeCore");

// Initialize our storage system
storage.initSync();

// Our Accessories will each have their own HAP server; we will assign ports sequentially
let targetPort = 51826;

// Load up all accessories in the /accessories folder
const dir = path.join(__dirname, "accessories");
const accessories = AccessoryLoader.loadDirectory(dir);

// Publish them all separately (as opposed to BridgedCore which publishes them behind a single Bridge accessory)
accessories.forEach((accessory) => {

  // To push Accessories separately, we'll need a few extra properties
  // @ts-expect-error: Core/BridgeCore API
  if (!accessory.username) {
    throw new Error("Username not found on accessory '" + accessory.displayName +
                    "'. Core.js requires all accessories to define a unique 'username' property.");
  }

  // @ts-expect-error: Core/BridgeCore API
  if (!accessory.pincode) {
    throw new Error("Pincode not found on accessory '" + accessory.displayName +
                    "'. Core.js requires all accessories to define a 'pincode' property.");
  }

  // publish this Accessory on the local network
  accessory.publish({
    port: targetPort++,
    // @ts-expect-error: Core/BridgeCore API
    username: accessory.username,
    // @ts-expect-error: Core/BridgeCore API
    pincode: accessory.pincode,
    category: accessory.category,
  });
});

const signals = { "SIGINT": 2, "SIGTERM": 15 } as Record<string, number>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Object.keys(signals).forEach((signal: any) => {
  process.on(signal, () => {
    for (let i = 0; i < accessories.length; i++) {
      accessories[i].unpublish();
    }

    setTimeout(() => {
      process.exit(128 + signals[signal]);
    }, 1000);
  });
});
