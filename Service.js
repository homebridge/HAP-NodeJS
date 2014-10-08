function Service(type) {
	if (!(this instanceof Service))  {
		return new Service(type);
	}

	this.instanceID = 0;
	this.type = type;
	this.characteristics = [];
}

Service.prototype = {
	addCharacteristic: function addCharacteristic(characteristic) {
		this.characteristics.push(characteristic);
	},
	objectsPresentation: function objectsPresentation() {
		var characteristicsObjects = [];

		for (var i = 0; i < this.characteristics.length; i++) {
			var characteristic = this.characteristics[i];
			characteristicsObjects.push(characteristic.objectPresentation());
		};

		var serviceDict = {
			iid: this.instanceID,
			type: this.type,
			characteristics: characteristicsObjects
		}
		return serviceDict;
	}
}

module.exports = {
	Service: Service
};