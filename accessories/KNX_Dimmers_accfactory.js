//HomeKit types required
//modified version SNOWDD1
//Light with on/off switch and optional brightness control 

var types = require("./types.js");
var eibd = require("eibd");
var knxfunctions = require("./knxfunctions.js");
var busMonitor = require("./busMonitor.js");
var esfFileReaderLIGHT = require("./esfFileReaderLIGHT.js");
//var mydebug = require("./mydebug.js"); // provide a tool for iteratin all object properties to console


var execute = function(accessory,characteristic,value){
	// debug only
	console.log("executed accessory: " + accessory + ", and characteristic: " + characteristic + ", with value: " +  value + "."); 
};

//Group address to hex conversion
//Get string "1/30/50"
//return string "01:1E:32"
function gaToHex(groupAdressString){
	function twoHexDigits(aNumber){
		var str = Number(aNumber).toString(16);
		return str.length === 1 ? "0" + str : str; //if length==1 the return 0+answer else answer
	}
	var strArray = groupAdressString.split("/");
	var answer ="";
	var temp = "";
	for (var i = 0; i < strArray.length; i++) {
		temp = twoHexDigits(strArray[i]);
		answer = answer.length === 0 ? temp : answer + ":" + temp.toUpperCase();
	}
	return answer;
}	

var newTemplateAccessory = function () {
	return {
		groupAdress : "0/0/0",
		fullname : "Default Light device",
		serialNumber : "A1S2NASF88EX" ,
		listenAdresses : ["0/0/0"], // add all addresses the device listens on in this array of strings
		displayName: "", //fullname,
		username: "1A:2B:3C:00:00:00",  
		pincode: "031-45-154",
		services: [{
			sType: types.ACCESSORY_INFORMATION_STYPE,
			characteristics: [{
				cType: types.NAME_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: 'initial friendly name',
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla1",
				designedMaxLength: 255
			},{
				cType: types.MANUFACTURER_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "KNX", //"Oltica",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla2",
				designedMaxLength: 255
			},{
				cType: types.MODEL_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "Light or dimmer device", //"Rev-1",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla3",
				designedMaxLength: 255
			},{
				cType: types.SERIAL_NUMBER_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "A1S2NASF88EX",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla4",
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
				initialValue: "General Light Service",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla5",
				designedMaxLength: 255
			}]
		}]
	};
};

//the factory creates new accessory objects with the parameters that are passed
var myLightAccFactory = function (paramsObject) {

	if (typeof paramsObject === 'undefined') {
		console.log("myAccFactory requires an paramsObject!");
		throw {name: "ENOPARAMS", message: "required parameter missing, provide {groupAdress, fullname} at least."};
	}

	if (typeof paramsObject.groupAdress !== 'string') {
		console.log("myAccFactory requires an paramsObject.groupAdress as a string!");
		throw {name: "ENOPARAMS", message: "required parameter missing, provide {groupAdress, fullname} at least."};
	}
	if (typeof paramsObject.fullname !== 'string') {
		console.log("myAccFactory requires an paramsObject.fullname as a string!");
		throw {name: "ENOPARAMS", message: "required parameter missing, provide {groupAdress, fullname} at least."};
	}
	if (typeof paramsObject.listenAdresses === 'undefined') {
		// use default
		paramsObject.listenAdresses = [paramsObject.groupAdress];
	}	else {
		if (typeof paramsObject.listenAdresses !== 'object') {
			console.log("myAccFactory requires an paramsObject.listenAdresses[]!");
			throw {name: "EWRONGPARAMS", message: "required parameter type wrong, provide {groupAdress, fullname, listenAdresses = [array of strings]} ."};
		}		
	}


	var newAccessory = newTemplateAccessory();
	newAccessory.username = "1A:2B:3C:"+gaToHex(paramsObject.groupAdress);
	newAccessory.serialNumber = "A1S2NASF88EW" + paramsObject.groupAdress;
	newAccessory.displayName =  paramsObject.fullname;
	newAccessory.locals = {
		groupAdress : paramsObject.groupAdress,
		listenAdresses : paramsObject.listenAdresses,
		fullname : paramsObject.fullname
	};
	newAccessory.services[0].characteristics[0].initialValue = paramsObject.fullname; // NAME_CTYPE
	newAccessory.services[0].characteristics[3].initialValue = "A1S2NASF88EW" + "-" + paramsObject.groupAdress; // SERIAL_NUMBER_CTYPE
	newAccessory.services[1].characteristics[0].initialValue = paramsObject.fullname + " Light Service"; // must access object directly

	// create main characteristics for a lamp: the power switch
	newAccessory.services[1].characteristics.push({
		cType: types.POWER_STATE_CTYPE,
		onUpdate: function(value) {
			var numericValue = 0;
			if (value) {
				numericValue = 1;
			}
			console.log("Change:",value); 
			execute("onUpdate: " + this.locals.fullname, "light service", numericValue);
			knxfunctions.write(this.locals.groupAdress,'DPT1',numericValue);
		},
		// new snowdd1
		onRegister: function(assignedCharacteristic) {
			console.log("Registering for "+ assignedCharacteristic.locals.fullname, "light service (switch)");
			busMonitor.registerGA(assignedCharacteristic, assignedCharacteristic.locals.listenAdresses); // register all listen addresses
		},
		perms: ["pw","pr","ev"],  // assumption: Property Read, Property Write, Events
		format: "bool",
		initialValue: false,
		supportEvents: true,
		supportBonjour: false,
		manfDescription: "Licht umschalten",
		designedMaxLength: 1
	});


	// paramsObject has a brightnessController object?
	if (paramsObject.hasOwnProperty("brightnessController"))  {
		// add the features of the brightness controller as a new characteristics object to the array
		newAccessory.locals.BrightnessGA = paramsObject.brightnessController.groupAdress;
		newAccessory.locals.listenBrightnessAddresses = paramsObject.brightnessController.listenAdresses;
		newAccessory.services[1].characteristics.push({
			cType: types.BRIGHTNESS_CTYPE,
			onUpdate: function(value) { 
				//console.log("Change:",value); execute("Test Accessory 1", "Light - Brightness", value); 
				var numericValue = 0;
				if (value) {
					numericValue = 255*value/100;  // convert 1..100 to 1..255 for KNX bus  
				}
				console.log("Change:" + value.toString + numericValue); 
				execute("onUpdate: " + this.locals.fullname, "light service Brightness", numericValue);
				knxfunctions.write(this.locals.BrightnessGA,'DPT5',numericValue);
			},
			onRegister: function(assignedCharacteristic) {
				console.log("Registering for "+ assignedCharacteristic.locals.fullname, "light service (Brightness)");
				busMonitor.registerGA(assignedCharacteristic, assignedCharacteristic.locals.listenBrightnessAddresses); // register all listen addresses
			},
			perms: ["pw","pr","ev"],
			format: "int",
			initialValue: 0,
			supportEvents: true,
			supportBonjour: false,
			manfDescription: "Adjust Brightness of Light",
			designedMinValue: 0,
			designedMaxValue: 100,
			designedMinStep: 1,
			unit: "%"
		});
	} // end if
	return newAccessory;
};

module.exports = (function () {
	/*
	 *  Put your filename and filter in here!
	 */
	var filter = "Lightning";
	var filename = "ets4-opc-export.esf";
	var groupAdresses = esfFileReaderLIGHT.parseFile(__dirname + "/" + filename, filter);
	var accessories = [];
	var index;
	for (index in groupAdresses) {
		if (groupAdresses.hasOwnProperty(index)) {
			accessories.push({accessory: myLightAccFactory(groupAdresses[index])});
		}
	}
	return accessories;
}());


