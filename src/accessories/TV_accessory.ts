import {
  Accessory,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  Service,
  uuid
} from '..';

// Generate a consistent UUID for TV that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "tv".
var tvUUID = uuid.generate('hap-nodejs:accessories:tv');

// This is the Accessory that we'll return to HAP-NodeJS.
var tv = exports.accessory = new Accessory('TV', tvUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
// @ts-ignore
tv.username = "A3:FB:3D:4D:2E:AC";
// @ts-ignore
tv.pincode = "031-45-154";

// Add the actual TV Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKit.ts`
var televisionService = tv.addService(Service.Television, "Television", "Television");

televisionService
  .setCharacteristic(Characteristic.ConfiguredName, "Television");

televisionService
  .setCharacteristic(
    Characteristic.SleepDiscoveryMode,
    Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
  );

televisionService
  .getCharacteristic(Characteristic.Active)!
  .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
    console.log("set Active => setNewValue: " + newValue);
    callback(null);
  });

televisionService
  .setCharacteristic(Characteristic.ActiveIdentifier, 1);

televisionService
  .getCharacteristic(Characteristic.ActiveIdentifier)!
  .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
    console.log("set Active Identifier => setNewValue: " + newValue);
    callback(null);
  });

televisionService
  .getCharacteristic(Characteristic.RemoteKey)!
  .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
    console.log("set Remote Key => setNewValue: " + newValue);
    callback(null);
  });

televisionService
  .getCharacteristic(Characteristic.PictureMode)!
  .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
    console.log("set PictureMode => setNewValue: " + newValue);
    callback(null);
  });

televisionService
  .getCharacteristic(Characteristic.PowerModeSelection)!
  .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
    console.log("set PowerModeSelection => setNewValue: " + newValue);
    callback(null);
  });

// Speaker

var speakerService = tv.addService(Service.TelevisionSpeaker)

speakerService
  .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
  .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

speakerService.getCharacteristic(Characteristic.VolumeSelector)!
  .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
    console.log("set VolumeSelector => setNewValue: " + newValue);
    callback(null);
  });

// HDMI 1

var inputHDMI1 = tv.addService(Service.InputSource, "hdmi1", "HDMI 1");

inputHDMI1
  .setCharacteristic(Characteristic.Identifier, 1)
  .setCharacteristic(Characteristic.ConfiguredName, "HDMI 1")
  .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
  .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI);

// HDMI 2

var inputHDMI2 = tv.addService(Service.InputSource, "hdmi2", "HDMI 2");

inputHDMI2
  .setCharacteristic(Characteristic.Identifier, 2)
  .setCharacteristic(Characteristic.ConfiguredName, "HDMI 2")
  .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
  .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI);

// Netflix

var inputNetflix = tv.addService(Service.InputSource, "netflix", "Netflix");

inputNetflix
  .setCharacteristic(Characteristic.Identifier, 3)
  .setCharacteristic(Characteristic.ConfiguredName, "Netflix")
  .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
  .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION);

televisionService.addLinkedService(inputHDMI1);
televisionService.addLinkedService(inputHDMI2);
televisionService.addLinkedService(inputNetflix);
