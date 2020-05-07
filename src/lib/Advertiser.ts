import crypto from 'crypto';
import { AccessoryInfo } from './model/AccessoryInfo';
import { CiaoService, createResponder, Responder, ServiceType } from "@homebridge/ciao";

/**
 * Advertiser uses mdns to broadcast the presence of an Accessory to the local network.
 *
 * Note that as of iOS 9, an accessory can only pair with a single client. Instead of pairing your
 * accessories with multiple iOS devices in your home, Apple intends for you to use Home Sharing.
 * To support this requirement, we provide the ability to be "discoverable" or not (via a "service flag" on the
 * mdns payload).
 */
export class Advertiser {

  static protocolVersion: string = "1.1";
  static protocolVersionService: string = "1.1.0";

  private readonly responder: Responder;
  private advertisedService?: CiaoService;

  _setupHash: string;

  constructor(public accessoryInfo: AccessoryInfo, mdnsConfig: any) { // TODO adjust the options
    this.responder = createResponder(mdnsConfig);
    this._setupHash = this._computeSetupHash();
  }

  startAdvertising = (port: number) => {
    // stop advertising if necessary
    if (this.advertisedService) {
      this.stopAdvertising();
    }

    var txtRecord = {
      md: this.accessoryInfo.displayName,
      pv: Advertiser.protocolVersion,
      id: this.accessoryInfo.username,
      "c#": this.accessoryInfo.configVersion + "", // "accessory conf" - represents the "configuration version" of an Accessory. Increasing this "version number" signals iOS devices to re-fetch /accessories data.
      "s#": "1", // "accessory state"
      "ff": "0",
      "ci": this.accessoryInfo.category as unknown as string,
      "sf": this.accessoryInfo.paired() ? "0" : "1", // "sf == 1" means "discoverable by HomeKit iOS clients"
      "sh": this._setupHash // TODO setup hash is not exposed after accessory was paired
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
      + " "
      + crypto.createHash('sha512').update(this.accessoryInfo.username, 'utf8').digest('hex').slice(0, 4).toUpperCase();

    this.advertisedService = this.responder.createService({
      name: this.accessoryInfo.displayName,
      type: ServiceType.HAP,
      port: port,
      txt: txtRecord,
      // host will default now to AccessoryName.local
    });
    this.advertisedService.advertise(); // TODO listen for returned promise?
  }

  isAdvertising = () => {
    return !!this.advertisedService;
  }

  updateAdvertisement = () => {
    if (this.advertisedService) {

      var txtRecord = {
        md: this.accessoryInfo.displayName,
        pv: Advertiser.protocolVersion,
        id: this.accessoryInfo.username,
        "c#": this.accessoryInfo.configVersion + "", // "accessory conf" - represents the "configuration version" of an Accessory. Increasing this "version number" signals iOS devices to re-fetch /accessories data.
        "s#": "1", // "accessory state"
        "ff": "0",
        "ci": `${this.accessoryInfo.category}`,
        "sf": this.accessoryInfo.paired() ? "0" : "1", // "sf == 1" means "discoverable by HomeKit iOS clients"
        "sh": this._setupHash
      };

      this.advertisedService.updateTxt(txtRecord);
    }
  }

  stopAdvertising = () => {
    if (this.advertisedService) {
      this.advertisedService.end();
      this.advertisedService = undefined;
    }

    // TODO this._bonjourService.destroy();
  }

  _computeSetupHash = () => {
    var setupHashMaterial = this.accessoryInfo.setupID + this.accessoryInfo.username;
    var hash = crypto.createHash('sha512');
    hash.update(setupHashMaterial);
    var setupHash = hash.digest().slice(0, 4).toString('base64');

    return setupHash;
  }
}

