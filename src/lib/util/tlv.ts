/**
 * Type Length Value encoding/decoding, used by HAP as a wire format.
 * https://en.wikipedia.org/wiki/Type-length-value
 */

export const EMPTY_TLV_TYPE = 0x00; // and empty tlv with id 0 is usually used as delimiter for tlv lists

export function encode(type: number, data: Buffer | number | string, ...args: any[]) {

    var encodedTLVBuffer = Buffer.alloc(0);

    // coerce data to Buffer if needed
    if (typeof data === 'number')
      data = Buffer.from([data]) as Buffer;
    else if (typeof data === 'string')
      data = Buffer.from(data) as Buffer;

    if (data.length <= 255) {
        encodedTLVBuffer = Buffer.concat([Buffer.from([type,data.length]),data]);
    } else {
        var leftLength = data.length;
        var tempBuffer = Buffer.alloc(0);
        var currentStart = 0;

        for (; leftLength > 0;) {
            if (leftLength >= 255) {
                tempBuffer = Buffer.concat([tempBuffer,Buffer.from([type,0xFF]),data.slice(currentStart, currentStart + 255)]);
                leftLength -= 255;
                currentStart = currentStart + 255;
            } else {
                tempBuffer = Buffer.concat([tempBuffer,Buffer.from([type,leftLength]),data.slice(currentStart, currentStart + leftLength)]);
                leftLength -= leftLength;
            }
        }

        encodedTLVBuffer = tempBuffer;
    }

    // do we have more to encode?
    if (args.length >= 2) {

      // chop off the first two arguments which we already processed, and process the rest recursively
      const [ nextType, nextData, ...nextArgs ] = args;
      const remainingTLVBuffer = encode(nextType, nextData, ...nextArgs);

      // append the remaining encoded arguments directly to the buffer
      encodedTLVBuffer = Buffer.concat([encodedTLVBuffer, remainingTLVBuffer]);
    }

    return encodedTLVBuffer;
}

export function decode(data: Buffer) {

    var objects: Record<number, Buffer> = {};

    var leftLength = data.length;
    var currentIndex = 0;

    for (; leftLength > 0;) {
        var type = data[currentIndex];
        var length = data[currentIndex+1];
        currentIndex += 2;
        leftLength -= 2;

        var newData = data.slice(currentIndex, currentIndex+length);

        if (objects[type]) {
            objects[type] = Buffer.concat([objects[type],newData]);
        } else {
            objects[type] = newData;
        }

        currentIndex += length;
        leftLength -= length;
    }

    return objects;
}

export function decodeList(data: Buffer, entryStartId: number) {
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

        if (objects === undefined)
            throw new Error("Error parsing tlv list: Encountered uninitialized storage object");

        if (objects[type]) { // append to buffer if we have an already data for this type
            objects[type] = Buffer.concat([value, objects[type]]);
        } else {
            objects[type] = value;
        }

        currentIndex += 2 + length;
        leftLength -= 2 + length;
    }

    if (objects !== undefined)
        objectsList.push(objects); // push last entry

    return objectsList;
}

export function writeUInt64(value: number) {
    const float64 = new Float64Array(1);
    float64[0] = value;

    const buffer = Buffer.alloc(float64.buffer.byteLength);
    const view = new Uint8Array(float64.buffer);
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = view[i];
    }

    return buffer;
}

export function readUInt64(buffer: Buffer) {
    const float64 = new Float64Array(buffer);
    return float64[0];
}

export function writeUInt32(value: number) {
    const buffer = Buffer.alloc(4);

    buffer.writeUInt32LE(value, 0);

    return buffer;
}

export function readUInt32(buffer: Buffer) {
    return buffer.readUInt32LE(0);
}

export function writeUInt16(value: number) {
    const buffer = Buffer.alloc(2);

    buffer.writeUInt16LE(value, 0);

    return buffer;
}

export function readUInt16(buffer: Buffer) {
    return buffer.readUInt16LE(0);
}
