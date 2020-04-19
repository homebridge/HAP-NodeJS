import assert from 'assert';
import crypto from 'crypto';

import createDebug from 'debug';
import tweetnacl from 'tweetnacl';

import * as chacha20poly1305 from './chacha20poly1305';

const debug = createDebug('HAP-NodeJS:encryption');

function fromHex(h: string) {
  h.replace(/([^0-9a-f])/g, '');
  var out = [], len = h.length, w = '';
  for (var i = 0; i < len; i += 2) {
    w = h[i];
    if (((i+1) >= len) || typeof h[i+1] === 'undefined') {
        w += '0';
    } else {
        w += h[i+1];
    }
    out.push(parseInt(w, 16));
  }
  return out;
}

export function generateCurve25519KeyPair() {
  return tweetnacl.box.keyPair();
}

export function generateCurve25519SharedSecKey(priKey: Uint8Array, pubKey: Uint8Array) {
  return tweetnacl.scalarMult(priKey, pubKey);
}

//Security Layer Enc/Dec

type Count = {
  value: any;
}

export function layerEncrypt(data: Buffer, count: Count, key: Buffer) {
  var result = Buffer.alloc(0);
  var total = data.length;
  for (var offset = 0; offset < total; ) {
    var length = Math.min(total - offset, 0x400);
    var leLength = Buffer.alloc(2);
    leLength.writeUInt16LE(length,0);

    var nonce = Buffer.alloc(8);
    writeUInt64LE(count.value++, nonce, 0);

    var result_Buffer = Buffer.alloc(length);
    var result_mac = Buffer.alloc(16);
    encryptAndSeal(key, nonce, data.slice(offset, offset + length),
      leLength,result_Buffer, result_mac);

    offset += length;

    result = Buffer.concat([result,leLength,result_Buffer,result_mac]);
  }
  return result;
}

export function layerDecrypt(packet: Buffer, count: Count, key: Buffer, extraInfo: Record<string, any>) {
  // Handle Extra Info
  if (extraInfo.leftoverData != undefined) {
    packet = Buffer.concat([extraInfo.leftoverData, packet]);
  }

  var result = Buffer.alloc(0);
  var total = packet.length;

  for (var offset = 0; offset < total;) {
    var realDataLength = packet.slice(offset,offset+2).readUInt16LE(0);

    var availableDataLength = total - offset - 2 - 16;
    if (realDataLength > availableDataLength) {
      // Fragmented packet
      extraInfo.leftoverData = packet.slice(offset);
      break;
    } else {
      extraInfo.leftoverData = undefined;
    }

    var nonce = Buffer.alloc(8);
    writeUInt64LE(count.value++, nonce, 0);

    var result_Buffer = Buffer.alloc(realDataLength);

    if (verifyAndDecrypt(key, nonce, packet.slice(offset + 2, offset + 2 + realDataLength),
      packet.slice(offset + 2 + realDataLength, offset + 2 + realDataLength + 16),
      packet.slice(offset,offset+2),result_Buffer)) {
        result = Buffer.concat([result,result_Buffer]);
        offset += (18 + realDataLength);
      } else {
        debug('Layer Decrypt fail!');
        debug('Packet: %s', packet.toString('hex'));
        throw new Error("Layer verification failed!");
      }
  }

  return result;
}

//General Enc/Dec
export function verifyAndDecrypt(key: Buffer, nonce: Buffer, ciphertext: Buffer, mac: Buffer, addData: Buffer | null | undefined, plaintext: Buffer) {
  var ctx = new chacha20poly1305.Chacha20Ctx();
  chacha20poly1305.chacha20_keysetup(ctx, key);
  chacha20poly1305.chacha20_ivsetup(ctx, nonce);
  var poly1305key = Buffer.alloc(64);
  var zeros = Buffer.alloc(64);
  chacha20poly1305.chacha20_update(ctx,poly1305key,zeros,zeros.length);

  var poly1305_contxt = new chacha20poly1305.Poly1305Ctx();
  chacha20poly1305.poly1305_init(poly1305_contxt, poly1305key);

  var addDataLength = 0;
  if (addData != undefined) {
    addDataLength = addData.length;
    chacha20poly1305.poly1305_update(poly1305_contxt, addData, addData.length);
    if ((addData.length % 16) != 0) {
      chacha20poly1305.poly1305_update(poly1305_contxt, Buffer.alloc(16-(addData.length%16)), 16-(addData.length%16));
    }
  }

  chacha20poly1305.poly1305_update(poly1305_contxt, ciphertext, ciphertext.length);
  if ((ciphertext.length % 16) != 0) {
    chacha20poly1305.poly1305_update(poly1305_contxt, Buffer.alloc(16-(ciphertext.length%16)), 16-(ciphertext.length%16));
  }

  var leAddDataLen = Buffer.alloc(8);
  writeUInt64LE(addDataLength, leAddDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leAddDataLen, 8);

  var leTextDataLen = Buffer.alloc(8);
  writeUInt64LE(ciphertext.length, leTextDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leTextDataLen, 8);

  var poly_out = [] as unknown as Uint8Array;
  chacha20poly1305.poly1305_finish(poly1305_contxt, poly_out);

  if (chacha20poly1305.poly1305_verify(mac, poly_out) != 1) {
    debug('Verify Fail');
    return false;
  } else {
    var written = chacha20poly1305.chacha20_update(ctx,plaintext,ciphertext,ciphertext.length);
    chacha20poly1305.chacha20_final(ctx,plaintext.slice(written, ciphertext.length));
    return true;
  }
}

export function encryptAndSeal(key: Buffer, nonce: Buffer, plaintext: Buffer, addData: Buffer | null | undefined, ciphertext: Buffer, mac: Buffer) {
  var ctx = new chacha20poly1305.Chacha20Ctx();
  chacha20poly1305.chacha20_keysetup(ctx, key);
  chacha20poly1305.chacha20_ivsetup(ctx, nonce);
  var poly1305key = Buffer.alloc(64);
  var zeros = Buffer.alloc(64);
  chacha20poly1305.chacha20_update(ctx,poly1305key,zeros,zeros.length);

  var written = chacha20poly1305.chacha20_update(ctx,ciphertext,plaintext,plaintext.length);
  chacha20poly1305.chacha20_final(ctx,ciphertext.slice(written,plaintext.length));

  var poly1305_contxt = new chacha20poly1305.Poly1305Ctx();
  chacha20poly1305.poly1305_init(poly1305_contxt, poly1305key);

  var addDataLength = 0;
  if (addData != undefined) {
    addDataLength = addData.length;
    chacha20poly1305.poly1305_update(poly1305_contxt, addData, addData.length);
    if ((addData.length % 16) != 0) {
      chacha20poly1305.poly1305_update(poly1305_contxt, Buffer.alloc(16-(addData.length%16)), 16-(addData.length%16));
    }
  }

  chacha20poly1305.poly1305_update(poly1305_contxt, ciphertext, ciphertext.length);
  if ((ciphertext.length % 16) != 0) {
    chacha20poly1305.poly1305_update(poly1305_contxt, Buffer.alloc(16-(ciphertext.length%16)), 16-(ciphertext.length%16));
  }

  var leAddDataLen = Buffer.alloc(8);
  writeUInt64LE(addDataLength, leAddDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leAddDataLen, 8);

  var leTextDataLen = Buffer.alloc(8);
  writeUInt64LE(ciphertext.length, leTextDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leTextDataLen, 8);

  chacha20poly1305.poly1305_finish(poly1305_contxt, mac);
}

var MAX_UINT32 = 0x00000000FFFFFFFF
var MAX_INT53 =  0x001FFFFFFFFFFFFF

function onesComplement(number: number) {
  number = ~number
  if (number < 0) {
    number = (number & 0x7FFFFFFF) + 0x80000000
  }
  return number
}

function uintHighLow(number: number) {
  assert(number > -1 && number <= MAX_INT53, "number out of range")
  assert(Math.floor(number) === number, "number must be an integer")
  var high = 0
  var signbit = number & 0xFFFFFFFF
  var low = signbit < 0 ? (number & 0x7FFFFFFF) + 0x80000000 : signbit
  if (number > MAX_UINT32) {
    high = (number - low) / (MAX_UINT32 + 1)
  }
  return [high, low]
}

function intHighLow(number: number) {
  if (number > -1) {
    return uintHighLow(number)
  }
  var hl = uintHighLow(-number)
  var high = onesComplement(hl[0])
  var low = onesComplement(hl[1])
  if (low === MAX_UINT32) {
    high += 1
    low = 0
  }
  else {
    low += 1
  }
  return [high, low]
}

function writeUInt64BE(number: number, buffer: Buffer, offset: number = 0) {
  var hl = uintHighLow(number)
  buffer.writeUInt32BE(hl[0], offset)
  buffer.writeUInt32BE(hl[1], offset + 4)
}

export function writeUInt64LE (number: number, buffer: Buffer, offset: number = 0) {
  var hl = uintHighLow(number)
  buffer.writeUInt32LE(hl[1], offset)
  buffer.writeUInt32LE(hl[0], offset + 4)
}
