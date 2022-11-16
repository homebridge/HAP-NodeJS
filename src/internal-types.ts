import { CharacteristicValue, Nullable } from "./types";

/**
 * @group HAP Accessory Server
 */
export interface EventNotification {
  characteristics: CharacteristicEventNotification[],
}

/**
 * @group HAP Accessory Server
 */
export interface CharacteristicEventNotification {
  aid: number,
  iid: number,
  value: Nullable<CharacteristicValue>,
}

/**
 * @group Utils
 */
export function consideredTrue(input: string | null): boolean {
  if (!input) {
    return false;
  }

  return input === "true" || input === "1";
}

/**
 * @group HAP Accessory Server
 */
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

/**
 * @group HAP Accessory Server
 */
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
 *
 * @group HAP Accessory Server
 */
export const enum PairingStates {
  M1 = 0x01,
  M2 = 0x02,
  M3 = 0x03,
  M4 = 0x04,
  M5 = 0x05,
  M6 = 0x06
}

/**
 * @group HAP Accessory Server
 */
export const enum HAPMimeTypes {
  PAIRING_TLV8 = "application/pairing+tlv8",
  HAP_JSON = "application/hap+json",
  IMAGE_JPEG = "image/jpeg",
}
