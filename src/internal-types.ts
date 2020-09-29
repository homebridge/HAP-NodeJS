import { Formats, Perms, Units } from "./lib/Characteristic";
import { Status } from "./lib/HAPServer";
import { CharacteristicValue } from "./types";

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

export interface CharacteristicReadDataValue {
  aid: number,
  iid: number,
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

export interface CharacteristicReadError {
  aid: number,
  iid: number,
  status: Status,
}

export type CharacteristicsReadData = CharacteristicReadDataValue | CharacteristicReadError;

export interface CharacteristicsReadResponse {
  characteristics: CharacteristicsReadData[],
}

export interface CharacteristicWrite {
  aid: number,
  iid: number,

  value?: CharacteristicValue,
  ev?: boolean, // enable/disable event notifications for the accessory

  authData?: string, // base64 encoded
  remote?: boolean, // remote access used
  r?: boolean, // write response
}

export interface CharacteristicsWriteRequest {
  characteristics: CharacteristicWrite[],
  pid?: number
}

export interface CharacteristicWriteDataValue {
  aid: number,
  iid: number,
  value?: CharacteristicValue | null,

  // event
  ev?: boolean,

  status?: Status.SUCCESS,
}

export interface CharacteristicWriteError {
  aid: number,
  iid: number,
  status: Status,

  value?: undefined, // defined to make things easier
}

export type CharacteristicsWriteData = CharacteristicWriteDataValue | CharacteristicWriteError;

export interface CharacteristicsWriteResponse {
  characteristics: CharacteristicsWriteData[],
}

export type PrepareWriteRequest = {
  ttl: number,
  pid: number
}

export function consideredTrue(input: string | null): boolean {
  if (!input) {
    return false;
  }

  return input === "true" || input === "1";
}
