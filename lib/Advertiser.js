'use strict';

var mdns = require('mdns');

module.exports = {
  Advertiser: Advertiser
};


/**
 * Advertiser uses mdns to broadcast the presence of an Accessory to the local network.
 *
 * Note that as of iOS 9, an accessory can only pair with a single client. Instead of pairing your
 * accessories with multiple iOS devices in your home, Apple intends for you to use Home Sharing.
 * To support this requirement, we provide the ability to be "discoverable" or not (via a "service flag" on the
 * mdns payload).
 */

function Advertiser(accessoryInfo) {
  this.accessoryInfo = accessoryInfo;
  this._advertisement = null;
}

Advertiser.prototype.startAdvertising = function(port) {

  // stop advertising if necessary
  if (this._advertisement) {
    this.stopAdvertising();
  }

  var txtRecord = {
    md: this.accessoryInfo.displayName,
    pv: "1.0",
    id: this.accessoryInfo.username,
    "c#": this.accessoryInfo.configVersion + "", // "accessory conf" - represents the "configuration version" of an Accessory. Increasing this "version number" signals iOS devices to re-fetch /accessories data.
    "s#": "1", // "accessory state"
    "ff": "0",
    "ci": this.accessoryInfo.category,
    "sf": this.accessoryInfo.paired() ? "0" : "1" // "sf == 1" means "discoverable by HomeKit iOS clients"
  };

  // create/recreate our advertisement
  this._advertisement = mdns.createAdvertisement(mdns.tcp('hap'), port, {
    name: this.accessoryInfo.displayName,
    txtRecord: txtRecord
  });
  this._advertisement.start();
}

Advertiser.prototype.isAdvertising = function() {
  return (this._advertisement != null);
}

Advertiser.prototype.updateAdvertisement = function() {
  if (this._advertisement) {

    var txtRecord = {
      md: this.accessoryInfo.displayName,
      pv: "1.0",
      id: this.accessoryInfo.username,
      "c#": this.accessoryInfo.configVersion + "", // "accessory conf" - represents the "configuration version" of an Accessory. Increasing this "version number" signals iOS devices to re-fetch /accessories data.
      "s#": "1", // "accessory state"
      "ff": "0",
      "ci": this.accessoryInfo.category,
      "sf": this.accessoryInfo.paired() ? "0" : "1" // "sf == 1" means "discoverable by HomeKit iOS clients"
    };

    this._advertisement.updateTXTRecord(txtRecord);
  }
}

Advertiser.prototype.stopAdvertising = function() {
  if (this._advertisement) {
    this._advertisement.stop();
    this._advertisement = null;
  }
}
