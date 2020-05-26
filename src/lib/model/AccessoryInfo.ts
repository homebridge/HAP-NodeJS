import util from 'util';
import assert from 'assert';
import tweetnacl from 'tweetnacl';

import { Categories } from '../Accessory';
import { Session } from "../util/eventedhttp";
import { MacAddress } from "../../types";
import { HAPStorage } from "./HAPStorage";

export const enum PermissionTypes {
  USER = 0x00,
  ADMIN = 0x01, // admins are the only ones who can add/remove/list pairings (also some characteristics are restricted)
}

export type PairingInformation = {
  username: string,
  publicKey: Buffer,
  permission: PermissionTypes,
}

/**
 * AccessoryInfo is a model class containing a subset of Accessory data relevant to the internal HAP server,
 * such as encryption keys and username. It is persisted to disk.
 */
export class AccessoryInfo {

  static readonly deviceIdPattern: RegExp = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  username: MacAddress;
  displayName: string;
  model: string; // this property is currently not saved to disk
  category: Categories;
  pincode: string;
  signSk: Buffer;
  signPk: Buffer;
  pairedClients: Record<string, PairingInformation>;
  pairedAdminClients: number;
  configVersion: number;
  configHash: string; // TODO range 1-65535 wrapping around to 1
  setupID: string;

  private constructor(username: MacAddress) {
    this.username = username;
    this.displayName = "";
    this.model = "";
    // @ts-ignore
    this.category = "";
    this.pincode = "";
    this.signSk = Buffer.alloc(0);
    this.signPk = Buffer.alloc(0);
    this.pairedClients = {};
    this.pairedAdminClients = 0;
    this.configVersion = 1;
    this.configHash = "";

    this.setupID = "";
  }

  /**
   * Add a paired client to memory.
   * @param {string} username
   * @param {Buffer} publicKey
   * @param {PermissionTypes} permission
   */
  addPairedClient = (username: string, publicKey: Buffer, permission: PermissionTypes) => {
    this.pairedClients[username] = {
      username: username,
      publicKey: publicKey,
      permission: permission
    };

    if (permission === PermissionTypes.ADMIN)
      this.pairedAdminClients++;
  };

  updatePermission = (username: string, permission: PermissionTypes) => {
    const pairingInformation = this.pairedClients[username];

    if (pairingInformation) {
      const oldPermission = pairingInformation.permission;
      pairingInformation.permission = permission;

      if (oldPermission === PermissionTypes.ADMIN && permission !== PermissionTypes.ADMIN) {
        this.pairedAdminClients--;
      } else if (oldPermission !== PermissionTypes.ADMIN && permission === PermissionTypes.ADMIN) {
        this.pairedAdminClients++;
      }
    }
  };

  listPairings = () => {
    const array = [] as PairingInformation[];

    for (const username in this.pairedClients) {
      const pairingInformation = this.pairedClients[username] as PairingInformation;
      array.push(pairingInformation);
    }

    return array;
  };

  /**
   * Remove a paired client from memory.
   * @param controller - the session of the controller initiated the removal of the pairing
   * @param {string} username
   */
  removePairedClient = (controller: Session, username: string) => {
    this._removePairedClient0(controller, username);

    if (this.pairedAdminClients === 0) { // if we don't have any admin clients left paired it is required to kill all normal clients
      for (const username0 in this.pairedClients) {
        this._removePairedClient0(controller, username0);
      }
    }
  };

  _removePairedClient0 = (controller: Session, username: string) => {
    if (this.pairedClients[username] && this.pairedClients[username].permission === PermissionTypes.ADMIN)
      this.pairedAdminClients--;
    delete this.pairedClients[username];

    Session.destroyExistingConnectionsAfterUnpair(controller, username);
  };

  /**
   * Check if username is paired
   * @param username
   */
  isPaired = (username: string) => {
    return !!this.pairedClients[username];
  };

  hasAdminPermissions = (username: string) => {
    if (!username) return false;
    const pairingInformation = this.pairedClients[username];
    return !!pairingInformation && pairingInformation.permission === PermissionTypes.ADMIN;
  };

  // Gets the public key for a paired client as a Buffer, or falsey value if not paired.
  getClientPublicKey = (username: string) => {
    const pairingInformation = this.pairedClients[username];
    if (pairingInformation) {
      return pairingInformation.publicKey;
    } else {
      return undefined;
    }
  };

  // Returns a boolean indicating whether this accessory has been paired with a client.
  paired = (): boolean => {
    return Object.keys(this.pairedClients).length > 0; // if we have any paired clients, we're paired.
  }

  save = () => {
    var saved = {
      displayName: this.displayName,
      category: this.category,
      pincode: this.pincode,
      signSk: this.signSk.toString('hex'),
      signPk: this.signPk.toString('hex'),
      pairedClients: {},
      // moving permissions into an extra object, so there is nothing to migrate from old files.
      // if the legacy node-persist storage should be upgraded some time, it would be reasonable to combine the storage
      // of public keys (pairedClients object) and permissions.
      pairedClientsPermission: {},
      configVersion: this.configVersion,
      configHash: this.configHash,
      setupID: this.setupID,
    };

    for (var username in this.pairedClients) {
      const pairingInformation = this.pairedClients[username];
      //@ts-ignore
      saved.pairedClients[username] = pairingInformation.publicKey.toString('hex');
      // @ts-ignore
      saved.pairedClientsPermission[username] = pairingInformation.permission;
    }

    var key = AccessoryInfo.persistKey(this.username);

    HAPStorage.storage().setItemSync(key, saved);
  }

// Gets a key for storing this AccessoryInfo in the filesystem, like "AccessoryInfo.CC223DE3CEF3.json"
  static persistKey = (username: MacAddress) => {
    return util.format("AccessoryInfo.%s.json", username.replace(/:/g, "").toUpperCase());
  }

  static create = (username: MacAddress) => {
    AccessoryInfo.assertValidUsername(username);
    var accessoryInfo = new AccessoryInfo(username);

    // Create a new unique key pair for this accessory.
    var keyPair = tweetnacl.sign.keyPair();

    accessoryInfo.signSk = Buffer.from(keyPair.secretKey);
    accessoryInfo.signPk = Buffer.from(keyPair.publicKey);

    return accessoryInfo;
  }

  static load = (username: MacAddress) => {
    AccessoryInfo.assertValidUsername(username);

    var key = AccessoryInfo.persistKey(username);
    var saved = HAPStorage.storage().getItem(key);

    if (saved) {
      var info = new AccessoryInfo(username);
      info.displayName = saved.displayName || "";
      info.category = saved.category || "";
      info.pincode = saved.pincode || "";
      info.signSk = Buffer.from(saved.signSk || '', 'hex');
      info.signPk = Buffer.from(saved.signPk || '', 'hex');

      info.pairedClients = {};
      for (var username in saved.pairedClients || {}) {
        var publicKey = saved.pairedClients[username];
        let permission = saved.pairedClientsPermission? saved.pairedClientsPermission[username]: undefined;
        if (permission === undefined)
          permission = PermissionTypes.ADMIN; // defaulting to admin permissions is the only suitable solution, there is no way to recover permissions

        info.pairedClients[username] = {
          username: username,
          publicKey: Buffer.from(publicKey, 'hex'),
          permission: permission
        };
        if (permission === PermissionTypes.ADMIN)
          info.pairedAdminClients++;
      }

      info.configVersion = saved.configVersion || 1;
      info.configHash = saved.configHash || "";

      info.setupID = saved.setupID || "";

      return info;
    }
    else {
      return null;
    }
  }

  static remove(username: MacAddress) {
    const key = AccessoryInfo.persistKey(username);
    HAPStorage.storage().removeItemSync(key);
  }

  static assertValidUsername = (username: MacAddress) => {
    assert.ok(AccessoryInfo.deviceIdPattern.test(username),
        "The supplied username (" + username + ") is not valid " +
        "(expected a format like 'XX:XX:XX:XX:XX:XX' with XX being a valid hexadecimal string). " +
        "Note that, if you had this accessory already paired with the invalid username, you will need to repair " +
        "the accessory and reconfigure your services in the Home app. " +
        "Using an invalid username will lead to unexpected behaviour.")
  };

}

