// HomeKit types required
var types = require("./types.js")
var exports = module.exports = {};

var execute = function(accessory,characteristic,value){ console.log("executed accessory: " + accessory + ", and characteristic: " + characteristic + ", with value: " +  value + "."); }

exports.accessory = {
  displayName: "Lock",
  username: "C1:5D:3A:EE:5E:FA",
  pincode: "031-45-154",
  services: [{
    sType: types.ACCESSORY_INFORMATION_STYPE, 
    characteristics: [{
    	cType: types.NAME_CTYPE, 
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Lock",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Name of the accessory",
		designedMaxLength: 255    
    },{
    	cType: types.MANUFACTURER_CTYPE, 
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Oltica",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Manufacturer",
		designedMaxLength: 255    
    },{
    	cType: types.MODEL_CTYPE,
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Rev-1",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Model",
		designedMaxLength: 255    
    },{
    	cType: types.SERIAL_NUMBER_CTYPE, 
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "A1S2NASF88EW",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "SN",
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
    sType: types.LOCK_MECHANISM_STYPE, 
    characteristics: [{
    	cType: types.NAME_CTYPE,
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Lock Mechanism",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Name of service",
		designedMaxLength: 255   
    },{
    	cType: types.CURRENT_LOCK_MECHANISM_STATE_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Lock", "Current State", value); },
    	perms: ["pr","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "BlaBla",
		designedMinValue: 0,
		designedMaxValue: 3,
		designedMinStep: 1,
		designedMaxLength: 1    
    },{
    	cType: types.TARGET_LOCK_MECHANISM_STATE_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Lock", "Target State", value); },
    	perms: ["pr","pw","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "BlaBla",
		designedMinValue: 0,
		designedMaxValue: 1,
		designedMinStep: 1,
		designedMaxLength: 1    
    }]
  },{
    sType: types.LOCK_MANAGEMENT_STYPE, 
    characteristics: [{
    	cType: types.NAME_CTYPE,
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Lock Management",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Name of service",
		designedMaxLength: 255   
    },{
    	cType: types.LOCK_MANAGEMENT_CONTROL_POINT_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Lock", "Control Point", value); },
    	perms: ["pw"],
		format: "data",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "BlaBla",
		designedMaxLength: 255    
    },{
    	cType: types.VERSION_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Lock", "Version", value); },
    	perms: ["pr"],
		format: "string",
		initialValue: "1.0",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "BlaBla",
		designedMaxLength: 255    
    }]
  }]
}