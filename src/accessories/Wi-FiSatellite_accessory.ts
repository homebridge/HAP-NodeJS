import { Accessory, AccessoryEventTypes, Categories, Characteristic, Service, uuid, VoidCallback } from "..";

const UUID = uuid.generate("hap-nodejs:accessories:wifi-satellite");
export const accessory = new Accessory("Wi-Fi Satellite", UUID);

// @ts-expect-error: Core/BridgeCore API
accessory.username = "FA:3C:ED:5A:1A:A2";
// @ts-expect-error: Core/BridgeCore API
accessory.pincode = "031-45-154";
accessory.category = Categories.ROUTER;

accessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  console.log("Identify the '%s'", accessory.displayName);
  callback();
});

const satellite = accessory.addService(Service.WiFiSatellite);

satellite.getCharacteristic(Characteristic.WiFiSatelliteStatus)!
  .updateValue(Characteristic.WiFiSatelliteStatus.CONNECTED);
