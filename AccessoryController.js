AccessoryController.prototype = {
	addService: function addService(service) {
		service.instanceID = this.instanceID;
		service.accessoryController = this;
		this.objects[service.instanceID] = service;
		this.instanceID += 1;
		this.services.push(service);
		if (service.characteristics.length > 0) {
			for (var i = 0; i < service.characteristics.length; i++) {
				var characteristic = service.characteristics[i];
				characteristic.instanceID = this.instanceID;
				characteristic.accessoryID = 1;
				characteristic.accessoryController = this;
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
		var accessory = {
			aid: 1,
			services: servicesObjects
		}
		var dict = {
			accessories: [accessory]
		}
		return JSON.stringify(dict);
	},
	jsonForCharacteristicUpdate: function jsonForCharacteristicUpdate(aid, iid) {
		var charObject = this.objects[iid];
		var charValue = charObject.valueForUpdate();
		var respDict = {
			characteristics: [
				{
					aid: aid,
					iid: iid,
					value: charValue
				}
			]
		}
		return JSON.stringify(respDict);
	},
	processCharacteristicsValueWrite: function processCharacteristicsValueWrite(updates, peer) {
		var updates_objects = JSON.parse(updates.toString());
		console.log(updates_objects);
		var update_characteristics = updates_objects["characteristics"];
		var update_char = update_characteristics[0];
		if (update_char !== undefined) {
			var update_char_iid = update_char["iid"];
			var update_char_value = update_char["value"];
			var update_char_event = update_char["ev"];
			var charObject = this.objects[update_char_iid];
			if (update_char_value !== undefined) {
				charObject.updateCharacteristicValue(update_char_value, peer);
			}
			if (update_char_event !== undefined) {
				charObject.updateCharacteristicEvent(update_char_event, peer);
			}
		};
	},
	broadcastEvent: function broadcastEvent(data, subscribedPeers, peer) {
		if (this.tcpServer !== undefined) {
			this.tcpServer.broadcastEvent(data, subscribedPeers, peer);
		}
	}
}

function AccessoryController() {
	if (!(this instanceof AccessoryController))  {
		return new AccessoryController();
	}
	this.instanceID = 1;
	this.objects = {};
	this.services = [];
}

module.exports = {
	AccessoryController: AccessoryController
};