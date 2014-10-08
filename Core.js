var storage = require('node-persist');

var accessory_Factor = new require("./Accessory.js");
var accessoryController_Factor = new require("./AccessoryController.js");
var service_Factor = new require("./Service.js");
var characteristic_Factor = new require("./Characteristic.js");

console.log("HAP-NodeJS starting...");

storage.initSync();

var accessoryController = new accessoryController_Factor.AccessoryController();
var infoService = generateAccessoryInfoService("Test Accessory 1","Rev 1","A1S2NASF88EW","Oltica");
var lightService = generateLightService();
accessoryController.addService(infoService);
accessoryController.addService(lightService);

var accessory = new accessory_Factor.Accessory("Test Accessory 1", "1A:2B:3C:4D:5E:FF", storage, parseInt(51822), "031-45-154", accessoryController);
accessory.publishAccessory();

function generateLightService() {
	var lightService = new service_Factor.Service("00000043-0000-1000-8000-0026BB765291");

	var nameOptions = {
		type: "00000023-0000-1000-8000-0026BB765291",
		perms: [
			"pr"
		],
		format: "string",
		initialValue: "Light 1",
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255,
	}
	var nameChar = new characteristic_Factor.Characteristic(nameOptions);
	lightService.addCharacteristic(nameChar);

	var onOptions = {
		type: "00000025-0000-1000-8000-0026BB765291",
		perms: [
			"pw",
			"pr",
			"ev"
		],
		format: "bool",
		initialValue: false,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Turn On the Light",
		designedMaxLength: 1,
	}
	var lightSwitchChar = new characteristic_Factor.Characteristic(onOptions, function(value) {
		console.log("Light Status Change:",value);
	});
	lightService.addCharacteristic(lightSwitchChar);

	return lightService;
}

function generateAccessoryInfoService(name, model, sn, manufacturer) {
	var infoService = new service_Factor.Service("0000003E-0000-1000-8000-0026BB765291");

	var nameOptions = {
		type: "00000023-0000-1000-8000-0026BB765291",
		perms: [
			"pr"
		],
		format: "string",
		initialValue: name,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255,
	}
	var nameChar = new characteristic_Factor.Characteristic(nameOptions);
	infoService.addCharacteristic(nameChar);

	var manufacturerOptions = {
		type: "00000020-0000-1000-8000-0026BB765291",
		perms: [
			"pr"
		],
		format: "string",
		initialValue: manufacturer,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255,
	}
	var manufacturerChar = new characteristic_Factor.Characteristic(manufacturerOptions);
	infoService.addCharacteristic(manufacturerChar);

	var modelOptions = {
		type: "00000021-0000-1000-8000-0026BB765291",
		perms: [
			"pr"
		],
		format: "string",
		initialValue: model,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255,
	}
	var modelChar = new characteristic_Factor.Characteristic(modelOptions);
	infoService.addCharacteristic(modelChar);

	var snOptions = {
		type: "00000030-0000-1000-8000-0026BB765291",
		perms: [
			"pr"
		],
		format: "string",
		initialValue: sn,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Bla",
		designedMaxLength: 255,
	}
	var snChar = new characteristic_Factor.Characteristic(snOptions);
	infoService.addCharacteristic(snChar);

	var identifyOptions = {
		type: "00000014-0000-1000-8000-0026BB765291",
		perms: [
			"pw"
		],
		format: "bool",
		initialValue: false,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Identify Accessory",
		designedMaxLength: 1,
	}
	var identifyChar = new characteristic_Factor.Characteristic(identifyOptions);
	infoService.addCharacteristic(identifyChar);

	return infoService;
}