import assert from "assert";
import crypto from "crypto";
import hkdf from "futoin-hkdf";
import tweetnacl, { BoxKeyPair } from "tweetnacl";
import { HAPEncryption } from "./eventedhttp";

if (!crypto.getCiphers().includes("chacha20-poly1305")) {
  assert.fail("The cipher 'chacha20-poly1305' is not supported with your current running nodejs version v" + process.version + ". " +
    "At least a nodejs version of v10.17.0 (excluding v11.0 and v11.1) is required!");
}

/**
 * @group Cryptography
 */
export function generateCurve25519KeyPair(): BoxKeyPair {
  return tweetnacl.box.keyPair();
}

/**
 * @group Cryptography
 */
export function generateCurve25519SharedSecKey(priKey: Uint8Array, pubKey: Uint8Array): Uint8Array {
  return tweetnacl.scalarMult(priKey, pubKey);
}

/**
 * @group Cryptography
 */
export function HKDF(hashAlg: string, salt: Buffer, ikm: Buffer, info: Buffer, size: number): Buffer {
  return hkdf(ikm, size, { hash: hashAlg, salt: salt, info: info });
}


const MAX_UINT32 = 0x00000000FFFFFFFF;
const MAX_INT53 = 0x001FFFFFFFFFFFFF;

function uintHighLow(number: number) {
  assert(number > -1 && number <= MAX_INT53, "number out of range");
  assert(Math.floor(number) === number, "number must be an integer");
  let high = 0;
  const signbit = number & 0xFFFFFFFF;
  const low = signbit < 0 ? (number & 0x7FFFFFFF) + 0x80000000 : signbit;
  if (number > MAX_UINT32) {
    high = (number - low) / (MAX_UINT32 + 1);
  }
  return [high, low];
}

/**
 * @group Utils
 */
export function writeUInt64LE (number: number, buffer: Buffer, offset = 0): void {
  const hl = uintHighLow(number);
  buffer.writeUInt32LE(hl[1], offset);
  buffer.writeUInt32LE(hl[0], offset + 4);
}

//Security Layer Enc/Dec

/**
 * @group Cryptography
 */
export function chacha20_poly1305_decryptAndVerify(key: Buffer, nonce: Buffer, aad: Buffer | null, ciphertext: Buffer, authTag: Buffer): Buffer {
  if (nonce.length < 12) { // openssl 3.x.x requires 98 bits nonce length
    nonce = Buffer.concat([
      Buffer.alloc(12 - nonce.length, 0),
      nonce,
    ]);
  }

  // @ts-expect-error: types for this are really broken
  const decipher = crypto.createDecipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  if (aad) {
    decipher.setAAD(aad);
  }
  decipher.setAuthTag(authTag);
  const plaintext = decipher.update(ciphertext);
  decipher.final(); // final call verifies integrity using the auth tag. Throws error if something was manipulated!

  return plaintext;
}

/**
 * @group Cryptography
 */
export interface EncryptedData {
  ciphertext: Buffer;
  authTag: Buffer;
}

/**
 * @group Cryptography
 */
export function chacha20_poly1305_encryptAndSeal(key: Buffer, nonce: Buffer, aad: Buffer | null, plaintext: Buffer): EncryptedData {
  if (nonce.length < 12) { // openssl 3.x.x requires 98 bits nonce length
    nonce = Buffer.concat([
      Buffer.alloc(12 - nonce.length, 0),
      nonce,
    ]);
  }

  // @ts-expect-error: types for this are really broken
  const cipher = crypto.createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });

  if (aad) {
    cipher.setAAD(aad);
  }

  const ciphertext = cipher.update(plaintext);
  cipher.final(); // final call creates the auth tag
  const authTag = cipher.getAuthTag();

  return { // return type is a bit weird, but we are going to change that on a later code cleanup
    ciphertext: ciphertext,
    authTag: authTag,
  };
}

/**
 * @group Cryptography
 */
export function layerEncrypt(data: Buffer, encryption: HAPEncryption): Buffer {
  let result = Buffer.alloc(0);
  const total = data.length;
  for (let offset = 0; offset < total; ) {
    const length = Math.min(total - offset, 0x400);
    const leLength = Buffer.alloc(2);
    leLength.writeUInt16LE(length,0);

    const nonce = Buffer.alloc(8);
    writeUInt64LE(encryption.accessoryToControllerCount++, nonce, 0);

    const encrypted = chacha20_poly1305_encryptAndSeal(encryption.accessoryToControllerKey, nonce, leLength, data.slice(offset, offset + length));
    offset += length;

    result = Buffer.concat([result,leLength,encrypted.ciphertext,encrypted.authTag]);
  }
  return result;
}

/**
 * @group Cryptography
 */
export function layerDecrypt(packet: Buffer, encryption: HAPEncryption): Buffer {
  if (encryption.incompleteFrame) {
    packet = Buffer.concat([encryption.incompleteFrame, packet]);
    encryption.incompleteFrame = undefined;
  }

  let result = Buffer.alloc(0);
  const total = packet.length;

  for (let offset = 0; offset < total;) {
    const realDataLength = packet.slice(offset, offset + 2).readUInt16LE(0);

    const availableDataLength = total - offset - 2 - 16;
    if (realDataLength > availableDataLength) { // Fragmented packet
      encryption.incompleteFrame = packet.slice(offset);
      break;
    }

    const nonce = Buffer.alloc(8);
    writeUInt64LE(encryption.controllerToAccessoryCount++, nonce, 0);

    const plaintext = chacha20_poly1305_decryptAndVerify(
      encryption.controllerToAccessoryKey,
      nonce,
      packet.slice(offset,offset+2),
      packet.slice(offset + 2, offset + 2 + realDataLength),
      packet.slice(offset + 2 + realDataLength, offset + 2 + realDataLength + 16),
    );
    result = Buffer.concat([result, plaintext]);
    offset += (18 + realDataLength);
  }

  return result;
}
