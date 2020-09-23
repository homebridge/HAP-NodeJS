import ciao, {
  CiaoService,
  MDNSServerOptions,
  Responder,
  ServiceEvent,
  ServiceTxt,
  ServiceType
} from "@homebridge/ciao";
import { ServiceOptions } from "@homebridge/ciao/lib/CiaoService";
import assert from "assert";
import crypto from 'crypto';
import { EventEmitter } from "events";
import { AccessoryInfo } from './model/AccessoryInfo';

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
  UPDATED_NAME = "updated-name",
}

export declare interface Advertiser {
  on(event: "updated-name", listener: (name: string) => void): this;

  emit(event: "updated-name", name: string): boolean;
}

/**
 * Advertiser uses mdns to broadcast the presence of an Accessory to the local network.
 *
 * Note that as of iOS 9, an accessory can only pair with a single client. Instead of pairing your
 * accessories with multiple iOS devices in your home, Apple intends for you to use Home Sharing.
 * To support this requirement, we provide the ability to be "discoverable" or not (via a "service flag" on the
 * mdns payload).
 */
export class Advertiser extends EventEmitter {

  static protocolVersion: string = "1.1";
  static protocolVersionService: string = "1.1.0";

  private readonly accessoryInfo: AccessoryInfo;
  private readonly setupHash: string;

  private readonly responder: Responder;
  private readonly advertisedService: CiaoService;

  constructor(accessoryInfo: AccessoryInfo, responderOptions?: MDNSServerOptions, serviceOptions?: Partial<ServiceOptions>) {
    super();
    this.accessoryInfo = accessoryInfo;
    this.setupHash = this.computeSetupHash();

    this.responder = ciao.getResponder(responderOptions);
    this.advertisedService = this.responder.createService({
      name: this.accessoryInfo.displayName,
      type: ServiceType.HAP,
      txt: this.createTxt(),
      // host will default now to <displayName>.local, spaces replaced with dashes
      ...serviceOptions,
    });
    this.advertisedService.on(ServiceEvent.NAME_CHANGED, this.emit.bind(this, AdvertiserEvent.UPDATED_NAME));
  }

  public initPort(port: number): void {
    this.advertisedService.updatePort(port);
  }

  public startAdvertising(): Promise<void> {
    return this.advertisedService!.advertise();
  }

  public isServiceCreated(): boolean {
    return !!this.advertisedService;
  }

  public updateAdvertisement(): void {
    this.advertisedService!.updateTxt(this.createTxt());
  }

  public destroyAdvertising(): Promise<void> {
    return this.advertisedService!.destroy();
  }

  public async shutdown(): Promise<void> {
    await this.destroyAdvertising(); // would also be done by the shutdown method below
    await this.responder.shutdown();
  }

  private createTxt(): ServiceTxt {
    const statusFlags: StatusFlag[] = [];

    if (!this.accessoryInfo.paired()) {
      statusFlags.push(StatusFlag.NOT_PAIRED);
    }

    return {
      "c#": this.accessoryInfo.getConfigVersion(), // current configuration number
      ff: Advertiser.ff(), // pairing feature flags
      id: this.accessoryInfo.username, // device id
      md: this.accessoryInfo.model, // model name
      pv: Advertiser.protocolVersion, // protocol version
      "s#": 1, // current state number (must be 1)
      sf: Advertiser.sf(...statusFlags), // status flags
      ci: this.accessoryInfo.category,
      sh: this.setupHash,
    };
  }

  private computeSetupHash(): string {
    const hash = crypto.createHash('sha512');
    hash.update(this.accessoryInfo.setupID + this.accessoryInfo.username.toUpperCase());
    return hash.digest().slice(0, 4).toString('base64');
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

