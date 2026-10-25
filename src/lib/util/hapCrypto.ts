import assert from "assert";
import crypto from "crypto";
import hkdf from "futoin-hkdf";
import { HAPEncryption } from "./eventedhttp";

if (!crypto.getCiphers().includes("chacha20-poly1305")) {
  assert.fail("The cipher 'chacha20-poly1305' is not supported with your current running nodejs version v" + process.version + ". " +
    "At least a nodejs version of v10.17.0 (excluding v11.0 and v11.1) is required!");
}

const X25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function privateKeyObject(prefix: Buffer, key: Uint8Array): crypto.KeyObject {
  return crypto.createPrivateKey({ key: Buffer.concat([prefix, key]), format: "der", type: "pkcs8" });
}

function publicKeyObject(prefix: Buffer, key: Uint8Array): crypto.KeyObject {
  return crypto.createPublicKey({ key: Buffer.concat([prefix, key]), format: "der", type: "spki" });
}

function rawKey(key: crypto.KeyObject): Buffer {
  return key.export({ format: "der", type: key.type === "private" ? "pkcs8" : "spki" }).subarray(-32);
}

/**
 * @group Cryptography
 */
export interface Curve25519KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * An Ed25519 key pair. The secret key has 64 bytes: the 32-byte seed followed by the public key
 * (the layout of tweetnacl, in which the long-term keys of accessories are stored).
 *
 * @group Cryptography
 */
export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * @group Cryptography
 */
export function generateCurve25519KeyPair(): Curve25519KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");
  return { publicKey: rawKey(publicKey), secretKey: rawKey(privateKey) };
}

/**
 * @group Cryptography
 */
export function generateCurve25519SharedSecKey(priKey: Uint8Array, pubKey: Uint8Array): Uint8Array {
  assert(priKey.length === 32, "bad private key size");
  assert(pubKey.length === 32, "bad public key size");
  try {
    return crypto.diffieHellman({
      privateKey: privateKeyObject(X25519_PKCS8_PREFIX, priKey),
      publicKey: publicKeyObject(X25519_SPKI_PREFIX, pubKey),
    });
  } catch (error) {
    // OpenSSL refuses a public key of small order, whose shared secret is all zeros; tweetnacl returned the zeros.
    // A paired peer can still complete pair verify by signing with its long-term key, but the resulting
    // session keys are derived from a publicly known zero secret; authentication does not preserve secrecy here.
    if ((error as NodeJS.ErrnoException).code === "ERR_OSSL_FAILED_DURING_DERIVATION") {
      return Buffer.alloc(32);
    }
    throw error;
  }
}

/**
 * @group Cryptography
 */
export function generateEd25519KeyPair(): Ed25519KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const rawPublicKey = rawKey(publicKey);
  return { publicKey: rawPublicKey, secretKey: Buffer.concat([rawKey(privateKey), rawPublicKey]) };
}

/**
 * Signs with the 64-byte secret key of an {@link Ed25519KeyPair}.
 *
 * @group Cryptography
 */
export function ed25519Sign(message: Uint8Array, secretKey: Uint8Array): Buffer {
  assert(secretKey.length === 64, "bad secret key size");
  return crypto.sign(null, message, privateKeyObject(ED25519_PKCS8_PREFIX, secretKey.subarray(0, 32)));
}

/**
 * False also for a signature or public key of the wrong size, and for a public key that is no point on the curve.
 *
 * @group Cryptography
 */
export function ed25519Verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  if (signature.length !== 64 || publicKey.length !== 32) {
    return false;
  }
  try {
    return crypto.verify(null, message, publicKeyObject(ED25519_SPKI_PREFIX, publicKey), signature);
  } catch (error) {
    return false;
  }
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

  const decipher = crypto.createDecipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  if (aad) {
    decipher.setAAD(aad, { plaintextLength: ciphertext.length });
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

  const cipher = crypto.createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });

  if (aad) {
    cipher.setAAD(aad, { plaintextLength: plaintext.length });
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
  const chunks: Buffer[] = [];
  const total = data.length;
  for (let offset = 0; offset < total; ) {
    const length = Math.min(total - offset, 0x400);
    const leLength = Buffer.alloc(2);
    leLength.writeUInt16LE(length,0);

    const nonce = Buffer.alloc(8);
    writeUInt64LE(encryption.accessoryToControllerCount++, nonce, 0);

    const encrypted = chacha20_poly1305_encryptAndSeal(encryption.accessoryToControllerKey, nonce, leLength, data.subarray(offset, offset + length));
    offset += length;

    chunks.push(leLength, encrypted.ciphertext, encrypted.authTag);
  }
  return Buffer.concat(chunks);
}

/**
 * @group Cryptography
 */
export function layerDecrypt(packet: Buffer, encryption: HAPEncryption): Buffer {
  if (encryption.incompleteFrame) {
    packet = Buffer.concat([encryption.incompleteFrame, packet]);
    encryption.incompleteFrame = undefined;
  }

  const chunks: Buffer[] = [];
  const total = packet.length;

  for (let offset = 0; offset < total;) {
    if (total - offset < 2) { // TCP split the packet within the 2-byte length header
      encryption.incompleteFrame = packet.subarray(offset);
      break;
    }

    const realDataLength = packet.readUInt16LE(offset);

    const availableDataLength = total - offset - 2 - 16;
    if (realDataLength > availableDataLength) { // Fragmented packet
      encryption.incompleteFrame = packet.subarray(offset);
      break;
    }

    const nonce = Buffer.alloc(8);
    writeUInt64LE(encryption.controllerToAccessoryCount++, nonce, 0);

    const plaintext = chacha20_poly1305_decryptAndVerify(
      encryption.controllerToAccessoryKey,
      nonce,
      packet.subarray(offset,offset+2),
      packet.subarray(offset + 2, offset + 2 + realDataLength),
      packet.subarray(offset + 2 + realDataLength, offset + 2 + realDataLength + 16),
    );
    chunks.push(plaintext);
    offset += (18 + realDataLength);
  }

  return Buffer.concat(chunks);
}
