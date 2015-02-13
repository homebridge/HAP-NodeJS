Accessory.prototype = {
	addService: function addService(service) {
		service.instanceID = this.instanceID;
		service.accessoryController = this.accessoryController;
		this.objects[service.instanceID] = service;
		this.instanceID += 1;
		this.services.push(service);
		if (service.characteristics.length > 0) {
			for (var i = 0; i < service.characteristics.length; i++) {
				var characteristic = service.characteristics[i];
				characteristic.instanceID = this.instanceID;
				characteristic.accessoryID = 1;
				characteristic.accessoryController = this.accessoryController;
				this.objects[characteristic.instanceID] = characteristic;
				this.instanceID += 1;
			};
		}
	},
	jsonPresentation: function jsonPresentation() {
		var servicesObjects = [];
		for (var i = 0; i < this.services.length; i++) {
			var service = this.services[i];
			servicesObjects.push(service.objectsPresentation());
		};
		return servicesObjects;
	}
};

function Accessory(accessoryController) {
	if (!(this instanceof Accessory))  {
		return new Accessory(accessoryController);
	}
	this.instanceID = 1;
	this.objects = {};
	this.services = [];
	this.accessoryController = accessoryController;
}

module.exports = {
	Accessory: Accessory
};
