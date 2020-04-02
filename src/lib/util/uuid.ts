import crypto from 'crypto';

type Binary = Buffer | NodeJS.TypedArray | DataView;
export type BinaryLike = string | Binary;

// http://stackoverflow.com/a/25951500/66673
export function generate(data: BinaryLike) {
  const sha1sum = crypto.createHash('sha1');
  sha1sum.update(data);
  const s = sha1sum.digest('hex');
  let i = -1;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
    i += 1;
    switch (c) {
      case 'y':
        return ((parseInt('0x' + s[i], 16) & 0x3) | 0x8).toString(16);
      case 'x':
      default:
        return s[i];
    }
  });
}

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValid(UUID: string) {
  return VALID_UUID_REGEX.test(UUID);
}

// https://github.com/defunctzombie/node-uuid/blob/master/uuid.js
export function unparse(buf: Buffer | string, offset: number = 0) {
  if (typeof buf === "string" && isValid(buf)) {
    /*
      This check was added to fix backwards compatibility with the old style CameraSource API.
      The old StreamController implementation would not unparse the HAP provided sessionId for the current streaming session.
      This was changed when the new Controller API was introduced, which now turns the sessionId Buffer into a string
      and passes it to the implementor of the Camera.
      Old style CameraSource implementations would use this unparse function to turn the Buffer into a string.
      As the sessionId is already a string we just return it here.

      The buf attribute being a also type of "string" as actually an error. Also I don't know who decided to
      not unparse the sessionId. I'm only here to fix things.
     */
    return buf;
  }

  let i = offset;
  return buf[i++].toString(16) + buf[i++].toString(16) +
         buf[i++].toString(16) + buf[i++].toString(16) + '-' +
         buf[i++].toString(16) + buf[i++].toString(16) + '-' +
         buf[i++].toString(16) + buf[i++].toString(16) + '-' +
         buf[i++].toString(16) + buf[i++].toString(16) + '-' +
         buf[i++].toString(16) + buf[i++].toString(16) +
         buf[i++].toString(16) + buf[i++].toString(16) +
         buf[i++].toString(16) + buf[i++].toString(16);
}

export function write(uuid: string, buf: Buffer = Buffer.alloc(16), offset: number = 0): Buffer {
  uuid = uuid.replace(/-/g, "");

  for (let i = 0; i < uuid.length; i += 2) {
    const octet = uuid.substring(i, i + 2);
    buf.write(octet, offset++, undefined, "hex");
  }

  return buf;
}
