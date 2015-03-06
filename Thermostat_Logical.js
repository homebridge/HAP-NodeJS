var storage = require('node-persist');
var types = require("./accessories/types.js")

var accessory_Factor = new require("./Accessory.js");
var accessoryController_Factor = new require("./AccessoryController.js");
var service_Factor = new require("./Service.js");
var characteristic_Factor = new require("./Characteristic.js");

var targetPort = 51826;

console.log("HAP-NodeJS starting...");
storage.initSync();

var execute = function(accessory,characteristic,value){ console.log("executed accessory: " + accessory + ", and characteristic: " + characteristic + ", with value: " +  value + "."); }

var accessoryController = new accessoryController_Factor.AccessoryController();
var infoService = new service_Factor.Service(types.ACCESSORY_INFORMATION_STYPE);
var infoChars = [{
	cType: types.NAME_CTYPE, 
	onUpdate: null,
	perms: ["pr"],
	format: "string",
	initialValue: "Thermostat 1",
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
}];

for (var k = 0; k < infoChars.length; k++) {
	var options = {
		type: infoChars[k].cType,
		perms: infoChars[k].perms,
		format: infoChars[k].format,
		initialValue: infoChars[k].initialValue,
		supportEvents: infoChars[k].supportEvents,
		supportBonjour: infoChars[k].supportBonjour,
		manfDescription: infoChars[k].manfDescription,
		designedMaxLength: infoChars[k].designedMaxLength,
		designedMinValue: infoChars[k].designedMinValue,
		designedMaxValue: infoChars[k].designedMaxValue,
		designedMinStep: infoChars[k].designedMinStep,
		unit: infoChars[k].unit,
	}

	var characteristic = new characteristic_Factor.Characteristic(options, null);

	infoService.addCharacteristic(characteristic);
};

accessoryController.addService(infoService);

var thermostatService = new service_Factor.Service(types.THERMOSTAT_STYPE);
var thermoNameChar = new characteristic_Factor.Characteristic({
    	type: types.NAME_CTYPE,
    	onUpdate: null,
    	perms: ["pr"],
		format: "string",
		initialValue: "Thermostat Control",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255   
    }, null);
thermostatService.addCharacteristic(thermoNameChar);

var thermoCMChar = new characteristic_Factor.Characteristic({
    	type: types.CURRENTHEATINGCOOLING_CTYPE,
    	perms: ["pr","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Current Mode",
		designedMaxLength: 1,
		designedMinValue: 0,
		designedMaxValue: 2,
		designedMinStep: 1,    
    }, null);
thermostatService.addCharacteristic(thermoCMChar);

var thermoTMChar = new characteristic_Factor.Characteristic({
    	type: types.TARGETHEATINGCOOLING_CTYPE,
    	perms: ["pw","pr","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Target Mode",
		designedMinValue: 0,
		designedMaxValue: 3,
		designedMinStep: 1,
    }, function(value) { console.log("Change:",value); execute("Thermostat", "Target HC", value);
    if (value < 3) {thermoCMChar.updateValue(value);} else {thermoCMChar.updateValue(1);};
});
thermostatService.addCharacteristic(thermoTMChar);

var restThermo = [{
    	cType: types.CURRENT_TEMPERATURE_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Thermostat", "Current Temperature", value); },
    	perms: ["pr","ev"],
		format: "int",
		initialValue: 20,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Current Temperature",
		unit: "celsius"
    },{
    	cType: types.TARGET_TEMPERATURE_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Thermostat", "Target Temperature", value); },
    	perms: ["pw","pr","ev"],
		format: "int",
		initialValue: 20,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Target Temperature",
		designedMinValue: 16,
		designedMaxValue: 38,
		designedMinStep: 1,
		unit: "celsius"
    },{
    	cType: types.TEMPERATURE_UNITS_CTYPE,
    	onUpdate: function(value) { console.log("Change:",value); execute("Thermostat", "Unit", value); },
    	perms: ["pr","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Unit",
    }];
for (var k = 0; k < restThermo.length; k++) {
	var options = {
		type: restThermo[k].cType,
		perms: restThermo[k].perms,
		format: restThermo[k].format,
		initialValue: restThermo[k].initialValue,
		supportEvents: restThermo[k].supportEvents,
		supportBonjour: restThermo[k].supportBonjour,
		manfDescription: restThermo[k].manfDescription,
		designedMaxLength: restThermo[k].designedMaxLength,
		designedMinValue: restThermo[k].designedMinValue,
		designedMaxValue: restThermo[k].designedMaxValue,
		designedMinStep: restThermo[k].designedMinStep,
		unit: restThermo[k].unit,
	}

	var characteristic = new characteristic_Factor.Characteristic(options, restThermo[k].onUpdate);

	thermostatService.addCharacteristic(characteristic);
};

accessoryController.addService(thermostatService);
var accessory = new accessory_Factor.Accessory("Thermostat 1", "CA:3E:BC:4D:5E:FF", storage, parseInt(targetPort), "031-45-154", accessoryController);
accessory.publishAccessory();