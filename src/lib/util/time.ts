import assert from "assert";
import { readUInt64LE } from "./tlv";

const EPOCH_MILLIS_2001_01_01 = Date.UTC(2001, 0, 1, 0, 0, 0, 0);

/**
 * @group Utils
 */
export function epochMillisFromMillisSince2001_01_01(millis: number): number {
  return EPOCH_MILLIS_2001_01_01 + millis;
}

/**
 * @group Utils
 */
export function epochMillisFromMillisSince2001_01_01Buffer(millis: Buffer): number {
  assert(millis.length === 8, "can only parse 64 bit buffers!");
  const millisSince2001 = readUInt64LE(millis);
  return epochMillisFromMillisSince2001_01_01(millisSince2001);
}
