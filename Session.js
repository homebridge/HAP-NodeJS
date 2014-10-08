var encryption = require("./Encryption.js");
var hkdf = require("node-hkdf");
var net = require('net');
var server_fac = require("./Server.js");

HAPSession.prototype = {
	updateEncryptTrafficStatus: function updateEncryptTrafficStatus() {
		if (this.shouldEncrypt) {
			this.isEncryptInUse = true;
		}
	},
	sendHAPEvent: function sendHAPEvent(data) {
		if (this.isEncryptInUse && (this.socket !== undefined)) {
			var resultMsg = encryption.layer_encrypt(data,this.accessoryToControllerCount,this.accessoryToControllerKey);
	    	this.socket.write(resultMsg);
		}
	},
	setupSession: function setupSession(socket, hapPort) {
		console.log("New Session", socket.remotePort);

		//From HAP Server
		var serviceSocket = new net.Socket();
		serviceSocket.connect(parseInt(hapPort), "127.0.0.1", function () {
	        console.log("Server Connection Established", serviceSocket.localPort);
	        this.localPort = serviceSocket.localPort;
	        this.registerCallback(this.socket.remotePort, serviceSocket.localPort);
	    }.bind(this));
	    serviceSocket.on("data", function (data) {
	    	if (this.isEncryptInUse) {
				var resultMsg = encryption.layer_encrypt(data,this.accessoryToControllerCount,this.accessoryToControllerKey);
	    		socket.write(resultMsg);
	    	} else {
	    		socket.write(data);
	    		this.updateEncryptTrafficStatus();
	    	}
		}.bind(this));
		serviceSocket.on("close", function() {
		  console.log('Server Disconnected');
		  this.tcpServer.removeSession(this.localPort);
		  socket.end();
		  this.socket = undefined;
		}.bind(this));

		//From iOS
	    socket.on('data', function (msg) {
	    	if (this.isEncryptInUse) {
	    		var resultMsg = encryption.layer_decrypt(msg,this.controllerToAccessoryCount,this.controllerToAccessoryKey);
	    		serviceSocket.write(resultMsg);
	    	} else {
	    		serviceSocket.write(msg);
	    	}
	    }.bind(this));
	    socket.on("close", function() {
		  console.log('Client Disconnected');
		  this.tcpServer.removeSession(this.localPort);
		  this.socket = undefined;
		  serviceSocket.end();
		}.bind(this));
	},
	enableEncryptionForSession: function enableEncryptionForSession(sharedSec) {
		this.shouldEncrypt = true;
		this.sharedSec = sharedSec;
		this.accessoryToControllerCount = {Value: 0};
		this.controllerToAccessoryCount = {Value: 0};

		var enc_salt = new Buffer("Control-Salt");
		var info_read = new Buffer("Control-Read-Encryption-Key");
		var info_write = new Buffer("Control-Write-Encryption-Key");

		var output_key_read = hkdf.HKDF("sha512",enc_salt,sharedSec,info_read,32);
		this.accessoryToControllerKey = output_key_read;

		var output_key_write = hkdf.HKDF("sha512",enc_salt,sharedSec,info_write,32);
		this.controllerToAccessoryKey = output_key_write;
	}
}

function HAPSession(tcpServer, socket, hapPort, persistStore, accessoryInfo, callback) {
	if (!(this instanceof HAPSession))  {
		return new HAPSession(tcpServer, socket, persistStore, accessoryInfo);
	}
	this.tcpServer = tcpServer;
	this.socket = socket;
	this.persistStore = persistStore;
	this.shouldEncrypt = false;
	this.isEncryptInUse = false;
	this.registerCallback = callback;
	this.setupSession(socket, hapPort);
}

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

module.exports = {
	HAPSession: HAPSession
}