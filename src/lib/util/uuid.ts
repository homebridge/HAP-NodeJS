import crypto, { BinaryLike } from 'crypto';

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

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValid(UUID: string) {
  return VALID_UUID_REGEX.test(UUID);
}

// https://github.com/defunctzombie/node-uuid/blob/master/uuid.js
export function unparse(buf: Buffer | string, offset: number = 0) {
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
