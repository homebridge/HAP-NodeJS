import { Formats, Perms, Units } from "./lib/Characteristic";
import { Status } from "./lib/HAPServer";
import { CharacteristicValue, Nullable } from "./types";

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

  status?: Status.SUCCESS,

  // type
  type?: string, // characteristics uuid

  // metadata
  format?: Formats,
  unit?: Units,
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
  status: Status,
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
  ev?: boolean, // event

  status?: Status.SUCCESS,
}

export interface PartialCharacteristicWriteError {
  status: Status,

  value?: undefined, // defined to make things easier
}

export interface CharacteristicWriteDataValue extends PartialCharacteristicWriteDataValue{
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
