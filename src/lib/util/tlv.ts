import assert from "assert";
import * as hapCrypto from "../util/hapCrypto";

/**
 * Type Length Value encoding/decoding, used by HAP as a wire format.
 * https://en.wikipedia.org/wiki/Type-length-value
 */

const EMPTY_TLV_TYPE = 0x00; // and empty tlv with id 0 is usually used as delimiter for tlv lists

export type TLVEncodable = Buffer | number | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encode(type: number, data: TLVEncodable | TLVEncodable[], ...args: any[]): Buffer {
  const encodedTLVBuffers: Buffer[] = [];

  // coerce data to Buffer if needed
  if (typeof data === "number") {
    data = Buffer.from([data]);
  } else if (typeof data === "string") {
    data = Buffer.from(data);
  }

  if (Array.isArray(data)) {
    let first = true;
    for (const entry of data) {
      if (!first) {
        encodedTLVBuffers.push(Buffer.from([EMPTY_TLV_TYPE, 0])); // push delimiter
      }

      first = false;
      encodedTLVBuffers.push(encode(type, entry));
    }

    if (first) { // we have a zero length array!
      encodedTLVBuffers.push(Buffer.from([type, 0]));
    }
  } else if (data.length <= 255) {
    encodedTLVBuffers.push(Buffer.concat([Buffer.from([type,data.length]),data]));
  } else { // otherwise it doesn't fit into one tlv entry, thus we push multiple
    let leftBytes = data.length;
    let currentIndex = 0;

    for (; leftBytes > 0;) {
      if (leftBytes >= 255) {
        encodedTLVBuffers.push(Buffer.concat([Buffer.from([type, 0xFF]), data.slice(currentIndex, currentIndex + 255)]));
        leftBytes -= 255;
        currentIndex += 255;
      } else {
        encodedTLVBuffers.push(Buffer.concat([Buffer.from([type,leftBytes]), data.slice(currentIndex)]));
        leftBytes -= leftBytes;
      }
    }
  }

  // do we have more arguments to encode?
  if (args.length >= 2) {

    // chop off the first two arguments which we already processed, and process the rest recursively
    const [ nextType, nextData, ...nextArgs ] = args;
    const remainingTLVBuffer = encode(nextType, nextData, ...nextArgs);

    // append the remaining encoded arguments directly to the buffer
    encodedTLVBuffers.push(remainingTLVBuffer);
  }

  return Buffer.concat(encodedTLVBuffers);
}

/**
 * This method is the legacy way of decoding tlv data.
 * It will not properly decode multiple list of the same id.
 * Should the decoder encounter multiple instances of the same id, it will just concatenate the buffer data.
 *
 * @param buffer - TLV8 data
 *
 * Note: Please use {@link decodeWithLists} which properly decodes list elements.
 */
export function decode(buffer: Buffer): Record<number, Buffer> {
  assert(buffer instanceof Buffer, "Illegal argument. tlv.decode() expects Buffer type!");
  const objects: Record<number, Buffer> = {};

  let leftLength = buffer.length;
  let currentIndex = 0;

  for (; leftLength > 0;) {
    const type = buffer[currentIndex];
    const length = buffer[currentIndex + 1];
    currentIndex += 2;
    leftLength -= 2;

    const data = buffer.slice(currentIndex, currentIndex + length);

    if (objects[type]) {
      objects[type] = Buffer.concat([objects[type],data]);
    } else {
      objects[type] = data;
    }

    currentIndex += length;
    leftLength -= length;
  }

  return objects;
}

/**
 * Decode a buffer coding TLV8 encoded entries.
 *
 * This method decodes multiple entries split by a TLV delimiter properly into Buffer arrays.
 * It properly reassembles tlv entries if they were split across multiple entries due to exceeding the max tlv entry size of 255 bytes.
 * @param buffer - The Buffer containing TLV8 encoded data.
 */
export function decodeWithLists(buffer: Buffer): Record<number, Buffer | Buffer[]> {
  const result: Record<number, Buffer | Buffer[]> = {};

  let leftBytes = buffer.length;
  let readIndex = 0;

  let lastType = -1;
  let lastLength = -1;
  let lastItemWasDelimiter = false;

  for (; leftBytes > 0;) {
    const type = buffer.readUInt8(readIndex++);
    const length = buffer.readUInt8(readIndex++);
    leftBytes -= 2;

    const data = buffer.slice(readIndex, readIndex + length);
    readIndex += length;
    leftBytes -= length;

    if (type === 0 && length === 0) {
      lastItemWasDelimiter = true;
      continue;
    }

    const existing = result[type];
    if (existing) { // there is already an item with the same type
      if (lastItemWasDelimiter && lastType === type) { // list of tlv types
        if (Array.isArray(existing)) {
          existing.push(data);
        } else {
          result[type] = [existing, data];
        }
      } else if (lastType === type && lastLength === 255) { // tlv data got split into multiple entries as length exceeded 255
        if (Array.isArray(existing)) {
          // append to the last data blob in the array
          const last = existing[existing.length - 1];
          existing[existing.length - 1] = Buffer.concat([last, data]);
        } else {
          result[type] = Buffer.concat([existing, data]);
        }
      } else {
        throw new Error(`Found duplicated tlv entry with type ${type} and length ${length} \
        (lastItemWasDelimiter: ${lastItemWasDelimiter}, lastType: ${lastType}, lastLength: ${lastLength})`);
      }
    } else {
      result[type] = data;
    }

    lastType = type;
    lastLength = length;
    lastItemWasDelimiter = false;
  }

  return result;
}

/**
 * This method can be used to parse a TLV8 encoded list that was concatenated.
 *
 * If you are thinking about using this method, try to refactor the code to use {@link decodeWithLists} instead of {@link decode}.
 * The single reason of this method's existence are the shortcomings {@link decode}, as it concatenates multiple tlv8 list entries
 * into a single Buffer.
 * This method can be used to undo that, by specifying the concatenated buffer and the tlv id of the element that should
 * mark the beginning of a new tlv8 list entry.
 *
 * @param data - The concatenated tlv8 list entries (probably output of {@link decode}).
 * @param entryStartId - The tlv id that marks the beginning of a new tlv8 entry.
 */
export function decodeList(data: Buffer, entryStartId: number): Record<number, Buffer>[] {
  const objectsList: Record<number, Buffer>[] = [];

  let leftLength = data.length;
  let currentIndex = 0;

  let objects: Record<number, Buffer> | undefined = undefined;

  for (; leftLength > 0;) {
    const type = data[currentIndex]; // T
    const length = data[currentIndex + 1]; // L
    const value = data.slice(currentIndex + 2, currentIndex + 2 + length); // V

    if (type === entryStartId) { // we got the start of a new entry
      if (objects !== undefined) { // save the previous entry
        objectsList.push(objects);
      }

      objects = {};
    }

    if (objects === undefined) {
      throw new Error("Error parsing tlv list: Encountered uninitialized storage object");
    }

    if (objects[type]) { // append to buffer if we have already data for this type
      objects[type] = Buffer.concat([objects[type], value]);
    } else {
      objects[type] = value;
    }

    currentIndex += 2 + length;
    leftLength -= 2 + length;
  }

  if (objects !== undefined) {
    objectsList.push(objects);
  } // push last entry

  return objectsList;
}

/**
 * @deprecated This implementation is considered broken. Don't use it.
 */
export function writeUInt64(value: number): Buffer {
  const float64 = new Float64Array(1);
  float64[0] = value;

  const buffer = Buffer.alloc(float64.buffer.byteLength);
  const view = new Uint8Array(float64.buffer);
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = view[i];
  }

  return buffer;
}

// noinspection JSUnusedGlobalSymbols
/**
 * @deprecated This implementation is considered broken. Don't use it.
 */
export function readUInt64(buffer: Buffer): number {
  const float64 = new Float64Array(buffer);
  return float64[0];
}

export function readUInt64LE(buffer: Buffer, offset = 0): number {
  const low = buffer.readUInt32LE(offset);
  // javascript doesn't allow to shift by 32(?), therefore we multiply here
  return buffer.readUInt32LE(offset + 4) * 0x100000000 + low;
}

// noinspection JSUnusedGlobalSymbols
/**
 * @deprecated The method was named wrongfully and actually reads an UInt64 in **little endian** format.
 */
export function readUInt64BE(buffer: Buffer, offset = 0): number {
  return readUInt64LE(buffer, offset);
}

/**
 * `writeUint32LE`
 */
export function writeUInt32(value: number): Buffer {
  const buffer = Buffer.alloc(4);

  buffer.writeUInt32LE(value, 0);

  return buffer;
}

/**
 * `readUInt32LE`
 */
export function readUInt32(buffer: Buffer): number {
  return buffer.readUInt32LE(0);
}

export function writeFloat32LE(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeFloatLE(value, 0);
  return buffer;
}

/**
 * `writeUInt16LE`
 */
export function writeUInt16(value: number): Buffer {
  const buffer = Buffer.alloc(2);

  buffer.writeUInt16LE(value, 0);

  return buffer;
}

/**
 * `readUInt16LE`
 */
export function readUInt16(buffer: Buffer): number {
  return buffer.readUInt16LE(0);
}


/**
 * Reads variable size unsigned integer {@see writeVariableUIntLE}.
 * @param buffer - The buffer to read from. It must have exactly the size of the given integer.
 */
export function readVariableUIntLE(buffer: Buffer): number;
/**
 * @deprecated Can't define an offset. The original implementation messed up here!
 */
export function readVariableUIntLE(buffer: Buffer, offset: number): number;
export function readVariableUIntLE(buffer: Buffer, offset = 0): number {
  assert(offset === 0, "Can't define a offset different than 0!");

  switch (buffer.length) {
  case 1:
    return buffer.readUInt8(offset);
  case 2:
    return buffer.readUInt16LE(offset);
  case 4:
    return buffer.readUInt32LE(offset);
  case 8:
    return readUInt64LE(buffer, offset);
  default:
    throw new Error("Can't read uint LE with length " + buffer.length);
  }
}

/**
 * Writes variable size unsigned integer.
 * Either:
 * - `UInt8`
 * - `UInt16LE`
 * - `UInt32LE`
 * @param number
 */
export function writeVariableUIntLE(number: number, ): Buffer;
/**
 * @deprecated Can't define an offset. The original implementation messed up here!
 */
export function writeVariableUIntLE(number: number, offset: number): Buffer;
export function writeVariableUIntLE(number: number, offset = 0): Buffer {
  assert(number >= 0, "Can't encode a negative integer as unsigned integer");
  assert(offset === 0, "Can't define a offset different than 0!");

  if (number <= 255) {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(number, offset);
    return buffer;
  } else if (number <= 65535) {
    return writeUInt16(number);
  } else if (number <= 4294967295) {
    return writeUInt32(number);
  } else {
    const buffer = Buffer.alloc(8);
    hapCrypto.writeUInt64LE(number, buffer, offset);
    return buffer;
  }
}
