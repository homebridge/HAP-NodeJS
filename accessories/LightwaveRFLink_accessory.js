var Bridge = require('../').Bridge;
var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
var LightwaveLight = require('../lib/LightwaveLight.js').LightwaveLight;
var getRevisionAndMac = require('../lib/util/lightwave.js').getRevisionAndMac;

// Generate a consistent UUID for our light Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "light".
var lightwaveRFLinkUUID = uuid.generate('hap-nodejs:accessories:lightwaverflink');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake light.
var lightwaveRFLink = exports.accessory = new Bridge('LightwaveRF Link', lightwaveRFLinkUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
lightwaveRFLink.username = "1A:2B:3C:4D:5E:9F";
lightwaveRFLink.pincode = "031-45-154";

lightwaveRFLink
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Siemens")

getRevisionAndMac(function(revision, mac) {
  lightwaveRFLink
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Model, revision)
    .setCharacteristic(Characteristic.SerialNumber, mac)
})

lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Lounge lights", 1, 1))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Kitchen lights", 1, 2))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Kitchen downlights", 1, 3))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Dining room lights", 1, 4))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Conservatory lights", 1, 5))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Garage lights", 1, 6))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Carport lights", 1, 7))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Garden lights", 1, 8))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Front door lights", 2, 1))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Hallway lights", 2, 2))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Cloakroom lights", 2, 3))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Landing lights", 2, 4))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Bedroom lights", 2, 5))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Bathroom lights", 2, 6))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Study lights", 2, 7))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Top landing lights", 2, 8))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Guest bathroom lights", 3, 1))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Guest bedroom lights", 3, 2))
lightwaveRFLink.addBridgedAccessory(new LightwaveLight("Laundry lights", 3, 3))
