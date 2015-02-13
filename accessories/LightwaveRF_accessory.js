// HomeKit types required
var types = require("./types.js")
var exports = module.exports = {};

var execute = function(accessory,characteristic,value){ console.log("executed accessory: " + accessory + ", and characteristic: " + characteristic + ", with value: " +  value + "."); }

function accessoryInformation() {
  return {
    sType: types.ACCESSORY_INFORMATION_STYPE,
    characteristics: [{
      cType: types.NAME_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "LightwaveRF Link",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.MANUFACTURER_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "Siemens",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.MODEL_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "Link v1",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.SERIAL_NUMBER_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "123ABC",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.IDENTIFY_CTYPE,
      onUpdate: null,
      perms: ["pw"],
      format: "bool",
      initialValue: false,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Identify Accessory",
      designedMaxLength: 1
    }]
  };
}

function light(name) {
  return {
    services: [accessoryInformation(),
    {
      sType: types.LIGHTBULB_STYPE,
      characteristics: [{
        cType: types.NAME_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: name,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Bla",
        designedMaxLength: 255
      },{
        cType: types.POWER_STATE_CTYPE,
        onUpdate: function(value) { console.log("Change:",value); execute(name, "power", value); },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Turn On the Light",
        designedMaxLength: 1
      },{
        cType: types.BRIGHTNESS_CTYPE,
        onUpdate: function(value) { console.log("Change:",value); execute(name, "brightness", value); },
        perms: ["pw","pr","ev"],
        format: "int",
        initialValue: 0,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Adjust Brightness of Light",
        designedMinValue: 0,
        designedMaxValue: 100,
        designedMinStep: 6.25,
      }]
    }]
  };
}

function socket(name) {
  return {
    services: [accessoryInformation(),
    {
      sType: types.OUTLET_STYPE,
      characteristics: [{
        cType: types.NAME_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: name,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Bla",
        designedMaxLength: 255
      },{
        cType: types.POWER_STATE_CTYPE,
        onUpdate: function(value) { console.log("Change:",value); execute(name, "power", value); },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Turn on the socket",
        designedMaxLength: 1
      },{
        cType: types.OUTLET_IN_USE_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "bool",
        initialValue: true,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Outlet in use",
        designedMaxLength: 1
      }]
    }]
  };
}

exports.accessories = {
  displayName: "LightwaveRF Link",
  username: "1A:2B:3C:4D:5E:6F",
  pincode: "031-45-154",
  accessories: [
    light("Test light 1"),
    socket("Test socket 1")
  ]
}
