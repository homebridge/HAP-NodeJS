// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../@types/bonjour-hap.d.ts" />
import ciao, { CiaoService, MDNSServerOptions, Responder, ServiceEvent, ServiceTxt, ServiceType } from "@homebridge/ciao";
import { InterfaceName, IPAddress } from "@homebridge/ciao/lib/NetworkManager";
import dbus, { DBusInterface, InvokeError, MessageBus } from "@homebridge/dbus-native";
import assert from "assert";
import bonjour, { BonjourHAP, BonjourHAPService, MulticastOptions } from "bonjour-hap";
import crypto from "crypto";
import createDebug from "debug";
import { EventEmitter } from "events";
import { AccessoryInfo } from "./model/AccessoryInfo";
import { PromiseTimeout } from "./util/promise-utils";

const debug = createDebug("HAP-NodeJS:Advertiser");

/**
 * This enum lists all bitmasks for all known status flags.
 * When the bit for the given bitmask is set, it represents the state described by the name.
 */
export const enum StatusFlag {
  NOT_PAIRED = 0x01,
  NOT_JOINED_WIFI = 0x02,
  PROBLEM_DETECTED = 0x04,
}

/**
 * This enum lists all bitmasks for all known pairing feature flags.
 * When the bit for the given bitmask is set, it represents the state described by the name.
 */
export const enum PairingFeatureFlag {
  SUPPORTS_HARDWARE_AUTHENTICATION = 0x01,
  SUPPORTS_SOFTWARE_AUTHENTICATION = 0x02,
}

export const enum AdvertiserEvent {
  /**
   * Emitted if the underlying mDNS advertisers signals, that the service name
   * was automatically changed due to some naming conflicts on the network.
   */
  UPDATED_NAME = "updated-name",
}

export declare interface Advertiser {
  on(event: "updated-name", listener: (name: string) => void): this;

  emit(event: "updated-name", name: string): boolean;
}

export interface ServiceNetworkOptions {
  /**
   * If defined it restricts the service to be advertised on the specified
   * ip addresses or interface names.
   *
   * If an interface name is specified, ANY address on that given interface will be advertised
   * (if an IP address of the given interface is also given in the array, it will be overridden).
   * If an IP address is specified, the service will only be advertised for the given addresses.
   *
   * Interface names and addresses can be mixed in the array.
   * If an ip address is given, the ip address must be valid at the time of service creation.
   *
   * If the service is set to advertise on a given interface, though the MDNSServer is
   * configured to ignore this interface, the service won't be advertised on the interface.
   */
  restrictedAddresses?: (InterfaceName | IPAddress)[];
  /**
   * The service won't advertise ipv6 address records.
   * This can be used to simulate binding on 0.0.0.0.
   * May be combined with {@link restrictedAddresses}.
   */
  disabledIpv6?: boolean;
}

/**
 * A generic Advertiser interface required for any MDNS Advertiser backend implementations.
 *
 * All implementations have to extend NodeJS' {@link EventEmitter} and emit the events defined in {@link AdvertiserEvent}.
 */
export interface Advertiser {
  initPort(port: number): void;

  startAdvertising(): Promise<void>;

  updateAdvertisement(silent?: boolean): void;

  destroy(): void;
}

/**
 * Advertiser uses mdns to broadcast the presence of an Accessory to the local network.
 *
 * Note that as of iOS 9, an accessory can only pair with a single client. Instead of pairing your
 * accessories with multiple iOS devices in your home, Apple intends for you to use Home Sharing.
 * To support this requirement, we provide the ability to be "discoverable" or not (via a "service flag" on the
 * mdns payload).
 */
export class CiaoAdvertiser extends EventEmitter implements Advertiser {
  static protocolVersion = "1.1";
  static protocolVersionService = "1.1.0";

  private readonly accessoryInfo: AccessoryInfo;
  private readonly setupHash: string;

  private readonly responder: Responder;
  private readonly advertisedService: CiaoService;

  constructor(accessoryInfo: AccessoryInfo, responderOptions?: MDNSServerOptions, serviceOptions?: ServiceNetworkOptions) {
    super();
    this.accessoryInfo = accessoryInfo;
    this.setupHash = CiaoAdvertiser.computeSetupHash(accessoryInfo);

    this.responder = ciao.getResponder({
      ...responderOptions,
    });
    this.advertisedService = this.responder.createService({
      name: this.accessoryInfo.displayName,
      type: ServiceType.HAP,
      txt: CiaoAdvertiser.createTxt(accessoryInfo, this.setupHash),
      // host will default now to <displayName>.local, spaces replaced with dashes
      ...serviceOptions,
    });
    this.advertisedService.on(ServiceEvent.NAME_CHANGED, this.emit.bind(this, AdvertiserEvent.UPDATED_NAME));

    debug(`Preparing Advertiser for '${this.accessoryInfo.displayName}' using ciao backend!`);
  }

  public initPort(port: number): void {
    this.advertisedService.updatePort(port);
  }

  public startAdvertising(): Promise<void> {
    debug(`Starting to advertise '${this.accessoryInfo.displayName}' using ciao backend!`);
    return this.advertisedService!.advertise();
  }

  public updateAdvertisement(silent?: boolean): void {
    const txt = CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash);
    debug("Updating txt record (txt: %o, silent: %d)", txt, silent);
    this.advertisedService!.updateTxt(txt, silent);
  }

  public async destroy(): Promise<void> {
    // advertisedService.destroy(); is called implicitly via the shutdown call
    await this.responder.shutdown();
    this.removeAllListeners();
  }

  static createTxt(accessoryInfo: AccessoryInfo, setupHash: string): ServiceTxt {
    const statusFlags: StatusFlag[] = [];

    if (!accessoryInfo.paired()) {
      statusFlags.push(StatusFlag.NOT_PAIRED);
    }

    return {
      "c#": accessoryInfo.getConfigVersion(), // current configuration number
      ff: CiaoAdvertiser.ff(), // pairing feature flags
      id: accessoryInfo.username, // device id
      md: accessoryInfo.model, // model name
      pv: CiaoAdvertiser.protocolVersion, // protocol version
      "s#": 1, // current state number (must be 1)
      sf: CiaoAdvertiser.sf(...statusFlags), // status flags
      ci: accessoryInfo.category,
      sh: setupHash,
    };
  }

  static computeSetupHash(accessoryInfo: AccessoryInfo): string {
    const hash = crypto.createHash("sha512");
    hash.update(accessoryInfo.setupID + accessoryInfo.username.toUpperCase());
    return hash.digest().slice(0, 4).toString("base64");
  }

  public static ff(...flags: PairingFeatureFlag[]): number {
    let value = 0;
    flags.forEach(flag => value |= flag);
    return value;
  }

  public static sf(...flags: StatusFlag[]): number {
    let value = 0;
    flags.forEach(flag => value |= flag);
    return value;
  }
}

/**
 * Advertiser base on the legacy "bonjour-hap" library.
 */
export class BonjourHAPAdvertiser extends EventEmitter implements Advertiser {
  private readonly accessoryInfo: AccessoryInfo;
  private readonly setupHash: string;
  private readonly serviceOptions?: ServiceNetworkOptions;

  private bonjour: BonjourHAP;
  private advertisement?: BonjourHAPService;

  private port?: number;
  private destroyed = false;

  constructor(accessoryInfo: AccessoryInfo, responderOptions?: MulticastOptions, serviceOptions?: ServiceNetworkOptions) {
    super();
    this.accessoryInfo = accessoryInfo;
    this.setupHash = CiaoAdvertiser.computeSetupHash(accessoryInfo);
    this.serviceOptions = serviceOptions;

    this.bonjour = bonjour(responderOptions);
    debug(`Preparing Advertiser for '${this.accessoryInfo.displayName}' using bonjour-hap backend!`);
  }

  public initPort(port: number): void {
    this.port = port;
  }

  public startAdvertising(): Promise<void> {
    assert(!this.destroyed, "Can't advertise on a destroyed bonjour instance!");
    if (this.port == null) {
      throw new Error("Tried starting bonjour-hap advertisement without initializing port!");
    }

    debug(`Starting to advertise '${this.accessoryInfo.displayName}' using bonjour-hap backend!`);

    if (this.advertisement) {
      this.destroy();
    }

    const hostname = this.accessoryInfo.username.replace(/:/ig, "_") + ".local";

    this.advertisement = this.bonjour.publish({
      name: this.accessoryInfo.displayName,
      type: "hap",
      port: this.port,
      txt: CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash),
      host: hostname,
      addUnsafeServiceEnumerationRecord: true,
      ...this.serviceOptions,
    });

    return PromiseTimeout(1);
  }

  public updateAdvertisement(silent?: boolean): void {
    const txt = CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash);
    debug("Updating txt record (txt: %o, silent: %d)", txt, silent);

    if (this.advertisement) {
      this.advertisement.updateTxt(txt, silent);
    }
  }

  public destroy(): void {
    if (this.advertisement) {
      this.advertisement.stop(() => {
        this.advertisement!.destroy();
        this.advertisement = undefined;
        this.bonjour.destroy();
      });
    } else {
      this.bonjour.destroy();
    }
  }

}

function messageBusConnectionResult(bus: MessageBus): Promise<void> {
  return new Promise((resolve, reject) => {
    const errorHandler = (error: Error) => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      bus.connection.removeListener("connect", connectHandler);
      reject(error);
    };
    const connectHandler = () => {
      bus.connection.removeListener("error", errorHandler);
      resolve();
    };

    bus.connection.once("connect", connectHandler);
    bus.connection.once("error", errorHandler);
  });
}

export class DBusInvokeError extends Error {
  readonly errorName: string;

  constructor(errorObject: InvokeError) {
    super();

    Object.setPrototypeOf(this, DBusInvokeError.prototype);

    this.name = "DBusInvokeError";

    this.errorName = errorObject.name;

    if (Array.isArray(errorObject.message) && errorObject.message.length === 1) {
      this.message = errorObject.message[0];
    } else {
      this.message = errorObject.message.toString();
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbusInvoke( bus: MessageBus, destination: string, path: string, dbusInterface: string, member: string, others?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const command = {
      destination,
      path,
      interface: dbusInterface,
      member,
      ...(others || {}),
    };

    bus.invoke(command, (err, result) => {
      if (err) {
        reject(new DBusInvokeError(err));
      } else {
        resolve(result);
      }
    });

  });
}


/**
 * AvahiServerState.
 *
 * Refer to https://github.com/lathiat/avahi/blob/fd482a74625b8db8547b8cfca3ee3d3c6c721423/avahi-common/defs.h#L220-L227.
 */
const enum AvahiServerState {
  // noinspection JSUnusedGlobalSymbols
  INVALID = 0,
  REGISTERING,
  RUNNING,
  COLLISION,
  FAILURE
}

/**
 * Advertiser based on the Avahi D-Bus library.
 * For (very crappy) docs on the interface, see the XML files at: https://github.com/lathiat/avahi/tree/master/avahi-daemon.
 *
 * Refer to https://github.com/lathiat/avahi/blob/fd482a74625b8db8547b8cfca3ee3d3c6c721423/avahi-common/defs.h#L120-L155 for a
 * rough API usage guide of Avahi.
 */
export class AvahiAdvertiser extends EventEmitter implements Advertiser {
  private readonly accessoryInfo: AccessoryInfo;
  private readonly setupHash: string;

  private port?: number;

  private bus?: MessageBus;
  private avahiServerInterface?: DBusInterface;
  private path?: string;

  private readonly stateChangeHandler: (state: AvahiServerState) => void;

  constructor(accessoryInfo: AccessoryInfo) {
    super();
    this.accessoryInfo = accessoryInfo;
    this.setupHash = CiaoAdvertiser.computeSetupHash(accessoryInfo);

    debug(`Preparing Advertiser for '${this.accessoryInfo.displayName}' using Avahi backend!`);

    this.bus = dbus.systemBus();

    this.stateChangeHandler = this.handleStateChangedEvent.bind(this);
  }

  private createTxt(): Array<Buffer> {
    return Object
      .entries(CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash))
      .map((el: Array<string>) => Buffer.from(el[0] + "=" + el[1]));
  }

  public initPort(port: number): void {
    this.port = port;
  }

  public async startAdvertising(): Promise<void> {
    if (this.port == null) {
      throw new Error("Tried starting Avahi advertisement without initializing port!");
    }
    if (!this.bus) {
      throw new Error("Tried to start Avahi advertisement on a destroyed advertiser!");
    }

    debug(`Starting to advertise '${this.accessoryInfo.displayName}' using Avahi backend!`);

    if (!this.avahiServerInterface) {
      this.avahiServerInterface = await AvahiAdvertiser.avahiInterface(this.bus, "Server");
      this.avahiServerInterface.on("StateChanged", this.stateChangeHandler);
    }

    this.path = await AvahiAdvertiser.avahiInvoke(this.bus, "/", "Server", "EntryGroupNew") as string;
    await AvahiAdvertiser.avahiInvoke(this.bus, this.path, "EntryGroup", "AddService", {
      body: [
        -1, // interface
        -1, // protocol
        0, // flags
        this.accessoryInfo.displayName, // name
        "_hap._tcp", // type
        "", // domain
        "", // host
        this.port, // port
        this.createTxt(), // txt
      ],
      signature: "iiussssqaay",
    });
    await AvahiAdvertiser.avahiInvoke(this.bus, this.path, "EntryGroup", "Commit");
  }

  /**
   * Event handler for the `StateChanged` event of the `org.freedesktop.Avahi.Server` DBus interface.
   *
   * This is called once the state of the running avahi-daemon changes its running state.
   * @param state - The state the server changed into {@see AvahiServerState}.
   */
  private handleStateChangedEvent(state: AvahiServerState): void {
    if (state === AvahiServerState.RUNNING && this.path) {
      debug("Found Avahi daemon to have restarted!");
      this.startAdvertising()
        .catch(reason => console.error("Could not (re-)create mDNS advertisement. The HAP-Server won't be discoverable: " + reason));
    }
  }

  public async updateAdvertisement(silent?: boolean): Promise<void> {
    if (!this.bus) {
      throw new Error("Tried to update Avahi advertisement on a destroyed advertiser!");
    }
    if (!this.path) {
      debug("Tried to update advertisement without a valid `path`!");
      return;
    }

    debug("Updating txt record (txt: %o, silent: %d)", CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash), silent);

    try {
      await AvahiAdvertiser.avahiInvoke(this.bus, this.path, "EntryGroup", "UpdateServiceTxt", {
        body: [-1, -1, 0, this.accessoryInfo.displayName, "_hap._tcp", "", this.createTxt()],
        signature: "iiusssaay",
      });
    } catch (error) {
      console.error("Failed to update avahi advertisement: " + error);
    }
  }

  public async destroy(): Promise<void> {
    if (!this.bus) {
      throw new Error("Tried to destroy Avahi advertisement on a destroyed advertiser!");
    }

    if (this.path) {
      try {
        await AvahiAdvertiser.avahiInvoke(this.bus, this.path, "EntryGroup", "Free");
      } catch (error) {
        // Typically, this fails if e.g. avahi service was stopped in the meantime.
        debug("Destroying Avahi advertisement failed: " + error);
      }
      this.path = undefined;
    }

    if (this.avahiServerInterface) {
      this.avahiServerInterface.removeListener("StateChanged", this.stateChangeHandler);
      this.avahiServerInterface = undefined;
    }

    this.bus.connection.stream.destroy();
    this.bus = undefined;
  }

  public static async isAvailable(): Promise<boolean> {
    const bus = dbus.systemBus();

    try {
      try {
        await messageBusConnectionResult(bus);
      } catch (error) {
        debug("Avahi/DBus classified unavailable due to missing dbus interface!");
        return false;
      }

      try {
        const version = await this.avahiInvoke(bus, "/", "Server", "GetVersionString");
        debug("Detected Avahi over DBus interface running version '%s'.", version);
      } catch (error) {
        debug("Avahi/DBus classified unavailable due to missing avahi interface!");
        return false;
      }

      return true;
    } finally {
      bus.connection.stream.destroy();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static avahiInvoke(bus: MessageBus, path: string, dbusInterface: string, member: string, others?: any): Promise<any> {
    return dbusInvoke(
      bus,
      "org.freedesktop.Avahi",
      path,
      `org.freedesktop.Avahi.${dbusInterface}`,
      member,
      others,
    );
  }

  private static avahiInterface(bus: MessageBus, dbusInterface: string): Promise<DBusInterface> {
    return new Promise((resolve, reject) => {
      bus
        .getService("org.freedesktop.Avahi")
        .getInterface("/", "org.freedesktop.Avahi." + dbusInterface, (error, iface) => {
          if (error || !iface) {
            reject(error ?? new Error("Interface not present!"));
          } else {
            resolve(iface);
          }
        });
    });
  }
}

type ResolvedServiceTxt = Array<Array<string | Buffer>>;

const RESOLVED_PERMISSIONS_ERRORS = [
  "org.freedesktop.DBus.Error.AccessDenied",
  "org.freedesktop.DBus.Error.AuthFailed",
  "org.freedesktop.DBus.Error.InteractiveAuthorizationRequired",
];


/**
 * Advertiser based on the systemd-resolved D-Bus library.
 * For docs on the interface, see: https://www.freedesktop.org/software/systemd/man/org.freedesktop.resolve1.html
 */
export class ResolvedAdvertiser extends EventEmitter implements Advertiser {
  private readonly accessoryInfo: AccessoryInfo;
  private readonly setupHash: string;

  private port?: number;

  private bus?: MessageBus;
  private path?: string;

  constructor(accessoryInfo: AccessoryInfo) {
    super();
    this.accessoryInfo = accessoryInfo;
    this.setupHash = CiaoAdvertiser.computeSetupHash(accessoryInfo);

    this.bus = dbus.systemBus();

    debug(`Preparing Advertiser for '${this.accessoryInfo.displayName}' using systemd-resolved backend!`);
  }

  private createTxt(): ResolvedServiceTxt {
    return Object
      .entries(CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash))
      .map((el: Array<string>) => [el[0].toString(), Buffer.from(el[1].toString())]);
  }

  public initPort(port: number): void {
    this.port = port;
  }

  public async startAdvertising(): Promise<void> {
    if (this.port == null) {
      throw new Error("Tried starting systemd-resolved advertisement without initializing port!");
    }
    if (!this.bus) {
      throw new Error("Tried to start systemd-resolved advertisement on a destroyed advertiser!");
    }

    debug(`Starting to advertise '${this.accessoryInfo.displayName}' using systemd-resolved backend!`);

    try {
      this.path = await ResolvedAdvertiser.managerInvoke(this.bus, "RegisterService", {
        body: [
          this.accessoryInfo.displayName, // name
          this.accessoryInfo.displayName, // name_template
          "_hap._tcp", // type
          this.port, // service_port
          0, // service_priority
          0, // service_weight
          [this.createTxt()], // txt_datas
        ],
        signature: "sssqqqaa{say}",
      });
    } catch (error) {
      if (error instanceof DBusInvokeError) {
        if (RESOLVED_PERMISSIONS_ERRORS.includes(error.errorName)) {
          error.message = `Permissions issue. See https://homebridge.io/w/mDNS-Options for more info. ${error.message}`;
        }
      }
      throw error;
    }
  }

  public async updateAdvertisement(silent?: boolean): Promise<void> {
    if (!this.bus) {
      throw new Error("Tried to update systemd-resolved advertisement on a destroyed advertiser!");
    }

    debug("Updating txt record (txt: %o, silent: %d)", CiaoAdvertiser.createTxt(this.accessoryInfo, this.setupHash), silent);

    // Currently, systemd-resolved has no way to update an existing record.
    await this.stopAdvertising();
    await this.startAdvertising();
  }

  private async stopAdvertising(): Promise<void> {
    if (!this.bus) {
      throw new Error("Tried to destroy systemd-resolved advertisement on a destroyed advertiser!");
    }

    if (this.path) {
      try {
        await ResolvedAdvertiser.managerInvoke(this.bus, "UnregisterService", {
          body: [this.path],
          signature: "o",
        });
      } catch (error) {
        // Typically, this fails if e.g. systemd-resolved service was stopped in the meantime.
        debug("Destroying systemd-resolved advertisement failed: " + error);
      }
      this.path = undefined;
    }
  }

  public async destroy(): Promise<void> {
    if (!this.bus) {
      throw new Error("Tried to destroy systemd-resolved advertisement on a destroyed advertiser!");
    }

    await this.stopAdvertising();

    this.bus.connection.stream.destroy();
    this.bus = undefined;
  }

  public static async isAvailable(): Promise<boolean> {
    const bus = dbus.systemBus();

    try {
      try {
        await messageBusConnectionResult(bus);
      } catch (error) {
        debug("systemd-resolved/DBus classified unavailable due to missing dbus interface!");
        return false;
      }

      try {
        // Ensure that systemd-resolved is accessible.
        await this.managerInvoke(bus, "ResolveHostname", {
          body: [0, "127.0.0.1", 0, 0],
          signature: "isit",
        });
        debug("Detected systemd-resolved over DBus interface running version.");
      } catch (error) {
        debug("systemd-resolved/DBus classified unavailable due to missing systemd-resolved interface!");
        return false;
      }

      try {
        const mdnsStatus = await this.resolvedInvoke(
          bus,
          "org.freedesktop.DBus.Properties",
          "Get",
          {
            body: ["org.freedesktop.resolve1.Manager", "MulticastDNS"],
            signature: "ss",
          },
        );

        if (mdnsStatus[0][0].type !== "s") {
          throw new Error("Invalid type for MulticastDNS");
        }

        if (mdnsStatus[1][0] !== "yes" ) {
          debug("systemd-resolved/DBus classified unavailable because MulticastDNS is not enabled!");
          return false;
        }
      } catch (error) {
        debug("systemd-resolved/DBus classified unavailable due to failure checking system status: " + error);
        return false;
      }

      return true;
    } finally {
      bus.connection.stream.destroy();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static resolvedInvoke(bus: MessageBus, dbusInterface: string, member: string, others?: any): Promise<any> {
    return dbusInvoke(
      bus,
      "org.freedesktop.resolve1",
      "/org/freedesktop/resolve1",
      dbusInterface,
      member,
      others,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static managerInvoke(bus: MessageBus, member: string, others?: any): Promise<any> {
    return this.resolvedInvoke(bus, "org.freedesktop.resolve1.Manager", member, others);
  }
}
