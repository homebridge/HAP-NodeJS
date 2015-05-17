//For actual use please refer to https://github.com/snowdd1/HAP-NodeJS-KNX
//HomeKit types required
//modified version SNOWDD1
//Light with on/off switch and optional brightness control 

var types = require("./types.js");

var home_assistant_config = require("./config/Home_Assistant_config.js");

var execute = function(accessory,lightID,characteristic,value) {
	var http = require('http');
	var characteristic = characteristic.toLowerCase();
	
	var path = false;
	var body = {};
	
	if(characteristic === "identify") {
		
		path = "/api/services/light/turn_on";
		body = {entity_id: lightID, flash: "short"};
	} else if(characteristic === "on") {

		if(value == 1) {
			path = "/api/services/light/turn_on";
		} else {
			path = "/api/services/light/turn_off";			
		}

		body = {entity_id: lightID};
	} else  if(characteristic === "brightness") {

		value = value/100;
		value = value*255;
		value = Math.round(value);

		
		path = "/api/services/light/turn_on";
		body = {entity_id: lightID, brightness: value };
	}
	
	var post_data = JSON.stringify(body); 
	
	// An object of options to indicate where to post to
	var post_options = {
	  host: home_assistant_config.host,
	  port: home_assistant_config.port,
	  path: path,
	  method: 'POST',
	  headers: {
	      'Content-Type': 'application/json',
	      'Content-Length': post_data.length,
		  'X-HA-Access': home_assistant_config.api_password
	  }
	};
	
	console.log('Request Options: ' + JSON.stringify(post_options, null, 4));
	console.log('Request Data: ' + JSON.stringify(post_data, null, 4));
	
	// Set up the request
	var post_req = http.request(post_options, function(res) {
	  res.setEncoding('utf8');
	  res.on('data', function (chunk) {
	      console.log('Response: ' + chunk);
	  });
	});
	
	// post the data
	post_req.write(post_data);
	post_req.end(); 
    console.log("Home-Assistant: Executed accessory %s for %s - '%s' with value '%s'", accessory, lightID, characteristic, value);
}


/*
 *
 * LIGHT ACCESSORY
 *
 */
var accessoryTemplateLight = function () {
	return {
		displayName: "friendly_name", // Replace with HA friendly_name,
		username: "entity_id",  // Replace with HA entity_id
		pincode: "031-45-154",
		services: [{
			sType: types.ACCESSORY_INFORMATION_STYPE,
			characteristics: [{
				cType: types.NAME_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: 'HA Light',
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Name of accessory",
				designedMaxLength: 255
			},{
				cType: types.MANUFACTURER_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "HA", //"Oltica",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Manufacturer",
				designedMaxLength: 255
			},{
				cType: types.MODEL_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "light", // Lightbulb Model
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla3",
				designedMaxLength: 255
			},{
				cType: types.SERIAL_NUMBER_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "HA-eneity_id",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Serial Number",
				designedMaxLength: 255
			},{
				cType: types.IDENTIFY_CTYPE,
				onUpdate: null, // TODO: Add Identift onUpdate
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
				manfDescription: "Name of Service",
				designedMaxLength: 255
			}]
		}]
	};
};

//the factory creates new accessory objects with the parameters that are passed
var myLightAccFactory = function (paramsObject) {

	if (typeof paramsObject === 'undefined') {
		console.log("myAccFactory requires an paramsObject!");
		throw {name: "ENOPARAMS", message: "required parameter missing, provide home-assistant state dictionary"};
	}

	if (typeof paramsObject.entity_id !== 'string') {
		console.log("myAccFactory requires an paramsObject.entity_id as a string!");
		throw {name: "ENOPARAMS", message: "required parameter missing: entity_id"};
	}
	if (typeof paramsObject.attributes.friendly_name !== 'string') {
		console.log("myAccFactory requires an paramsObject.friendly_name as a string!");
		throw {name: "ENOPARAMS", message: "required parameter missing: friendly_name"};
	}


	var newAccessory = newTemplateAccessory();
	newAccessory.username = paramsObject.entity_id;
	newAccessory.displayName =  paramsObject.attributes.friendly_name;
	newAccessory.locals = {
		entity_id : paramsObject.entity_id,
		friendly_name : paramsObject.attributes.friendly_name,
	};
	newAccessory.services[0].characteristics[0].initialValue = paramsObject.attributes.friendly_name; // NAME_CTYPE
	newAccessory.services[0].characteristics[3].initialValue = "HA" + "-" + paramsObject.entity_id.toUpperCase(); // SERIAL_NUMBER_CTYPE
	newAccessory.services[1].characteristics[0].initialValue = paramsObject.attributes.friendly_name + " Light Service"; // must access object directly

	// create main characteristics for a lamp: the power switch
	newAccessory.services[1].characteristics.push({
		cType: types.POWER_STATE_CTYPE,
		onUpdate: function(value) {
			var numericValue = 0;
			if (value) {
				numericValue = 1;
			}
			console.log("Change:",value); 
			//  function(accessory,lightID,characteristic,value)
			execute("onUpdate", this.locals.entity_id, "on", numericValue);
		},
		// new snowdd1
		/*
		onRegister: function(assignedCharacteristic) {
			console.log("Registering for "+ assignedCharacteristic.locals.fullname, "light service (switch)");
//			busMonitor.registerGA(assignedCharacteristic, assignedCharacteristic.locals.listenAdresses); // register all listen addresses
		},*/
		perms: ["pw","pr","ev"],  // assumption: Property Read, Property Write, Events
		format: "bool",
		initialValue: false,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Turn lights on and off",
		designedMaxLength: 1
	});



	// add the features of the brightness controller as a new characteristics object to the array
	newAccessory.services[1].characteristics.push({
		cType: types.BRIGHTNESS_CTYPE,
		onUpdate: function(value) { 

			console.log("Change:" + value.toString + value); 
			execute("onUpdate", this.locals.entity_id, "brightness", value);
		},
		/*
		onRegister: function(assignedCharacteristic) {
			console.log("Registering for "+ assignedCharacteristic.locals.fullname, "light service (Brightness)");
//			busMonitor.registerGA(assignedCharacteristic, assignedCharacteristic.locals.listenBrightnessAddresses); // register all listen addresses
		},*/
		perms: ["pw","pr","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Adjust Brightness of Light",
		designedMinValue: 0,
		designedMaxValue: 100,
		designedMinStep: 1,
		unit: "%"
	});

	return newAccessory;
};





/*
 *
 * SWITCH ACCESSORY
 *
 */
var accessoryTemplateSwitch = function () {
	return {
		displayName: "friendly_name", // Replace with HA friendly_name,
		username: "entity_id",  // Replace with HA entity_id
		pincode: "031-45-154",
		services: [{
			sType: types.ACCESSORY_INFORMATION_STYPE,
			characteristics: [{
				cType: types.NAME_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: 'HA Light',
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Name of accessory",
				designedMaxLength: 255
			},{
				cType: types.MANUFACTURER_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "HA", //"Oltica",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Manufacturer",
				designedMaxLength: 255
			},{
				cType: types.MODEL_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "light", // Lightbulb Model
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Bla3",
				designedMaxLength: 255
			},{
				cType: types.SERIAL_NUMBER_CTYPE,
				onUpdate: null,
				perms: ["pr"],
				format: "string",
				initialValue: "HA-eneity_id",
				supportEvents: false,
				supportBonjour: false,
				manfDescription: "Serial Number",
				designedMaxLength: 255
			},{
				cType: types.IDENTIFY_CTYPE,
				onUpdate: null, // TODO: Add Identift onUpdate
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
				manfDescription: "Name of Service",
				designedMaxLength: 255
			}]
		}]
	};
};

//the factory creates new accessory objects with the parameters that are passed
var myLightAccFactory = function (paramsObject) {

	if (typeof paramsObject === 'undefined') {
		console.log("myAccFactory requires an paramsObject!");
		throw {name: "ENOPARAMS", message: "required parameter missing, provide home-assistant state dictionary"};
	}

	if (typeof paramsObject.entity_id !== 'string') {
		console.log("myAccFactory requires an paramsObject.entity_id as a string!");
		throw {name: "ENOPARAMS", message: "required parameter missing: entity_id"};
	}
	if (typeof paramsObject.attributes.friendly_name !== 'string') {
		console.log("myAccFactory requires an paramsObject.friendly_name as a string!");
		throw {name: "ENOPARAMS", message: "required parameter missing: friendly_name"};
	}


	var newAccessory = newTemplateAccessory();
	newAccessory.username = paramsObject.entity_id;
	newAccessory.displayName =  paramsObject.attributes.friendly_name;
	newAccessory.locals = {
		entity_id : paramsObject.entity_id,
		friendly_name : paramsObject.attributes.friendly_name,
	};
	newAccessory.services[0].characteristics[0].initialValue = paramsObject.attributes.friendly_name; // NAME_CTYPE
	newAccessory.services[0].characteristics[3].initialValue = "HA" + "-" + paramsObject.entity_id.toUpperCase(); // SERIAL_NUMBER_CTYPE
	newAccessory.services[1].characteristics[0].initialValue = paramsObject.attributes.friendly_name + " Light Service"; // must access object directly

	// create main characteristics for a lamp: the power switch
	newAccessory.services[1].characteristics.push({
		cType: types.POWER_STATE_CTYPE,
		onUpdate: function(value) {
			var numericValue = 0;
			if (value) {
				numericValue = 1;
			}
			console.log("Change:",value); 
			//  function(accessory,lightID,characteristic,value)
			execute("onUpdate", this.locals.entity_id, "on", numericValue);
		},
		// new snowdd1
		/*
		onRegister: function(assignedCharacteristic) {
			console.log("Registering for "+ assignedCharacteristic.locals.fullname, "light service (switch)");
//			busMonitor.registerGA(assignedCharacteristic, assignedCharacteristic.locals.listenAdresses); // register all listen addresses
		},*/
		perms: ["pw","pr","ev"],  // assumption: Property Read, Property Write, Events
		format: "bool",
		initialValue: false,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Turn lights on and off",
		designedMaxLength: 1
	});



	// add the features of the brightness controller as a new characteristics object to the array
	newAccessory.services[1].characteristics.push({
		cType: types.BRIGHTNESS_CTYPE,
		onUpdate: function(value) { 

			console.log("Change:" + value.toString + value); 
			execute("onUpdate", this.locals.entity_id, "brightness", value);
		},
		/*
		onRegister: function(assignedCharacteristic) {
			console.log("Registering for "+ assignedCharacteristic.locals.fullname, "light service (Brightness)");
//			busMonitor.registerGA(assignedCharacteristic, assignedCharacteristic.locals.listenBrightnessAddresses); // register all listen addresses
		},*/
		perms: ["pw","pr","ev"],
		format: "int",
		initialValue: 0,
		supportEvents: false,
		supportBonjour: false,
		manfDescription: "Adjust Brightness of Light",
		designedMinValue: 0,
		designedMaxValue: 100,
		designedMinStep: 1,
		unit: "%"
	});

	return newAccessory;
};


/*
 *
 * Helper Functions
 *
 */


function strStartsWith(str, prefix) {
    return str.indexOf(prefix) === 0;
}


/*
 *
 * Main
 *
 */

module.exports = (function () {

	var accessories = [];
	
	/*
	For debugging and loading from file
	var fs = require('fs');
	var path = require('path');
	var states = JSON.parse(fs.readFileSync(path.join(__dirname, 'home_assistant_states.json') , 'utf8'));
	*/
	
	var statesURL = "http://" + home_assistant_config.host + ":" + home_assistant_config.port + "/api/states?api_password=" + home_assistant_config.api_password;
	var request = require('sync-request');
	
    console.log("Home-Assistant Accessories: Loading Home-Assistant config...");
	try {
		var res = request('GET', statesURL);
	}
	catch(err) {
	    console.log("Home-Assistant Accessories: Could not load config from Home Assistant: ", err.message);
		return accessories;
	}
	
		
	states = JSON.parse(res.getBody('utf8'), 'utf8');
		
	for(var i = 0; i < states.length; i++ ) {
		
		var state = states[i];
		if(strStartsWith(state['entity_id'], "light.") == true) {
			
			console.log("Home-Assistant Accessories: Createing accessory for Light %s (%s)", state.attributes['friendly_name'], state['entity_id']);
			accessories.push({accessory: myLightAccFactory(state)});
		}
		
	}
	
	return accessories;
}());


