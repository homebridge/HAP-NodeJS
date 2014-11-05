// HomeKit types required
var types = require("./types.js")
var exports = module.exports = {};

var execute = function(accessory,characteristic,value){ console.log("executed accessory: " + accessory + ", and characteristic: " + characteristic + ", with value: " +  value + "."); }

exports.accessory = {
  displayName: "Test Accessory 1",
  username: "1A:2B:3C:4D:5E:FF",
  pincode: "031-45-154",
  services: [{
    sType: types.ACCESSORY_INFORMATION_STYPE, 
    characteristics: [{
    	cType: types.NAME_CTYPE, 
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Test Accessory Y",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255    
    },{
    	cType: types.MANUFACTURER_CTYPE, 
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Oltica",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255    
    },{
    	cType: types.MODEL_CTYPE,
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Rev-1",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255    
    },{
    	cType: types.SERIAL_NUMBER_CTYPE, 
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "A1S2NASF88EW",
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
  },{
    sType: types.LIGHTBULB_STYPE, 
    characteristics: [{
    	cType: types.NAME_CTYPE,
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Light 1",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255   
    },{
    	cType: types.POWER_STATE_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Test Accessory 1", "light service", value); },
    	perms: ["pw","pr","ev"],
		format: "bool",
		initialValue: false,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Turn On the Light",
		designedMaxLength: 1    
    }]
  }]
}