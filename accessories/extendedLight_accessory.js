var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var pincode = "031-45-154"; //necessary when using Core.js instead of BridgedCore.js

var ACC = {
  type: "Light", //type of accessory
  name: "LED", //visible name of accessory
  username: "1A:1A:1A:1A:1A:1A", //necessary when using Core.js instead of BridgedCore.js
  manufacturer: "HAP-NodeJS", //manufacturer (optional)
  model: "v1.0", //model (optional)
  sn: "A12S345KGB", //serial number (optional)

  power: false, //curent power status
  brightness: 100, //current brightness
  hue: 0, //current hue
  saturation: 0, //current saturation

  outputLogs: true, //output logs

  setPower: function(status) { //set power of accessory
    if(this.outputLogs) console.log("Turning the '%s' %s", this.name, status ? "on" : "off");
    this.power = status;
  },

  getPower: function() { //get power of accessory
    if(this.outputLogs) console.log("'%s' is %s.", this.name, this.power ? "on" : "off");
    return this.power ? true : false;
  },

  setBrightness: function(brightness) { //set brightness
    if(this.outputLogs) console.log("Setting '%s' brightness to %s", this.name, brightness);
    this.brightness = brightness;
  },

  getBrightness: function() { //get brightness
    if(this.outputLogs) console.log("'%s' brightness is %s", this.name, this.brightness);
    return this.brightness;
  },

  setSaturation: function(saturation) { //set brightness
    if(this.outputLogs) console.log("Setting '%s' saturation to %s", this.name, saturation);
    this.saturation = saturation;
  },

  getSaturation: function() { //get brightness
    if(this.outputLogs) console.log("'%s' saturation is %s", this.name, this.saturation);
    return this.saturation;
  },

  setHue: function(hue) { //set brightness
    if(this.outputLogs) console.log("Setting '%s' hue to %s", this.name, hue);
    this.hue = hue;
  },

  getHue: function() { //get hue
    if(this.outputLogs) console.log("'%s' hue is %s", this.name, this.hue);
    return this.hue;
  },

  identify: function() { //identify the accessory
    if(this.outputLogs) console.log("Identify the '%s'", this.name);
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

acc.on('identify', function(paired, callback) {
  ACC.identify();
  callback();
});

acc //ADD 'ON' CHARACTERISTIC
  .addService(Service.Lightbulb, ACC.name)
  .getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    ACC.setPower(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, ACC.getPower());
  });

acc //ADD 'BRIGHTNESS' CHARACTERISTIC
  .getService(Service.Lightbulb)
  .addCharacteristic(Characteristic.Brightness)
  .on('set', function(value, callback) {
    ACC.setBrightness(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, ACC.getBrightness());
  });

acc //ADD 'SATURATION' CHARACTERISTIC
  .getService(Service.Lightbulb)
  .addCharacteristic(Characteristic.Saturation)
  .on('set', function(value, callback) {
    ACC.setSaturation(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, ACC.getSaturation());
  });

acc //ADD 'HUE' CHARACTERISTIC
  .getService(Service.Lightbulb)
  .addCharacteristic(Characteristic.Hue)
  .on('set', function(value, callback) {
    ACC.setHue(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, ACC.getHue());
  });
