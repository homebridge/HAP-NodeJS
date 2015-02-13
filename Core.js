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
		accessoriesJSON.push(require("./accessories/" + file).accessories);
	};
});


console.log("HAP-NodeJS starting...");
storage.initSync();


var accessories = [];
var accessoryControllers = [];

//loop through accessories
for (var i = 0; i < accessoriesJSON.length; i++) {
	var accessoryController = new accessoryController_Factor.AccessoryController(accessoriesJSON[i].displayName, accessoriesJSON[i].username, storage, parseInt(targetPort), accessoriesJSON[i].pincode);

	for (var j = 0; j < accessoriesJSON[i].accessories.length; j++) {
		var accessory = new accessory_Factor.Accessory(accessoryController);
		//loop through services
		for (var k = 0; k < accessoriesJSON[i].accessories[j].services.length; k++) {
			var service = new service_Factor.Service(accessoriesJSON[i].accessories[j].services[k].sType);

			//loop through characteristics
			for (var l = 0; l < accessoriesJSON[i].accessories[j].services[k].characteristics.length; l++) {
				var options = {
					type: accessoriesJSON[i].accessories[j].services[k].characteristics[l].cType,
					perms: accessoriesJSON[i].accessories[j].services[k].characteristics[l].perms,
					format: accessoriesJSON[i].accessories[j].services[k].characteristics[l].format,
					initialValue: accessoriesJSON[i].accessories[j].services[k].characteristics[l].initialValue,
					supportEvents: accessoriesJSON[i].accessories[j].services[k].characteristics[l].supportEvents,
					supportBonjour: accessoriesJSON[i].accessories[j].services[k].characteristics[l].supportBonjour,
					manfDescription: accessoriesJSON[i].accessories[j].services[k].characteristics[l].manfDescription,
					designedMaxLength: accessoriesJSON[i].accessories[j].services[k].characteristics[l].designedMaxLength,
					designedMinValue: accessoriesJSON[i].accessories[j].services[k].characteristics[l].designedMinValue,
					designedMaxValue: accessoriesJSON[i].accessories[j].services[k].characteristics[l].designedMaxValue,
					designedMinStep: accessoriesJSON[i].accessories[j].services[k].characteristics[l].designedMinStep,
					unit: accessoriesJSON[i].accessories[j].services[k].characteristics[l].unit,
				}

				var characteristic = new characteristic_Factor.Characteristic(options, accessoriesJSON[i].accessories[j].services[k].characteristics[l].onUpdate);

				service.addCharacteristic(characteristic);
			};
			accessory.addService(service);
		};
		accessoryController.addAccessory(accessory);
	};
	//increment targetport for each accessory
	targetPort = targetPort + (i*2);

	accessoryController.publishAccessory();
	accessoryControllers[i] = accessoryController;
};
