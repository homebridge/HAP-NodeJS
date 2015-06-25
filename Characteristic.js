/*
 * Updated 20150513: add a new optional property onRead:callback if Siri asks for a status update, 
 * which might not have been pushed to the charcteristic
 * 
 * I think it is often recommendable to update the characteristics through event hooks, using the onRegister:callback 
 * and pushing notifications to all registered devices,
 * however there might be circumstances you want to read only if Siri asks you.   
 */

//var debug = require("./accessories/mydebug.js");
function Characteristic(options, onUpdate) {
	if (!(this instanceof Characteristic))  {
		return new Characteristic(options, onUpdate); // snowdd1 : added onUpdate to parameters
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
	this.onRegister = options.onRegister;
	this.locals = options.locals; // local attributes for device control methods // snowdd1
	
	// new: call onRegister function if one is supplied in the *_accessory file
	// snowdd1
	if (options.onRegister) {
		// the characteristics block has a register method
		console.log("checking "+ options.manfDescription + " "+ typeof(options.onRegister));
		if (typeof(options.onRegister) === "function") {
			console.log("Characteristics.js: registering "+ options.manfDescription + " "+ typeof(options.onRegister));
			//debug.iterate(this);
			this.onRegister(this);
		}
	}
	// /snowdd1	 
	
	// snowdd1 20150513
	this.onRead = options.onRead;
	// /snowdd1 20150513
	
	
	
}

Characteristic.prototype = {
	updateCharacteristicValue: function updateCharacteristicValue(value, peer) { // write to the device
		this.value = value;
		this.updateValue(value, peer);
		if (this.onUpdate !== null) {  // if there is an onUpdate function in the characteristic, call it!
			console.log("Characteristics.js:updateCharacteristicValue()");
			this.onUpdate(value); //here the onUpdate function is called
		} else {
			console.log("Characteristic.js:updateCharacteristicValue() without onUpdate function:",value);
		}
	},
	updateCharacteristicEvent: function updateCharacteristicEvent(event, peer) {
		console.log("Characteristics.js:updateCharacteristicEvent(): Enable Event:",event);
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
	updateValue: function updateValue(value, peer) { // external updates & broadcasting updates, writing to the device is done above
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
				};
				var eventJSON = JSON.stringify(eventDict);
				console.log("Broadcasting event " + eventJSON + " to: " + JSON.stringify(this.subscribedPeers));
				this.accessoryController.broadcastEvent(eventJSON, this.subscribedPeers, peer);
			}
		} else { console.log("Characteristics.js:updateValue():NotEventEnabled"); }
	},
	valueForUpdate: function valueForUpdate() { // reading values FROM THE DEVICE, better: from this object
		console.log("Characteristics.js:valueForUpdate(): called, Siri has asked for the accessory's status");
		if (this.onRead) {
			console.log("Characteristics.js:valueForUpdate(): invoking callback");
			var temp = this.onRead();
			this.value = temp ? temp : this.value;
		}
		console.log("Characteristics.js:valueForUpdate(): called, Siri has asked for the accessory's status: returning " + this.value);
		return this.value;
		//
		
	}
};

module.exports = {
	Characteristic: Characteristic
};
