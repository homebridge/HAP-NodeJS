BridgedAccessoryController.prototype = {
	addAccessory: function addAccessory(accessory) {
		var that = this;
		accessory.bridgeController = that;
		accessory.accessoryID = that.accessoryID;
		that.accessories.push(accessory);
		that.accessoryID += 1;
	},
	jsonPresentation: function jsonPresentation() {
		var accessoryObjects = [];
		for (var i = 0; i < this.accessories.length; i++) {
			var accessory = this.accessories[i];
			accessoryObjects.push(accessory.accessoryJsonPresentation());
		};
		var dict = {
			accessories: accessoryObjects
		}
		return JSON.stringify(dict);
	},
	jsonForCharacteristicUpdate: function jsonForCharacteristicUpdate(aid, iid, callback) {
		var accessory = this.accessories[aid - 1];
		accessory.jsonForCharacteristicUpdate(aid,iid, function(json){
			callback(json);
		});
	},
	processCharacteristicsValueWrite: function processCharacteristicsValueWrite(updates, peer) {
		var updates_objects = JSON.parse(updates.toString());
		var update_characteristics = updates_objects["characteristics"];
		for (var i = 0; i < update_characteristics.length; i++) {
			var update_char = update_characteristics[i];
			var update_char_aid = update_char["aid"];
			var accessory = this.accessories[update_char_aid - 1];
			accessory.processSingleCharacteristicsValueWrite(update_char, peer);
		}
	},
	broadcastEvent: function broadcastEvent(data, subscribedPeers, peer) {
		if (this.tcpServer !== undefined) {
			this.tcpServer.broadcastEvent(data, subscribedPeers, peer);
		}
	}
}

function BridgedAccessoryController() {
	if (!(this instanceof BridgedAccessoryController))  {
		return new BridgedAccessoryController();
	}
	this.accessoryID = 1;
	this.accessories = [];
}

module.exports = {
	BridgedAccessoryController: BridgedAccessoryController
};