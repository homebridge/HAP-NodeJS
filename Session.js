var encryption = require("./Encryption.js");
var hkdf = require("./hkdf.js");
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
			try {
				this.socket.write(resultMsg);
			} catch (ex) {
				console.log("An Error Occured when sending events,",ex);
			}
		}
	},
	setupSession: function setupSession(socket, hapPort) {
		console.log("New Session", socket.remotePort);

		//From HAP Server
		var serviceSocket = new net.Socket();
		serviceSocket.connect(parseInt(hapPort), "127.0.0.1", function () {
	        console.log("Server Connection Established", serviceSocket.localPort);
	        this.localPort = serviceSocket.localPort;
	        this.registerCallback(socket.remotePort, serviceSocket.localPort);
	    }.bind(this));
	    serviceSocket.on("data", function (data) {
	    	if (this.isEncryptInUse) {
				var resultMsg = encryption.layer_encrypt(data,this.accessoryToControllerCount,this.accessoryToControllerKey);
	    		try {
					socket.write(resultMsg);
				} catch (ex) {
					console.log("An Error Occured when sending data from server,",ex);
				}
	    	} else {
	    		try {
					socket.write(data);
				} catch (ex) {
					console.log("An Error Occured when sending data from server,",ex);
				}
	    	}
		}.bind(this));
		serviceSocket.on("close", function() {
		  console.log('Server Disconnected');
		  this.tcpServer.removeSession(this.localPort);
		  try {
		  	socket.end();
		  } catch (ex) {
		  	console.log("An Error Occured when closing the socket",ex);
		  }
		  this.socket = undefined;
		}.bind(this));
		serviceSocket.on("error", function(err){
        	console.log("An Error Occured on HAP side connection,",err);
        	this.tcpServer.removeSession(this.localPort);
        	socket.destroy();
        	serviceSocket.destroy();
    	}.bind(this));

		//From iOS
	    socket.on('data', function (msg) {
	    	this.updateEncryptTrafficStatus();
	    	if (this.isEncryptInUse) {
	    		var resultMsg = encryption.layer_decrypt(msg,this.controllerToAccessoryCount,this.controllerToAccessoryKey);
	    		try {
					serviceSocket.write(resultMsg);
				} catch (ex) {
					console.log("An Error Occured when sending data from server,",ex);
				}
	    	} else {
	    		try {
					serviceSocket.write(msg);
				} catch (ex) {
					console.log("An Error Occured when sending data from server,",ex);
				}
	    	}
	    }.bind(this));
	    socket.on("close", function() {
		  console.log('Client Disconnected');
		  this.tcpServer.removeSession(this.localPort);
		  try {
		  	serviceSocket.end();
		  } catch (ex) {
		  	console.log("An Error Occured when closing socket to HAP Server,",ex);
		  }
		  this.socket = undefined;
		}.bind(this));
		socket.on("error", function(err){
        	console.log("An Error Occured on client side connection,",err);
        	this.tcpServer.removeSession(this.localPort);
        	socket.destroy();
        	serviceSocket.destroy();
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
		return new HAPSession(tcpServer, socket, persistStore, accessoryInfo, callback);
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