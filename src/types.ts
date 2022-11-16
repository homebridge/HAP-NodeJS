import { Formats, Perms, Units } from "./lib/Characteristic";
import { ResourceRequestReason } from "./lib/controller";
import { HAPStatus } from "./lib/HAPServer";

/**
 * @group Utils
 */
export type Nullable<T> = T | null;

/**
 * @group Utils
 */
export type WithUUID<T> = T & { UUID: string };

/**
 * Like TypeScripts `Partial` but allowing null as a value.
 *
 * @group Utils
 */
export type PartialAllowingNull<T> = {
  [P in keyof T]?: T[P] | null;
}

/**
 * Type of the constructor arguments of the provided constructor type.
 *
 * @group Utils
 */
export type ConstructorArgs<C> = C extends new (...args: infer A) => any ? A : never; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * UUID string uniquely identifying every HAP connection.
 *
 * @group HAP Accessory Server
 */
export type SessionIdentifier = string;
/**
 * Defines a mac address.
 * Must have a format like 'XX:XX:XX:XX:XX:XX' with XX being a valid hexadecimal string
 *
 * @group Utils
 */
export type MacAddress = string;
/**
 * Defines a pincode for the HAP accessory.
 * Must have a format like "XXX-XX-XXX".
 *
 * @group Accessory
 */
export type HAPPincode = string;
/**
 * @group Utils
 */
export type InterfaceName = string;
/**
 * @group Utils
 */
export type IPv4Address = string;
/**
 * @group Utils
 */
export type IPv6Address = string;
/**
 * @group Utils
 */
export type IPAddress = IPv4Address | IPv6Address;

/**
 * @group Utils
 */
export type NodeCallback<T> = (err: Nullable<Error> | undefined, data?: T) => void;
/**
 * @group Utils
 */
export type VoidCallback = (err?: Nullable<Error>) => void;
/**
 * @group Utils
 */
export type PrimitiveTypes = string | number | boolean;
/**
 * @group Characteristic
 */
export type CharacteristicValue = PrimitiveTypes | PrimitiveTypes[] | { [key: string]: PrimitiveTypes };

/**
 * @group Camera
 * @deprecated replaced by {@link AudioStreamingCodec}
 */
export type AudioCodec = {
  samplerate: number;
  type: string;
}
/**
 * @group Camera
 * @deprecated replaced by {@link H264CodecParameters}
 */
export type VideoCodec = {
  levels: number[];
  profiles: number[];
}
/**
 * @group Camera
 * @deprecated replaced by {@link AudioStreamingOptions}
 */
export type StreamAudioParams = {
  comfort_noise: boolean;
  // noinspection JSDeprecatedSymbols
  codecs: AudioCodec[];
};
/**
 * @group Camera
 * @deprecated replaced by {@link VideoStreamingOptions}
 */
export type StreamVideoParams = {
  // noinspection JSDeprecatedSymbols
  codec?: VideoCodec;
  resolutions: [number, number, number][]; // width, height, framerate
};

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicJsonObject {
  type: string, // uuid or short uuid
  iid: number,
  value?: Nullable<CharacteristicValue>, // undefined for non-readable characteristics

  perms: Perms[],
  format: Formats | string,

  description?: string,

  unit?: Units | string,
  minValue?: number,
  maxValue?: number,
  minStep?: number,
  maxLen?: number,
  maxDataLen?: number,
  "valid-values"?: number[],
  "valid-values-range"?: [min: number, max: number],
}

/**
 * @group HAP Accessory Server
 */
export interface ServiceJsonObject {
  type: string,
  iid: number,
  characteristics: CharacteristicJsonObject[], // must not be empty, max 100 characteristics
  hidden?: boolean,
  primary?: boolean,
  linked?: number[], // iid array
}

/**
 * @group HAP Accessory Server
 */
export interface AccessoryJsonObject {
  aid: number,
  services: ServiceJsonObject[], // must not be empty, max 100 services
}

/**
 * @group HAP Accessory Server
 */
export interface AccessoriesResponse {
  accessories: AccessoryJsonObject[],
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicId {
  aid: number,
  iid: number,
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicsReadRequest {
  ids: CharacteristicId[],
  includeMeta: boolean;
  includePerms: boolean,
  includeType: boolean,
  includeEvent: boolean,
}

/**
 * @group HAP Accessory Server
 */
export interface PartialCharacteristicReadDataValue {
  value: CharacteristicValue | null,

  status?: HAPStatus.SUCCESS,

  // type
  type?: string, // characteristics uuid

  // metadata
  format?: string,
  unit?: string,
  minValue?: number,
  maxValue?: number,
  minStep?: number,
  maxLen?: number,

  // perms
  perms?: Perms[],

  // event
  ev?: boolean,
}

/**
 * @group HAP Accessory Server
 */
export interface PartialCharacteristicReadError {
  status: HAPStatus,
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicReadDataValue extends PartialCharacteristicReadDataValue {
  aid: number,
  iid: number,
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicReadError extends PartialCharacteristicReadError {
  aid: number,
  iid: number,
}

/**
 * @group HAP Accessory Server
 */
export type PartialCharacteristicReadData = PartialCharacteristicReadDataValue | PartialCharacteristicReadError;
/**
 * @group HAP Accessory Server
 */
export type CharacteristicReadData = CharacteristicReadDataValue | CharacteristicReadError;

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicsReadResponse {
  characteristics: CharacteristicReadData[],
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicWrite {
  aid: number,
  iid: number,

  value?: CharacteristicValue,
  ev?: boolean, // enable/disable event notifications for the accessory

  authData?: string, // base64 encoded string used for custom authorisation
  /**
   * @deprecated This indicated if access was done via the old iCloud relay
   */
  remote?: boolean, // remote access used
  r?: boolean, // write response
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicsWriteRequest {
  characteristics: CharacteristicWrite[],
  pid?: number
}

/**
 * @group HAP Accessory Server
 */
export interface PartialCharacteristicWriteDataValue {
  value?: CharacteristicValue | null,

  status: HAPStatus.SUCCESS,
}

/**
 * @group HAP Accessory Server
 */
export interface PartialCharacteristicWriteError {
  status: HAPStatus,

  value?: undefined, // defined to make things easier
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicWriteDataValue extends PartialCharacteristicWriteDataValue {
  aid: number,
  iid: number,
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicWriteError extends PartialCharacteristicWriteError {
  aid: number,
  iid: number,
}

/**
 * @group HAP Accessory Server
 */
export type PartialCharacteristicWriteData = PartialCharacteristicWriteDataValue | PartialCharacteristicWriteError;
/**
 * @group HAP Accessory Server
 */
export type CharacteristicWriteData = CharacteristicWriteDataValue | CharacteristicWriteError;

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicsWriteResponse {
  characteristics: CharacteristicWriteData[],
}

/**
 * @group HAP Accessory Server
 */
export type PrepareWriteRequest = {
  ttl: number,
  pid: number
}

/**
 * @group HAP Accessory Server
 */
export const enum ResourceRequestType {
  IMAGE = "image",
}

/**
 * @group HAP Accessory Server
 */
export interface ResourceRequest {
  aid?: number;
  "image-height": number;
  "image-width": number;
  "reason"?: ResourceRequestReason;
  "resource-type": ResourceRequestType;
}
