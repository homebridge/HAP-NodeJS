var storage = require('node-persist');

var accessory_Factor = new require("./Accessory.js");
var accessoryController_Factor = new require("./AccessoryController.js");
var service_Factor = new require("./Service.js");
var characteristic_Factor = new require("./Characteristic.js");

var targetPort = 51826;

// Get the accessories data
var fs = require('fs');
var path = require('path');

var accessoriesJSON = []


// Get user defined accessories from the accessories folder
// - user defined accessory filenames must end with "_accessory.js"
fs.readdirSync(path.join(__dirname, "accessories")).forEach(function(file) {
	if (file.split('_').pop()==="accessory.js") {
		accessoriesJSON.push(require("./accessories/" + file).accessory);
	};
});


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
			}

			var characteristic = new characteristic_Factor.Characteristic(options, accessoriesJSON[i].services[j].characteristics[k].onUpdate);

			service.addCharacteristic(characteristic);
		};	
		accessoryController.addService(service);
	};

	//increment targetport for each accessory
	targetPort = targetPort + (i*2);

	var accessory = new accessory_Factor.Accessory(accessoriesJSON[i].displayName, accessoriesJSON[i].username, storage, parseInt(targetPort), accessoriesJSON[i].pincode, accessoryController);
	accessories[i] = accessory;
	accessoryControllers[i] = accessoryController;
	accessory.publishAccessory();
};