var storage = require('node-persist');
var util = require('util');
var crypto = require('crypto');
var ed25519 = require('ed25519');

'use strict';

module.exports = {
  AccessoryInfo: AccessoryInfo
};


/**
 * AccessoryInfo is a model class containing a subset of Accessory data relevant to the internal HAP server,
 * such as encryption keys and username. It is persisted to disk.
 */

function AccessoryInfo(username) {
  this.username = username;
  this.port = 0;
  this.displayName = "";
  this.category = "";
  this.pincode = "";
  this.signSk = Buffer(0);
  this.signPk = Buffer(0);
  this.pairedClients = {}; // pairedClients[clientUsername:string] = clientPublicKey:Buffer
  this.configVersion = 1;
  this.configHash = "";
}

// Add a paired client to our memory. 'publicKey' should be an instance of Buffer.
AccessoryInfo.prototype.addPairedClient = function(username, publicKey) {
  this.pairedClients[username] = publicKey;
}

// Add a paired client to our memory.
AccessoryInfo.prototype.removePairedClient = function(username) {
  delete this.pairedClients[username];
}

// Gets the public key for a paired client as a Buffer, or falsey value if not paired.
AccessoryInfo.prototype.getClientPublicKey = function(username) {
  return this.pairedClients[username];
}

// Returns a boolean indicating whether this accessory has been paired with a client.
AccessoryInfo.prototype.paired = function() {
  return Object.keys(this.pairedClients).length > 0; // if we have any paired clients, we're paired.
}

// Gets a key for storing this AccessoryInfo in the filesystem, like "AccessoryInfo.CC223DE3CEF3.json"
AccessoryInfo.persistKey = function(username) {
  return util.format("AccessoryInfo.%s.json", username.replace(/:/g,"").toUpperCase());
}

AccessoryInfo.create = function(username) {
  var accessoryInfo = new AccessoryInfo(username);
  
  // Create a new unique key pair for this accessory.
  var seed = crypto.randomBytes(32);
  var keyPair = ed25519.MakeKeypair(seed);
  
  accessoryInfo.signSk = keyPair.privateKey;
  accessoryInfo.signPk = keyPair.publicKey;
  
  return accessoryInfo;
}

AccessoryInfo.load = function(username) {
  var key = AccessoryInfo.persistKey(username);
  var saved = storage.getItem(key);
  
  if (saved) {
    var info = new AccessoryInfo(username);
    info.port = saved.port;
    info.displayName = saved.displayName || "";
    info.category = saved.category || "";
    info.pincode = saved.pincode || "";
    info.signSk = new Buffer(saved.signSk || '', 'hex');
    info.signPk = new Buffer(saved.signPk || '', 'hex');
    
    info.pairedClients = {};
    for (var username in saved.pairedClients || {}) {
      var publicKey = saved.pairedClients[username];
      info.pairedClients[username] = new Buffer(publicKey, 'hex');
    }
    
    info.configVersion = saved.configVersion || 1;
    info.configHash = saved.configHash || "";
    return info;
  }
  else {
    return null;
  }
}

AccessoryInfo.prototype.save = function() {
  var saved = {
    displayName: this.displayName,
    port: this.port,
    category: this.category,
    pincode: this.pincode,
    signSk: this.signSk.toString('hex'),
    signPk: this.signPk.toString('hex'),
    pairedClients: {},
    configVersion: this.configVersion,
    configHash: this.configHash
  };
  
  for (var username in this.pairedClients) {
    var publicKey = this.pairedClients[username];
    saved.pairedClients[username] = publicKey.toString('hex');
  }
  
  var key = AccessoryInfo.persistKey(this.username);
  
  storage.setItem(key, saved);
  storage.persistSync();
}
