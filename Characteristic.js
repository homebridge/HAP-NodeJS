function Characteristic(options, onUpdate) {
	if (!(this instanceof Characteristic))  {
		return new Characteristic(options);
	}

	this.instanceID = 0;
	this.accessoryID = 0;
	this.type = options.type;
	this.value = options.initialValue;
	this.perms = options.perms;
	this.format = options.format;
	this.supportEvents = options.supportEvents;
	this.supportBonjour = options.supportBonjour;
	this.manfDescription = options.manfDescription;
	this.designedMaxLength = options.designedMaxLength;
	this.designedMinValue = options.designedMinValue;
	this.designedMaxValue = options.designedMaxValue;
	this.designedMinStep = options.designedMinStep;
	this.unit = options.unit;

	this.eventEnabled = false;
	this.bonjourEnabled = false;

	this.subscribedPeers = {};

	this.onUpdate = onUpdate;
}

Characteristic.prototype = {
	updateCharacteristicValue: function updateCharacteristicValue(value, peer) {
		this.value = value;
		this.updateValue(value, peer);
		if (this.onUpdate !== null) {
			this.onUpdate(value);
		} else {
			console.log("Update:",value);
		}
	},
	updateCharacteristicEvent: function updateCharacteristicEvent(event, peer) {
		console.log("Enable Event:",event);
		this.subscribedPeers[peer] = event;
		this.eventEnabled = event;
	},
	objectPresentation: function objectPresentation() {
		var object = {
			iid: this.instanceID,
			type: this.type,
			perms: this.perms,
			format: this.format,
			events: this.eventEnabled,
			bonjour: this.bonjourEnabled,
		};

		if (this.perms.indexOf("pr") > -1) {
			object["value"] = this.value;
		}

		if (this.manfDescription !== undefined) {
			object.description = this.manfDescription;
		}
		if (this.designedMaxLength !== undefined) {
			object.maxLen = this.designedMaxLength;
		}
		if (this.designedMinValue !== undefined) {
			object.minValue = this.designedMinValue;
		}
		if (this.designedMaxValue !== undefined) {
			object.maxValue = this.designedMaxValue;
		}
		if (this.designedMinStep !== undefined) {
			object.minStep = this.designedMinStep;
		}
		if (this.unit !== undefined) {
			object.unit = this.unit;
		}
		
		return object;
	},
	updateValue: function updateValue(value, peer) {
		this.value = value;
		if(this.eventEnabled) {
			if (this.accessoryController !== undefined) {
				var eventDict = {
					characteristics: [
						{
							aid: this.accessoryController.accessoryID,
							iid: this.instanceID,
							value: this.value
						}
					]
				}
				var eventJSON = JSON.stringify(eventDict);
				this.accessoryController.broadcastEvent(eventJSON, this.subscribedPeers, peer);
			}
		}
	},
	valueForUpdate: function valueForUpdate() {
		return this.value;
	}
}

module.exports = {
	Characteristic: Characteristic
};