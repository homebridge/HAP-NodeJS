import { EventEmitter } from "events";
import { CharacteristicValue } from "../../types";
import {
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback
} from "../Characteristic";
import type { AccessControl } from '../definitions';
import { Service } from "../Service";
import * as tlv from "../util/tlv";

const enum AccessControlTypes {
  PASSWORD = 0x01,
  PASSWORD_REQUIRED = 0x02,
}

/**
 * This defines the Access Level for TVs and Speakers. It is pretty much only used for the AirPlay 2 protocol
 * so this information is not really useful.
 */
export const enum AccessLevel {
  // noinspection JSUnusedGlobalSymbols
  /**
   * This access level is set when the users selects "Anyone" or "Anyone On The Same Network"
   * in the Access Control settings.
   */
  ANYONE = 0,
  /**
   * This access level is set when the users selects "Only People Sharing this Home" in the
   * Access Control settings.
   * On this level password setting is ignored.
   * Requests to the HAPServer can only come from Home members anyways, so there is no real use to it.
   * This is pretty much only used for the AirPlay 2 protocol.
   */
  HOME_MEMBERS_ONLY = 1,

  // 2 seems to be also a valid value in the range, but never encountered it.
  // so don't know what's the use of it.
}

export const enum AccessControlEvent {
  ACCESS_LEVEL_UPDATED = "update-control-level",
  PASSWORD_SETTING_UPDATED = "update-password",
}

export declare interface AccessControlManagement {
  on(event: "update-control-level", listener: (accessLevel: AccessLevel) => void): this;
  on(event: "update-password", listener: (password: string | undefined, passwordRequired: boolean) => void): this;

  emit(event: "update-control-level", accessLevel: AccessLevel): boolean;
  emit(event: "update-password", password: string | undefined, passwordRequired: boolean): boolean;
}

export class AccessControlManagement extends EventEmitter {

  private readonly accessControlService: AccessControl;

  /**
   * The current access level set for the Home
   */
  private accessLevel: AccessLevel = 0;


  private passwordRequired: boolean = false;
  private password?: string; // undefined if passwordRequired = false
  private lastPasswordTLVReceived: string = "";

  /**
   * Instantiates a new AccessControlManagement.
   *
   * @param {boolean} password - if set to true the service will listen for password settings
   */
  constructor(password?: boolean);
  /**
   * Instantiates a new AccessControlManagement.
   *
   * @param {boolean} password - if set to true the service will listen for password settings
   * @param {AccessControl} service - supply your own instance to sideload the AccessControl service
   */
  constructor(password?: boolean, service?: AccessControl);
  constructor(password?: boolean, service?: AccessControl) {
    super();

    this.accessControlService = service || new Service.AccessControl();
    this.setupServiceHandlers(password);
  }

  /**
   * @returns the AccessControl service
   */
  public getService(): AccessControl {
    return this.accessControlService;
  }

  /**
   * @returns the current {@link AccessLevel} configured for the Home
   */
  public getAccessLevel(): AccessLevel {
    return this.accessLevel;
  }

  /**
   * @returns the current password configured for the Home or `undefined` if no password is required.
   */
  public getPassword(): string | undefined {
    return this.passwordRequired? this.password: undefined;
  }

  private handleAccessLevelChange(value: number) {
    this.accessLevel = value;
    this.emit(AccessControlEvent.ACCESS_LEVEL_UPDATED, this.accessLevel);
  }

  private handlePasswordChange(value: string) {
    this.lastPasswordTLVReceived = value;

    const data = Buffer.from(value, "base64");
    const objects = tlv.decode(data);

    if (objects[AccessControlTypes.PASSWORD]) {
      this.password = objects[AccessControlTypes.PASSWORD].toString("utf8");
    } else {
      this.password = undefined;
    }

    this.passwordRequired = !!objects[AccessControlTypes.PASSWORD_REQUIRED][0];

    this.emit(AccessControlEvent.PASSWORD_SETTING_UPDATED, this.password, this.passwordRequired);
  }

  private setupServiceHandlers(enabledPasswordCharacteristics?: boolean) {
    this.accessControlService.getCharacteristic(Characteristic.AccessControlLevel)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, this.accessLevel);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.handleAccessLevelChange(value as number);
        callback();
      });

    if (enabledPasswordCharacteristics) {
      this.accessControlService.getCharacteristic(Characteristic.PasswordSetting)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          callback(undefined, this.lastPasswordTLVReceived);
        })
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.handlePasswordChange(value as string);
          callback();
        });
    }
  }

}
