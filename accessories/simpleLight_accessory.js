var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var pincode = "031-45-154"; //necessary when using Core.js instead of BridgedCore.js

var ACC = {
  type: "Light", //type of accessory
  name: "LED Bulbs", //visible name of accessory
  username: "1A:1A:1A:1A:1A:1A", //necessary when using Core.js instead of BridgedCore.js
  manufacturer: "HAP-NodeJS", //manufacturer (optional)
  model: "v1.0", //model (optional)
  sn: "A12S345KGB", //serial number (optional)

  power: false, //curent power status

  setPower: function(status) { //set status of accessory
    console.log("Turning the '%s' %s", this.name, status ? "on" : "off");
    this.power = status;
  },

  getStatus: function() { //get status of accessory
    console.log("'%s' is %s.", this.name, this.power ? "on" : "off");
    return this.power ? true : false;
  },

  identify: function() { //identify the accessory
    console.log("Identify the '%s'", this.name);
  }
}

var accUUID = uuid.generate('nap-nodejs:accessories:' + ACC.name);
var acc = exports.accessory = new Accessory(ACC.type, accUUID);

acc.username = ACC.username, acc.pincode = pincode;

acc
  .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, ACC.manufacturer)
    .setCharacteristic(Characteristic.Model, ACC.model)
    .setCharacteristic(Characteristic.SerialNumber, ACC.sn);

acc
  .addService(Service.Lightbulb, ACC.name)
  .getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    ACC.setPower(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, ACC.getStatus());
  })
  .on('identify', function(paired, callback) {
    ACC.identify();
    callback();
  });
