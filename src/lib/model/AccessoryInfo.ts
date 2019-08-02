import storage from 'node-persist';
import util from 'util';
import tweetnacl from 'tweetnacl';
import bufferShim from 'buffer-shims';

import { Categories } from '../Accessory';

/**
 * AccessoryInfo is a model class containing a subset of Accessory data relevant to the internal HAP server,
 * such as encryption keys and username. It is persisted to disk.
 */
export class AccessoryInfo {
  username: string;
  displayName: string;
  category: Categories;
  pincode: string;
  signSk: any;
  signPk: any;
  pairedClients: Record<string, Buffer>;
  configVersion: number;
  configHash: string;
  setupID: string;
  relayEnabled: boolean;
  relayState: number;
  relayAccessoryID: string;
  relayAdminID: string;
  relayPairedControllers: Record<string, string>;
  accessoryBagURL: string;

  constructor(username: string) {
    this.username = username;
    this.displayName = "";
    // @ts-ignore
    this.category = "";
    this.pincode = "";
    this.signSk = bufferShim.alloc(0);
    this.signPk = bufferShim.alloc(0);
    this.pairedClients = {}; // pairedClients[clientUsername:string] = clientPublicKey:Buffer
    this.configVersion = 1;
    this.configHash = "";

    this.setupID = "";

    this.relayEnabled = false;
    this.relayState = 2;
    this.relayAccessoryID = "";
    this.relayAdminID = "";
    this.relayPairedControllers = {};
    this.accessoryBagURL = "";
  }

  /**
   * Add a paired client to memory.
   * @param {string} username
   * @param {Buffer} publicKey
   */
  addPairedClient = (username: string, publicKey: Buffer) => {
    this.pairedClients[username] = publicKey;
  }

  /**
   * Remove a paired client from memory.
   * @param {string} username
   */
  removePairedClient = (username: string) => {
    delete this.pairedClients[username];

    if (Object.keys(this.pairedClients).length == 0) {
      this.relayEnabled = false;
      this.relayState = 2;
      this.relayAccessoryID = "";
      this.relayAdminID = "";
      this.relayPairedControllers = {};
      this.accessoryBagURL = "";
    }
  }

// Gets the public key for a paired client as a Buffer, or falsey value if not paired.
  getClientPublicKey = (username: string) => {
    return this.pairedClients[username];
  }

// Returns a boolean indicating whether this accessory has been paired with a client.
  paired = (): boolean => {
    return Object.keys(this.pairedClients).length > 0; // if we have any paired clients, we're paired.
  }

  updateRelayEnableState = (state: boolean) => {
    this.relayEnabled = state;
  }

  updateRelayState = (newState: number) => {
    this.relayState = newState;
  }

  addPairedRelayClient = (username: string, accessToken: string) => {
    this.relayPairedControllers[username] = accessToken;
  }

  removePairedRelayClient = (username: string) => {
    delete this.relayPairedControllers[username];
  }

  save = () => {
    var saved = {
      displayName: this.displayName,
      category: this.category,
      pincode: this.pincode,
      signSk: this.signSk.toString('hex'),
      signPk: this.signPk.toString('hex'),
      pairedClients: {},
      configVersion: this.configVersion,
      configHash: this.configHash,
      setupID: this.setupID,
      relayEnabled: this.relayEnabled,
      relayState: this.relayState,
      relayAccessoryID: this.relayAccessoryID,
      relayAdminID: this.relayAdminID,
      relayPairedControllers: this.relayPairedControllers,
      accessoryBagURL: this.accessoryBagURL
    };

    for (var username in this.pairedClients) {
      var publicKey = this.pairedClients[username];
      //@ts-ignore
      saved.pairedClients[username] = publicKey.toString('hex');
    }

    var key = AccessoryInfo.persistKey(this.username);

    storage.setItemSync(key, saved);
    storage.persistSync();
  }

  remove = () => {
    var key = AccessoryInfo.persistKey(this.username);

    storage.removeItemSync(key);
  }

// Gets a key for storing this AccessoryInfo in the filesystem, like "AccessoryInfo.CC223DE3CEF3.json"
  static persistKey = (username: string) => {
    return util.format("AccessoryInfo.%s.json", username.replace(/:/g, "").toUpperCase());
  }

  static create = (username: string) => {
    var accessoryInfo = new AccessoryInfo(username);

    // Create a new unique key pair for this accessory.
    var keyPair = tweetnacl.sign.keyPair();

    accessoryInfo.signSk = bufferShim.from(keyPair.secretKey);
    accessoryInfo.signPk = bufferShim.from(keyPair.publicKey);

    return accessoryInfo;
  }

  static load = (username: string) => {
    var key = AccessoryInfo.persistKey(username);
    var saved = storage.getItem(key);

    if (saved) {
      var info = new AccessoryInfo(username);
      info.displayName = saved.displayName || "";
      info.category = saved.category || "";
      info.pincode = saved.pincode || "";
      info.signSk = bufferShim.from(saved.signSk || '', 'hex');
      info.signPk = bufferShim.from(saved.signPk || '', 'hex');

      info.pairedClients = {};
      for (var username in saved.pairedClients || {}) {
        var publicKey = saved.pairedClients[username];
        info.pairedClients[username] = bufferShim.from(publicKey, 'hex');
      }

      info.configVersion = saved.configVersion || 1;
      info.configHash = saved.configHash || "";

      info.setupID = saved.setupID || "";

      info.relayEnabled = saved.relayEnabled || false;
      info.relayState = saved.relayState || 2;
      info.relayAccessoryID = saved.relayAccessoryID || "";
      info.relayAdminID = saved.relayAdminID || "";
      info.relayPairedControllers = saved.relayPairedControllers || {};
      info.accessoryBagURL = saved.accessoryBagURL || "";

      return info;
    }
    else {
      return null;
    }
  }
}

