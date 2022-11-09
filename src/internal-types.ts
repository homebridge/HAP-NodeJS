import { Formats, Perms, Units } from "./lib/Characteristic";
import { ResourceRequestReason } from "./lib/controller";
import { HAPStatus } from "./lib/HAPServer";
import { CharacteristicValue, Nullable } from "./types";

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

export interface ServiceJsonObject {
  type: string,
  iid: number,
  characteristics: CharacteristicJsonObject[], // must not be empty, max 100 characteristics
  hidden?: boolean,
  primary?: boolean,
  linked?: number[], // iid array
}

export interface AccessoryJsonObject {
  aid: number,
  services: ServiceJsonObject[], // must not be empty, max 100 services
}

export interface AccessoriesResponse {
  accessories: AccessoryJsonObject[],
}

export interface CharacteristicId {
  aid: number,
  iid: number,
}

export interface CharacteristicsReadRequest {
  ids: CharacteristicId[],
  includeMeta: boolean;
  includePerms: boolean,
  includeType: boolean,
  includeEvent: boolean,
}

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

export interface PartialCharacteristicReadError {
  status: HAPStatus,
}

export interface CharacteristicReadDataValue extends PartialCharacteristicReadDataValue {
  aid: number,
  iid: number,
}

export interface CharacteristicReadError extends PartialCharacteristicReadError {
  aid: number,
  iid: number,
}

export type PartialCharacteristicReadData = PartialCharacteristicReadDataValue | PartialCharacteristicReadError;
export type CharacteristicReadData = CharacteristicReadDataValue | CharacteristicReadError;

export interface CharacteristicsReadResponse {
  characteristics: CharacteristicReadData[],
}

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

export interface CharacteristicsWriteRequest {
  characteristics: CharacteristicWrite[],
  pid?: number
}

export interface PartialCharacteristicWriteDataValue {
  value?: CharacteristicValue | null,

  status: HAPStatus.SUCCESS,
}

export interface PartialCharacteristicWriteError {
  status: HAPStatus,

  value?: undefined, // defined to make things easier
}

export interface CharacteristicWriteDataValue extends PartialCharacteristicWriteDataValue {
  aid: number,
  iid: number,
}

export interface CharacteristicWriteError extends PartialCharacteristicWriteError {
  aid: number,
  iid: number,
}

export type PartialCharacteristicWriteData = PartialCharacteristicWriteDataValue | PartialCharacteristicWriteError;
export type CharacteristicWriteData = CharacteristicWriteDataValue | CharacteristicWriteError;

export interface CharacteristicsWriteResponse {
  characteristics: CharacteristicWriteData[],
}

export type PrepareWriteRequest = {
  ttl: number,
  pid: number
}

export const enum ResourceRequestType {
  IMAGE = "image",
}

export interface ResourceRequest {
  aid?: number;
  "image-height": number;
  "image-width": number;
  "reason"?: ResourceRequestReason;
  "resource-type": ResourceRequestType;
}

export interface EventNotification {
  characteristics: CharacteristicEventNotification[],
}

export interface CharacteristicEventNotification {
  aid: number,
  iid: number,
  value: Nullable<CharacteristicValue>,
}

export function consideredTrue(input: string | null): boolean {
  if (!input) {
    return false;
  }

  return input === "true" || input === "1";
}

export const enum TLVValues {
  // noinspection JSUnusedGlobalSymbols
  REQUEST_TYPE = 0x00,
  METHOD = 0x00, // (match the terminology of the spec sheet but keep backwards compatibility with entry above)
  USERNAME = 0x01,
  IDENTIFIER = 0x01,
  SALT = 0x02,
  PUBLIC_KEY = 0x03,
  PASSWORD_PROOF = 0x04,
  ENCRYPTED_DATA = 0x05,
  SEQUENCE_NUM = 0x06,
  STATE = 0x06,
  ERROR_CODE = 0x07,
  RETRY_DELAY = 0x08,
  CERTIFICATE = 0x09, // x.509 certificate
  PROOF = 0x0A,
  SIGNATURE = 0x0A,  // apple authentication coprocessor
  PERMISSIONS = 0x0B, // None (0x00): regular user, 0x01: Admin (able to add/remove/list pairings)
  FRAGMENT_DATA = 0x0C,
  FRAGMENT_LAST = 0x0D,
  SEPARATOR = 0x0FF // Zero-length TLV that separates different TLVs in a list.
}

export const enum PairMethods {
  // noinspection JSUnusedGlobalSymbols
  PAIR_SETUP = 0x00,
  PAIR_SETUP_WITH_AUTH = 0x01,
  PAIR_VERIFY = 0x02,
  ADD_PAIRING = 0x03,
  REMOVE_PAIRING = 0x04,
  LIST_PAIRINGS = 0x05
}

/**
 * Pairing states (pair-setup or pair-verify). Encoded in {@link TLVValues.SEQUENCE_NUM}.
 */
export const enum PairingStates {
  M1 = 0x01,
  M2 = 0x02,
  M3 = 0x03,
  M4 = 0x04,
  M5 = 0x05,
  M6 = 0x06
}

export const enum HAPMimeTypes {
  PAIRING_TLV8 = "application/pairing+tlv8",
  HAP_JSON = "application/hap+json",
  IMAGE_JPEG = "image/jpeg",
}
