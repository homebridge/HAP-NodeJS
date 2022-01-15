import { Accessory, AccessoryEventTypes, Categories, Service, uuid, VoidCallback } from "..";

const UUID = uuid.generate("hap-nodejs:accessories:wifi-router");
export const accessory = new Accessory("Wi-Fi Router", UUID);

// @ts-expect-error: Core/BridgeCore API
accessory.username = "FA:3C:ED:D2:1A:A2";
// @ts-expect-error: Core/BridgeCore API
accessory.pincode = "031-45-154";
accessory.category = Categories.ROUTER;

accessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  console.log("Identify the '%s'", accessory.displayName);
  callback();
});

accessory.addService(Service.WiFiRouter);
