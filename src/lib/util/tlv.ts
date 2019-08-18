import bufferShim from 'buffer-shims';

/**
 * Type Length Value encoding/decoding, used by HAP as a wire format.
 * https://en.wikipedia.org/wiki/Type-length-value
 */

export function encode(type: number, data: Buffer | number | string, ...args: any[]) {

    var encodedTLVBuffer = bufferShim.alloc(0);

    // coerce data to Buffer if needed
    if (typeof data === 'number')
      data = bufferShim.from([data]) as Buffer;
    else if (typeof data === 'string')
      data = bufferShim.from(data) as Buffer;

    if (data.length <= 255) {
        encodedTLVBuffer = Buffer.concat([bufferShim.from([type,data.length]),data]);
    } else {
        var leftLength = data.length;
        var tempBuffer = bufferShim.alloc(0);
        var currentStart = 0;

        for (; leftLength > 0;) {
            if (leftLength >= 255) {
                tempBuffer = Buffer.concat([tempBuffer,bufferShim.from([type,0xFF]),data.slice(currentStart, currentStart + 255)]);
                leftLength -= 255;
                currentStart = currentStart + 255;
            } else {
                tempBuffer = Buffer.concat([tempBuffer,bufferShim.from([type,leftLength]),data.slice(currentStart, currentStart + leftLength)]);
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
