import crypto from 'crypto';

import bonjour, { BonjourHap, MulticastOptions, Service } from 'bonjour-hap';

import { Nullable } from '../types';
import { AccessoryInfo } from './model/AccessoryInfo';

/**
 * Advertiser uses mdns to broadcast the presence of an Accessory to the local network.
 *
 * Note that as of iOS 9, an accessory can only pair with a single client. Instead of pairing your
 * accessories with multiple iOS devices in your home, Apple intends for you to use Home Sharing.
 * To support this requirement, we provide the ability to be "discoverable" or not (via a "service flag" on the
 * mdns payload).
 */
export class Advertiser {

  _bonjourService: BonjourHap;
  _advertisement: Nullable<Service>;
  _setupHash: string;

  constructor(public accessoryInfo: AccessoryInfo, mdnsConfig: MulticastOptions) {
    this._bonjourService = bonjour(mdnsConfig);
    this._advertisement = null;
    this._setupHash = this._computeSetupHash();
  }

  startAdvertising = (port: number) => {

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
      "ci": this.accessoryInfo.category as unknown as string,
      "sf": this.accessoryInfo.paired() ? "0" : "1", // "sf == 1" means "discoverable by HomeKit iOS clients"
      "sh": this._setupHash
    };

    /**
     * The host name of the component is probably better to be
     * the username of the hosted accessory + '.local'.
     * By default 'bonjour' doesnt add '.local' at the end of the os.hostname
     * this causes to return 'raspberrypi' on raspberry pi / raspbian
     * then when the phone queryies for A/AAAA record it is being queried
     * on normal dns, not on mdns. By Adding the username of the accessory
     * probably the problem will also fix a possible problem
     * of having multiple pi's on same network
     */
    var host = this.accessoryInfo.username.replace(/\:/ig, "_") + '.local';
    var advertiseName = this.accessoryInfo.displayName
      + "-"
      + crypto.createHash('sha512').update(this.accessoryInfo.username, 'utf8').digest('hex').slice(0, 4).toUpperCase();

    // create/recreate our advertisement
    this._advertisement = this._bonjourService.publish({
      name: advertiseName,
      type: "hap",
      port: port,
      txt: txtRecord,
      host: host
    });
  }

  isAdvertising = () => {
    return (this._advertisement != null);
  }

  updateAdvertisement = () => {
    if (this._advertisement) {

      var txtRecord = {
        md: this.accessoryInfo.displayName,
        pv: "1.0",
        id: this.accessoryInfo.username,
        "c#": this.accessoryInfo.configVersion + "", // "accessory conf" - represents the "configuration version" of an Accessory. Increasing this "version number" signals iOS devices to re-fetch /accessories data.
        "s#": "1", // "accessory state"
        "ff": "0",
        "ci": `${this.accessoryInfo.category}`,
        "sf": this.accessoryInfo.paired() ? "0" : "1", // "sf == 1" means "discoverable by HomeKit iOS clients"
        "sh": this._setupHash
      };

      this._advertisement.updateTxt(txtRecord);
    }
  }

  stopAdvertising = () => {
    if (this._advertisement) {
      this._advertisement.stop();
      this._advertisement.destroy();
      this._advertisement = null;
    }

    this._bonjourService.destroy();
  }

  _computeSetupHash = () => {
    var setupHashMaterial = this.accessoryInfo.setupID + this.accessoryInfo.username;
    var hash = crypto.createHash('sha512');
    hash.update(setupHashMaterial);
    var setupHash = hash.digest().slice(0, 4).toString('base64');

    return setupHash;
  }
}

