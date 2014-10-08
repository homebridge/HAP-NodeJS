var advertiser_fac = require("./Advertiser.js");
var server_fac = require("./Server.js");
var tcpServer_fac = require("./TCPServer.js");
var nacl_factory = require("js-nacl");
var nacl = nacl_factory.instantiate();

Accessory.prototype = {
	publishAccessory: function publishAccessory() {
		if (this._private.advertiser !== undefined) {
			this._private.advertiser.startAdvertising();
		}
		if (this._private.tcpServer !== undefined) {
			this._private.tcpServer.startServer();
		}
		if (this._private.hapServer !== undefined) {
			this._private.hapServer.startHAPServer(this.targetPort + 1);
		}
	}
};

function Accessory(displayName, username, persistStore, targetPort, pincode, accessoryController) {
	if (!(this instanceof Accessory))  {
		return new Accessory(displayName, username, persistStore, targetPort, pincode, accessoryController);
	}
	this.displayName = displayName;
	this.username = username;
	this.targetPort = targetPort;
	this.accessoryController = accessoryController;
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
		}.bind(this), persistStore, accessoryController)
	}
	this.accessoryController.tcpServer = this._private.tcpServer;
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
	this.keyPair = nacl.crypto_sign_keypair();
}

module.exports = {
	Accessory: Accessory,
	AccessoryInfo: AccessoryInfo
};