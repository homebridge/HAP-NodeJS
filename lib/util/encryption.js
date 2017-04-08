'use strict';

var crypto = require('crypto');
var chacha20poly1305 = require('./chacha20poly1305');
var curve25519 = require('curve25519-n2');
var assert = require('assert');
var bufferShim = require('buffer-shims');
var debug = require('debug')('encryption');

module.exports = {
  generateCurve25519SecretKey: generateCurve25519SecretKey,
  generateCurve25519PublicKeyFromSecretKey: generateCurve25519PublicKeyFromSecretKey,
  generateCurve25519SharedSecKey: generateCurve25519SharedSecKey,
  layerEncrypt: layerEncrypt,
  layerDecrypt: layerDecrypt,
  verifyAndDecrypt: verifyAndDecrypt,
  encryptAndSeal: encryptAndSeal
};

function fromHex(h) {
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

function generateCurve25519SecretKey() {
  var secretKey = bufferShim.alloc(32);
  curve25519.makeSecretKey(secretKey);
  return secretKey;
}

function generateCurve25519PublicKeyFromSecretKey(secKey) {
  var publicKey = curve25519.derivePublicKey(secKey);
  return publicKey;
}

function generateCurve25519SharedSecKey(secKey, pubKey) {
  var sharedSec = curve25519.deriveSharedSecret(secKey, pubKey);
  return sharedSec;
}

//Security Layer Enc/Dec

function layerEncrypt(data, count, key) {
  var result = bufferShim.alloc(0);
  var total = data.length;
  for (var offset = 0; offset < total; ) {
    var length = Math.min(total - offset, 0x400);
    var leLength = bufferShim.alloc(2);
    leLength.writeUInt16LE(length,0);

    var nonce = bufferShim.alloc(8);
    writeUInt64LE(count.value++, nonce, 0);

    var result_Buffer = bufferShim.alloc(length);
    var result_mac = bufferShim.alloc(16);
    encryptAndSeal(key, nonce, data.slice(offset, offset + length),
      leLength,result_Buffer, result_mac);

    offset += length;

    result = Buffer.concat([result,leLength,result_Buffer,result_mac]);
  }
  return result;
}

function layerDecrypt(packet, count, key, extraInfo) {
  // Handle Extra Info
  if (extraInfo.leftoverData != undefined) {
    packet = Buffer.concat([extraInfo.leftoverData, packet]);
  }

  var result = bufferShim.alloc(0);
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

    var nonce = bufferShim.alloc(8);
    writeUInt64LE(count.value++, nonce, 0);

    var result_Buffer = bufferShim.alloc(realDataLength);

    if (verifyAndDecrypt(key, nonce, packet.slice(offset + 2, offset + 2 + realDataLength),
      packet.slice(offset + 2 + realDataLength, offset + 2 + realDataLength + 16),
      packet.slice(offset,offset+2),result_Buffer)) {
        result = Buffer.concat([result,result_Buffer]);
        offset += (18 + realDataLength);
      } else {
        debug('Layer Decrypt fail!');
        debug('Packet: %s', packet.toString('hex'));
        return 0;
      }
  }

  return result;
}

//General Enc/Dec
function verifyAndDecrypt(key,nonce,ciphertext,mac,addData,plaintext) {
  var ctx = new chacha20poly1305.Chacha20Ctx();
  chacha20poly1305.chacha20_keysetup(ctx, key);
  chacha20poly1305.chacha20_ivsetup(ctx, nonce);
  var poly1305key = bufferShim.alloc(64);
  var zeros = bufferShim.alloc(64);
  chacha20poly1305.chacha20_update(ctx,poly1305key,zeros,zeros.length);

  var poly1305_contxt = new chacha20poly1305.Poly1305Ctx();
  chacha20poly1305.poly1305_init(poly1305_contxt, poly1305key);

  var addDataLength = 0;
  if (addData != undefined) {
    addDataLength = addData.length;
    chacha20poly1305.poly1305_update(poly1305_contxt, addData, addData.length);
    if ((addData.length % 16) != 0) {
      chacha20poly1305.poly1305_update(poly1305_contxt, bufferShim.alloc(16-(addData.length%16)), 16-(addData.length%16));
    }
  }

  chacha20poly1305.poly1305_update(poly1305_contxt, ciphertext, ciphertext.length);
  if ((ciphertext.length % 16) != 0) {
    chacha20poly1305.poly1305_update(poly1305_contxt, bufferShim.alloc(16-(ciphertext.length%16)), 16-(ciphertext.length%16));
  }

  var leAddDataLen = bufferShim.alloc(8);
  writeUInt64LE(addDataLength, leAddDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leAddDataLen, 8);

  var leTextDataLen = bufferShim.alloc(8);
  writeUInt64LE(ciphertext.length, leTextDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leTextDataLen, 8);

  var poly_out = [];
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

function encryptAndSeal(key,nonce,plaintext,addData,ciphertext,mac) {
  var ctx = new chacha20poly1305.Chacha20Ctx();
  chacha20poly1305.chacha20_keysetup(ctx, key);
  chacha20poly1305.chacha20_ivsetup(ctx, nonce);
  var poly1305key = bufferShim.alloc(64);
  var zeros = bufferShim.alloc(64);
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
      chacha20poly1305.poly1305_update(poly1305_contxt, bufferShim.alloc(16-(addData.length%16)), 16-(addData.length%16));
    }
  }

  chacha20poly1305.poly1305_update(poly1305_contxt, ciphertext, ciphertext.length);
  if ((ciphertext.length % 16) != 0) {
    chacha20poly1305.poly1305_update(poly1305_contxt, bufferShim.alloc(16-(ciphertext.length%16)), 16-(ciphertext.length%16));
  }

  var leAddDataLen = bufferShim.alloc(8);
  writeUInt64LE(addDataLength, leAddDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leAddDataLen, 8);

  var leTextDataLen = bufferShim.alloc(8);
  writeUInt64LE(ciphertext.length, leTextDataLen, 0);
  chacha20poly1305.poly1305_update(poly1305_contxt, leTextDataLen, 8);

  chacha20poly1305.poly1305_finish(poly1305_contxt, mac);
}

var MAX_UINT32 = 0x00000000FFFFFFFF
var MAX_INT53 =  0x001FFFFFFFFFFFFF

function onesComplement(number) {
  number = ~number
  if (number < 0) {
    number = (number & 0x7FFFFFFF) + 0x80000000
  }
  return number
}

function uintHighLow(number) {
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

function intHighLow(number) {
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

function writeUInt64BE(number, buffer, offset) {
  offset = offset || 0
  var hl = uintHighLow(number)
  buffer.writeUInt32BE(hl[0], offset)
  buffer.writeUInt32BE(hl[1], offset + 4)
}

function writeUInt64LE (number, buffer, offset) {
  offset = offset || 0
  var hl = uintHighLow(number)
  buffer.writeUInt32LE(hl[1], offset)
  buffer.writeUInt32LE(hl[0], offset + 4)
}
