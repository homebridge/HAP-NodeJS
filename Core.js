var storage = require('node-persist');

var accessory_Factor = new require("./Accessory.js");
var accessoryController_Factor = new require("./AccessoryController.js");
var service_Factor = new require("./Service.js");
var characteristic_Factor = new require("./Characteristic.js");

var targetPort = 51826;

// Get the accessories data
var fs = require('fs');
var path = require('path');

var accessoriesJSON = [];
var accessoryFactoryFile;

// Get user defined accessories from the accessories folder
// - user defined accessory filenames must end with "_accessory.js"
fs.readdirSync(path.join(__dirname, "accessories")).forEach(function(file) {
	if (file.split('_').pop()==="accessory.js") {
		console.log("Parsing accessory: "+file); //debug
		accessoriesJSON.push(require("./accessories/" + file).accessory);
	}
});

// snowdd1
// Get user defined accessory factories from the accessories folder
//- user defined accessory factory filenames must end with "_accfactory.js"
// they MUST return an array of accessories!
fs.readdirSync(path.join(__dirname, "accessories")).forEach(function(file) { //snowdd1
	if (file.split('_').pop()==="accfactory.js") {
		//console.log("Parsing accessory factory : "+file); //debug
		accessoryFactoryFile = require("./accessories/" + file); // should return an array of accessories!
		//console.log("Got an "+typeof accessoryFactoryFile + " with an length of "+accessoryFactoryFile.length);
		for (var i = 0; i < accessoryFactoryFile.length; i++) {
			console.log("Parsing accessory : "+i);
			accessoriesJSON.push(accessoryFactoryFile[i].accessory);
		}
	}
}); 
//snowdd1 end

console.log("HAP-NodeJS starting...");
storage.initSync();


var accessories = [];
var accessoryControllers = [];

//loop through accessories
for (var i = 0; i < accessoriesJSON.length; i++) {
	var accessoryController = new accessoryController_Factor.AccessoryController();

	//loop through services
	for (var j = 0; j < accessoriesJSON[i].services.length; j++) {
		var service = new service_Factor.Service(accessoriesJSON[i].services[j].sType);

		//loop through characteristics
		for (var k = 0; k < accessoriesJSON[i].services[j].characteristics.length; k++) {
			var options = {
				onRead: accessoriesJSON[i].services[j].characteristics[k].onRead,
				type: accessoriesJSON[i].services[j].characteristics[k].cType,
				perms: accessoriesJSON[i].services[j].characteristics[k].perms,
				format: accessoriesJSON[i].services[j].characteristics[k].format,
				initialValue: accessoriesJSON[i].services[j].characteristics[k].initialValue,
				supportEvents: accessoriesJSON[i].services[j].characteristics[k].supportEvents,
				supportBonjour: accessoriesJSON[i].services[j].characteristics[k].supportBonjour,
				manfDescription: accessoriesJSON[i].services[j].characteristics[k].manfDescription,
				designedMaxLength: accessoriesJSON[i].services[j].characteristics[k].designedMaxLength,
				designedMinValue: accessoriesJSON[i].services[j].characteristics[k].designedMinValue,
				designedMaxValue: accessoriesJSON[i].services[j].characteristics[k].designedMaxValue,
				designedMinStep: accessoriesJSON[i].services[j].characteristics[k].designedMinStep,
				unit: accessoriesJSON[i].services[j].characteristics[k].unit,
				onRegister: accessoriesJSON[i].services[j].characteristics[k].onRegister,  // snowdd1
				locals: accessoriesJSON[i].locals //snowdd1
			};

			var characteristic = new characteristic_Factor.Characteristic(options, accessoriesJSON[i].services[j].characteristics[k].onUpdate);

			service.addCharacteristic(characteristic);
		}
		accessoryController.addService(service);
	}

	//increment targetport for each accessory
	targetPort = targetPort + (i*2);

	var accessory = new accessory_Factor.Accessory(accessoriesJSON[i].displayName, accessoriesJSON[i].username, storage, parseInt(targetPort), accessoriesJSON[i].pincode, accessoryController);
	accessories[i] = accessory;
	accessoryControllers[i] = accessoryController;
	accessory.publishAccessory();
}