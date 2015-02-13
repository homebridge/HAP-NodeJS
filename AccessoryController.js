var advertiser_fac = require("./Advertiser.js");
var server_fac = require("./Server.js");
var tcpServer_fac = require("./TCPServer.js");
var crypto = require("crypto");
var ed25519 = require("ed25519");

AccessoryController.prototype = {
	addAccessory: function addAccessory(accessory) {
		this.accessories.push(accessory);
	},
	publishAccessory: function publishAccessory() {
		if (this._private.advertiser !== undefined) {
			this._private.advertiser.startAdvertising();
		}
		if (this._private.tcpServer !== undefined) {
			this._private.tcpServer.startServer();
		}
		if (this._private.hapServer !== undefined) {
			this._private.hapServer.tcpServer = this._private.tcpServer;
			this._private.hapServer.startHAPServer(this.targetPort + 1);
		}
	},
	jsonPresentation: function jsonPresentation() {
		var accessoryObjects = [];
		for (var i = 0; i < this.accessories.length; i++) {
			var accessory = {
				aid: i + 1,
				services: this.accessories[i].jsonPresentation()
			}
			accessoryObjects.push(accessory);
		};
		var dict = {
			accessories: accessoryObjects
		}
		return JSON.stringify(dict);
	},
	broadcastEvent: function broadcastEvent(data, subscribedPeers, peer) {
		if (this.tcpServer !== undefined) {
			this.tcpServer.broadcastEvent(data, subscribedPeers, peer);
		}
	},
	jsonForCharacteristicUpdate: function jsonForCharacteristicUpdate(aid, iid) {
		var charObject = this.accessories[aid - 1].objects[iid];
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
		for (var i = 0; i < update_characteristics.length; i++) {
			var update_char = update_characteristics[i];
			var update_aid = update_char["aid"];
			var update_char_iid = update_char["iid"];
			var update_char_value = update_char["value"];
			var update_char_event = update_char["ev"];
			var charObject = this.accessories[update_aid - 1].objects[update_char_iid];
			if (update_char_value !== undefined) {
				charObject.updateCharacteristicValue(update_char_value, peer);
			}
			if (update_char_event !== undefined) {
				charObject.updateCharacteristicEvent(update_char_event, peer);
			}
		}
	}
}

function AccessoryController(displayName, username, persistStore, targetPort, pincode) {
	if (!(this instanceof AccessoryController))  {
		return new AccessoryController(displayName, username, persistStore, targetPort, pincode);
	}
	this.displayName = displayName;
	this.username = username;
	this.targetPort = targetPort;
	this.accessories = [];
	this.accessoryInfo = new AccessoryInfo(this.displayName,this.username, pincode);
	var savedKey = persistStore.getItem(username);
		if (savedKey !== undefined) {
		var keyPair = savedKey;
		this.accessoryInfo.setKeyPair(keyPair);
	} else {
		console.log("Cannot find secret key, creating One...");
		persistStore.setItem(username, this.accessoryInfo.keyPair);
		persistStore.persistSync();
	}
	this._private = {
		store: persistStore,
		advertiser: new advertiser_fac.Advertiser(targetPort, this.displayName,this.username,"1","1"),
		tcpServer: new tcpServer_fac.TCPServer(targetPort, targetPort+1, persistStore, this.accessoryInfo),
		hapServer: new server_fac.HAPServer(this.accessoryInfo, function (connectPort, sharedSec){
			this._private.tcpServer.enableEncryptionForSession(connectPort, sharedSec);
		}.bind(this), persistStore, this)
	}
}

AccessoryInfo.prototype = {
	setKeyPair: function setKeyPair(keys) {
		this.keyPair = keys;
	}
}

function AccessoryInfo(displayName,username, pincode) {
	if (!(this instanceof AccessoryInfo))  {
		return new AccessoryInfo(displayName,username);
	}
	this.displayName = displayName;
	this.username = username;
	this.pincode = pincode;

	var seed = crypto.randomBytes(32);
	var keyPair = ed25519.MakeKeypair(seed);
	this.keyPair = {
		signSk: keyPair.privateKey,
		signPk: keyPair.publicKey
	};
}

module.exports = {
	AccessoryController: AccessoryController,
	AccessoryInfo: AccessoryInfo
};
