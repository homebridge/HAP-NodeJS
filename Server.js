var http = require("http");
var crypto = require("crypto");
var srp = require("srp");
var hkdf = require("./hkdf.js");
var url = require("url");
var ed25519 = require("ed25519");
var tlvHandler = require("./TLV-Handler.js");
var encryption = require("./Encryption.js");

function HAPServer(accessoryInfo, callback, persistStore, accessoryController, accessory) {
	if (!(this instanceof HAPServer))  {
		return new HAPServer(accessoryInfo, callback, persistStore, accessoryController, accessory);
	}
	this.server_sign_keyPair = accessoryInfo.keyPair;
	this.accessoryInfo = accessoryInfo;
	this.persistStore = persistStore;
	this.hapServer = this.createHAPServer();
	this.accessoryController = accessoryController;
	this.accessory = accessory;
	this.callback = callback;
}

HAPServer.prototype = {
	startHAPServer: function startHAPServer(targetPort) {
		if (this.hapServer !== undefined) {
			this.hapServer.listen(targetPort);
			console.log("HAP Server is listening");
		}
	},
	createHAPServer: function createHAPServer() {
		var server = http.createServer(
			function(request, response) {
				var that = this;
				that.currentSessionPort = request.socket.remotePort;
				switch(request.url) {
					case "/pair-setup":
						request.on('data', function(chunk) {
					      var objects = tlvHandler.decodeTLV(chunk);
					      that.processPairSequence(objects, response);
					    });
					    break;
					case "/pair-verify":
						request.on('data', function(chunk) {
					      var objects = tlvHandler.decodeTLV(chunk);
					      that.processVerifySequence(objects, response, request);
					    });
						break;
					case "/accessories":
						that.responseAccessories(response);
						break;
					case "/characteristics":
						request.on('data', function(chunk) {
					      that.responseCharacteristic(request, response, chunk);
					    });
						break;
					case "/pairings":
						request.on('data', function(chunk) {
					      var objects = tlvHandler.decodeTLV(chunk);
					      that.processPairings(objects, response);
					    });
						break;
					case "/identify":
						console.log("Identify!");
						response.writeHead(204);
						response.end();
						break;
					default:
						if (strStartsWith(request.url, "/characteristics")) {
							that.responseCharacteristic(request, response);
						} else {
							console.log("Not implemented:",request.url);
							response.writeHead(404, "Not found", {'Content-Type': 'text/html'});
							response.end();
						}
				};
			}.bind(this)
		);
		server.timeout = 0;
		return server;
	},
	//Pairings
	processPairings: function processPairings(objects, response) {
		var requestType = objects[0][0];
		if (requestType == 3) {
			//Handle Add
			console.log("Handle Add Pairing Info");
			var clientUsername = objects[1];
			var clientLTPK = objects[3];
			this.persistStore.setItem(this.accessoryInfo.username + clientUsername.toString(),clientLTPK.toString("hex"));
		} else if (requestType == 4) {
			//Handle Remove
			console.log("Handle Remove Pairing Info");
			var clientUsername = objects[1];
			this.persistStore.removeItem(this.accessoryInfo.username + clientUsername.toString());
		}
		this.persistStore.persistSync();
		response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
		response.write(Buffer([0x06,0x01,0x02]));
		response.end();
	},
	//Characteristics
	responseCharacteristic: function responseCharacteristic(request, response, data) {
		if (request.method == "GET") {
			response.writeHead(200, {"Content-Type": "application/hap+json"});
			var requestDetails = url.parse(request.url);
			var iids = requestDetails.query.substring(3).split(".");
			var accessoryId = parseInt(iids[0]);
			var characteristicId = parseInt(iids[1]);
			response.write(this.accessoryController.jsonForCharacteristicUpdate(accessoryId,characteristicId));
			response.end();
		} else if (request.method == "PUT") {
			response.writeHead(204, {"Content-Type": "application/hap+json"});
			this.accessoryController.processCharacteristicsValueWrite(data, request.socket.remotePort);
			response.end();
		}
	},
	//Accessories
	responseAccessories: function responseAccessories(response) {
		response.writeHead(200, {"Content-Type": "application/hap+json"});
		response.write(this.accessoryController.jsonPresentation());
		response.end();
	},
	//Pair-Verify
	processVerifySequence: function processVerifySequence(objects, response, request) {
		if (objects[6]) {
			var currentSeq = objects[6][0];
			switch(currentSeq) {
				case 1:
					this.processVerifyStepOne(objects, response);
					break;
				case 3:
					this.processVerifyStepTwo(objects, response, request);
					break;
				default:
					response.writeHead(501, "Not Implemented", {'Content-Type': 'text/html'});
					response.end();
					console.log("Unsupport");
			}
		}
	},
	processVerifyStepOne: function processVerifyStepOne(objects, response) {
		console.log("Start Verify M1");
		response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});

		var clientPublicKey = objects[3];
		this.tcpServer.retrieveSession(this.currentSessionPort).session_clientPublicKey = clientPublicKey;
		var secretKey = encryption.generateCurve25519SecretKey();
		var publicKey = encryption.generateCurve25519PublicKeyFromSecretKey(secretKey);
		var sharedSec = encryption.generateCurve25519SharedSecKey(secretKey, clientPublicKey);

		this.tcpServer.retrieveSession(this.currentSessionPort).session_server_privateKey = secretKey;
		this.tcpServer.retrieveSession(this.currentSessionPort).session_server_publicKey = publicKey;
		this.tcpServer.retrieveSession(this.currentSessionPort).session_server_sharedKey = sharedSec;

		var usernameData = Buffer(this.accessoryInfo.username);

		var material = Buffer.concat([publicKey,usernameData,clientPublicKey]);

		var privateKey = Buffer(this.server_sign_keyPair.signSk);

		var serverProof = ed25519.Sign(material, privateKey);

		var enc_salt = new Buffer("Pair-Verify-Encrypt-Salt");
		var enc_info = new Buffer("Pair-Verify-Encrypt-Info");

		var output_key = hkdf.HKDF("sha512",enc_salt,sharedSec,enc_info,32);
		output_key = output_key.slice(0,32);
		this.tcpServer.retrieveSession(this.currentSessionPort).hkdf_pair_enc_key = output_key;
		var message = Buffer.concat([tlvHandler.encodeTLV(0x01,usernameData),tlvHandler.encodeTLV(0x0a,serverProof)]);
		var ciphertextBuffer = Buffer(Array(message.length));
		var macBuffer = Buffer(Array(16));
		encryption.encryptAndSeal(output_key,Buffer("PV-Msg02"),message,null,ciphertextBuffer,macBuffer);

		var encDataResp = tlvHandler.encodeTLV(0x05,Buffer.concat([ciphertextBuffer,macBuffer]));
		var pubKeyResp = tlvHandler.encodeTLV(0x03,publicKey);

		response.write(Buffer([0x06,0x01,0x02]));
		response.write(encDataResp);
		response.write(pubKeyResp);
		response.end();
		console.log("Verify M1 Finished");
	},
	processVerifyStepTwo: function processVerifyStepTwo(objects, response, request) {
		console.log("Start Verify M3");
		response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});

		var messageData = Buffer(objects[5].length - 16);
		var authTagData = Buffer(16);
		objects[5].copy(messageData,0,0,objects[5].length - 16);
		objects[5].copy(authTagData,0,objects[5].length - 16,objects[5].length);

		var plaintextBuffer = Buffer(messageData.length);
		if (encryption.verifyAndDecrypt(this.tcpServer.retrieveSession(this.currentSessionPort).hkdf_pair_enc_key,Buffer("PV-Msg03"),messageData,authTagData,null,plaintextBuffer)) {
			var tlvData = tlvHandler.decodeTLV(plaintextBuffer);
			var clientUsername = tlvData[0x01];
			var proof = tlvData[0x0a];

			var material = Buffer.concat([this.tcpServer.retrieveSession(this.currentSessionPort).session_clientPublicKey,clientUsername,this.tcpServer.retrieveSession(this.currentSessionPort).session_server_publicKey]);

			var keyContext = this.persistStore.getItem(this.accessoryInfo.username + clientUsername.toString());

			if (keyContext) {
				var clientLTPK = Buffer(keyContext,"hex");
				if (ed25519.Verify(material, proof, clientLTPK)) {
					response.write(Buffer([0x06,0x01,0x04]));
					response.end();
					console.log("M3: Verify Success");
					this.callback(request.socket.remotePort, this.tcpServer.retrieveSession(this.currentSessionPort).session_server_sharedKey);
				} else {
					console.log("M3: Invalid Signature");
					response.write(Buffer([0x07,0x01,0x04]));
					response.end();
				}
			} else {
				console.log("M3: Cannot find Client LTPK");
				response.write(Buffer([0x07,0x01,0x02]));
				response.end();
			}
			
		} else {
			console.log("M3: Invalid Signature");
			response.write(Buffer([0x07,0x01,0x02]));
			response.end();
		}
	},
	processPairSequence: function processPairSequence(objects, response) {
		if (objects[6]) {
			var currentSeq = objects[6][0];
			switch(currentSeq) {
				case 1:
					this.processPairStepOne(response);
					break;
				case 3:
					this.processPairStepTwo(objects,response);
					break;
				case 5:
					this.processPairStepThree(objects,response);
					break;
				default:
					response.writeHead(501, "Not Implemented", {'Content-Type': 'text/html'});
					console.log("Unsupport");
			}
		}
	},
	//Pair-Setup
	//M1 + M2
	processPairStepOne: function processPairStepOne(response) {
		console.log("Start Pair M1");
		response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});
		var salt = crypto.randomBytes(16);
		var srp_params = srp.params["3072"];

		srp.genKey(32,function (error, key) {
			this.srpServer = new srp.Server(srp_params, Buffer(salt), Buffer("Pair-Setup"), Buffer(this.accessoryInfo.pincode), key);
			var srpB = this.srpServer.computeB();

			var respData_pub = tlvHandler.encodeTLV(0x03,srpB);
			var respSaltData = tlvHandler.encodeTLV(0x02,salt);
			response.write(Buffer([0x06,0x01,0x02]));
			response.write(respSaltData);
			response.write(respData_pub);
			response.end();
		}.bind(this));
	},
	//M3 + M4
	processPairStepTwo: function processPairStepTwo(objects, response) {
		console.log("Start Pair M3");
		response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});

		var A = objects[3];
		var M1 = objects[4];

		this.srpServer.setA(A);
		this.srpServer.checkM1(M1);

		var M2 = this.srpServer.computeM2();
		var respData_M2 = tlvHandler.encodeTLV(0x04,M2);
		response.write(Buffer([0x06,0x01,0x04]));
		response.write(respData_M2);
		response.end();
	},
	//M5-1
	processPairStepThree: function processPairStepThree(objects, response) {
		console.log("Start Pair M5");
		response.writeHead(200, {"Content-Type": "application/pairing+tlv8"});

		var messageData = Buffer(objects[5].length - 16);
		var authTagData = Buffer(16);
		objects[5].copy(messageData,0,0,objects[5].length - 16);
		objects[5].copy(authTagData,0,objects[5].length - 16,objects[5].length);

		var S_private = this.srpServer.computeK();
		var enc_salt = new Buffer("Pair-Setup-Encrypt-Salt");
		var enc_info = new Buffer("Pair-Setup-Encrypt-Info");

		var output_key = hkdf.HKDF("sha512",enc_salt,S_private, enc_info,32);
		this.hkdf_enc_key = output_key;

		var plaintextBuffer = Buffer(messageData.length);
		encryption.verifyAndDecrypt(output_key,Buffer("PS-Msg05"),messageData,authTagData,null,plaintextBuffer);
		var M5_Packet = tlvHandler.decodeTLV(plaintextBuffer);
		var clientUsername = M5_Packet[1];
		var clientLTPK = M5_Packet[3];
		var clientProof = M5_Packet[10];
		this.processPairStepFour(clientUsername,clientLTPK,clientProof,response);
	},
	//M5-2
	processPairStepFour: function processPairStepFour(clientUsername,clientLTPK,clientProof,response) {
		this.session_client_LTPK = clientLTPK;

		this.persistStore.setItem(this.accessoryInfo.username + clientUsername.toString(),clientLTPK.toString("hex"));
		this.accessoryInfo.keyPair.paired = true;
		this.persistStore.setItem(this.accessoryInfo.username, this.accessoryInfo.keyPair);
		this.persistStore.persistSync();
		
		this.accessory._private.advertiser.stopAdvertising();
		this.accessory._private.advertiser.startAdvertising("0");

		var S_private = this.srpServer.computeK();
		var controller_salt = new Buffer("Pair-Setup-Controller-Sign-Salt");
		var controller_info = new Buffer("Pair-Setup-Controller-Sign-Info");
		var output_key = hkdf.HKDF("sha512",controller_salt,S_private,controller_info,32);
		
		var completeData = Buffer.concat([output_key,clientUsername,clientLTPK]);
		
		if (ed25519.Verify(completeData, clientProof, clientLTPK)) {
			this.processPairStepFive(response);
		} else {
			console.log("Invalid Signature");
			response.write(Buffer([0x06,0x01,0x06]));
			response.write(Buffer([0x07,0x01,0x02]));
			response.end();
		}
	},
	//M5 - F + M6
	processPairStepFive: function processPairStepFive(response) {
		var S_private = this.srpServer.computeK();
		var accessory_salt = new Buffer("Pair-Setup-Accessory-Sign-Salt");
		var accessory_info = new Buffer("Pair-Setup-Accessory-Sign-Info");
		var output_key = hkdf.HKDF("sha512",accessory_salt,S_private,accessory_info,32);

		var serverLTPK = this.server_sign_keyPair.signPk;
		var serverLTPK_buffer = Buffer(serverLTPK);
		var usernameData = Buffer(this.accessoryInfo.username);

		var material = Buffer.concat([output_key,usernameData,serverLTPK_buffer]);
		var privateKey = Buffer(this.server_sign_keyPair.signSk);

		var serverProof = ed25519.Sign(material, privateKey);

		var message = Buffer.concat([tlvHandler.encodeTLV(0x01,usernameData),tlvHandler.encodeTLV(0x03,serverLTPK_buffer),tlvHandler.encodeTLV(0x0a,serverProof)]);
		var ciphertextBuffer = Buffer(Array(message.length));
		var macBuffer = Buffer(Array(16));
		encryption.encryptAndSeal(this.hkdf_enc_key,Buffer("PS-Msg06"),message,null,ciphertextBuffer,macBuffer);

		response.write(Buffer([0x06,0x01,0x06]));
		response.write(tlvHandler.encodeTLV(0x05,Buffer.concat([ciphertextBuffer,macBuffer])));
		response.end();
	}
}

function strStartsWith(str, prefix) {
    return str.indexOf(prefix) === 0;
}

function toArrayBuffer(buffer) {
    var view = new Uint8Array(buffer.length);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return view;
}

module.exports = {
	HAPServer: HAPServer
};