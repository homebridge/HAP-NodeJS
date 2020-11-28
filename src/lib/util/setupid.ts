
import * as crypto from 'crypto';
import {Categories} from '../Accessory';

export function generateSetupId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const max = chars.length;
  let setupID = '';

  for (var i = 0; i < 4; i++) {
    const index = Math.floor(Math.random() * max);
    setupID += chars.charAt(index);
  }

  return setupID;
}

export function generateSetupHash(deviceid: string, setupid: string) {
  if (!setupid.match(/^[0-9A-Z]{4}$/)) throw new Error('Invalid setup ID');

  return crypto.createHash('sha512')
    .update(setupid + deviceid)
    .digest().slice(0, 4);
}

export function generateSetupUri(setupcode: string | number, setupid: string, category = Categories.OTHER) {
  if (typeof setupcode === 'string') setupcode = parseInt(setupcode.replace(/-/g, ''), 10);
  const buffer = Buffer.alloc(8);

  let value_low = setupcode;
  const value_high = category >> 1;

  value_low |= 1 << 28; // Supports IP;

  buffer.writeUInt32BE(value_low, 4);

  if (category & 1) {
    buffer[4] = buffer[4] | 1 << 7;
  }

  buffer.writeUInt32BE(value_high!, 0);

  let encodedPayload = (buffer.readUInt32BE(4) + (buffer.readUInt32BE(0) * Math.pow(2, 32)))
    .toString(36).toUpperCase();

  if (encodedPayload.length != 9) {
    for (let i = 0; i <= 9 - encodedPayload.length; i++) {
      encodedPayload = "0" + encodedPayload;
    }
  }

  return "X-HM://" + encodedPayload + setupid;
}
