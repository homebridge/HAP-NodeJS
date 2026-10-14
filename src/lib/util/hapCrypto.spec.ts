import { HAPEncryption } from "./eventedhttp";
import * as hapCrypto from "./hapCrypto";
import crypto from "crypto";
import tweetnacl from "tweetnacl";

function fromHex(hex: string): Buffer {
  return Buffer.from(hex.trim().replace(/ /g, ""), "hex");
}

/*
 * This test is not to there to test the underlying node crypto / openssl implementation (this is tested well enough)
 * but rather to give some easy validation for future modifications somebody might be doing.
 */

describe("hapCrypto", () => {
  describe("chacha20-poly1305", () => {
    const key = fromHex("09b29329 4514f14e e8437501 674e268f 7d85b193 85d38b54 8f5be259 c678fb52");
    const input = fromHex(
      "48545450 2f312e31 20323030 204f4b0d 0a436f6e 74656e74 2d547970 653a2061 70706c69 636174696f6e2f68 61702b6a" +
      "736f6e0d 0a446174 653a2053 756e2c20 31392041 70722032 30323020 31363a32 323a3238 20474d54 0d0a436f 6e6e6563" +
      "74696f6e 3a206b65 65702d61 6c697665 0d0a5472 616e7366 65722d45 6e636f64 696e673a 20636875 6e6b6564 0d0a0d0a" +
      "33350d0a 7b226368 61726163 74657269 73746963 73223a5b 7b226169 64223a31 2c226969 64223a39 2c227661 6c756522" +
      "3a66616c 73657d5d 7d0d0a30 0d0a0d0a",
    );
    const nonce = fromHex("08000000 00000000");
    const aad = fromHex("d000");
    const tag = fromHex("8e4c1272 16827838 8a155757 d34a851a");
    const output = fromHex(
      "6e62d95a 0811739b f21f4135 00da6a77 a5eb013f d9fe70ce 1c7a4c95 c06eee64 7ffe2dd6 ab58bce8 6d911959 4a11defa" +
      "e4162a4e 9d3240ca 36956854 e6150377 b54e4ac9 f98d7607 4331ac06 54e0abaa 76006d43 aecb3638 60952e58 3708ca26" +
      "959bccf9 4bb255de 31286989 faf82ec6 99cf7abe dc4c3544 210b1e35 4d323a72 ed197d1b e584a1d6 42931ced e20376d8" +
      "31bb3eea 7d3b307c 432d5b10 9b30b1cf 3e0bba23 712695a6 9e6e66b9 7db4ac45 3c49c6de 2c5b3139 ca5c9fef 07bf805d" +
      "8cc99047 ad94b0cf 33eac227 b1211074",
    );

    it("should encrypt chacha20-poly1305 correctly", () => {
      const encrypted = hapCrypto.chacha20_poly1305_encryptAndSeal(key, nonce, aad, input);
      expect(encrypted.ciphertext.toString("hex")).toBe(output.toString("hex"));
      expect(encrypted.authTag.toString("hex")).toBe(tag.toString("hex"));
    });

    it("should decrypt chacha20-poly1305 correctly", () => {
      const plaintext = hapCrypto.chacha20_poly1305_decryptAndVerify(key, nonce, aad, output, tag);
      expect(plaintext.toString("hex")).toBe(input.toString("hex"));
    });

    it("should fail verification on manipulated data", () => {
      const manipulated = Buffer.alloc(output.length);
      output.copy(manipulated);
      manipulated[3] = 5;

      expect(() => hapCrypto.chacha20_poly1305_decryptAndVerify(key, nonce, aad, manipulated, tag)).toThrow();
    });
  });

  describe("HKDF", () => {
    it("should calculate test vector correctly", () => {
      const ikm = fromHex("0b0b0b0b 0b0b0b0b 0b0b0b0b 0b0b0b0b 0b0b0b0b 0b0b");
      const salt = fromHex("00010203 04050607 08090a0b 0c");
      const info = Buffer.alloc(0);

      const result = fromHex("f81b8748 1a18b664 936daeb2 22f58cba 0ebc55f5 c85996b9 f1cb396c 327b70bb");

      const hkdf = hapCrypto.HKDF("sha512", salt, ikm, info, 32);
      expect(hkdf.toString("hex")).toBe(result.toString("hex"));
    });
  });

  describe("layer encryption", () => {
    let serverEncryption: HAPEncryption;
    let clientEncryption: HAPEncryption;

    const message0 = Buffer.from("Hello World");
    const message1 = Buffer.from("Hello Mars");
    const message2 = Buffer.from("Foo");
    const message3 = Buffer.from("Bar");

    beforeEach(() => {
      const salt = Buffer.from("Test-Salt");
      const readInfo = Buffer.from("Control-Read-Encryption-Key");
      const writeInfo = Buffer.from("Control-Write-Encryption-Key");

      const sharedSecret = crypto.randomBytes(32);

      const accessoryToControllerKey = hapCrypto.HKDF("sha512", salt, sharedSecret, readInfo, 32);
      const controllerToAccessoryKey = hapCrypto.HKDF("sha512", salt, sharedSecret, writeInfo, 32);

      const empty = Buffer.alloc(0);
      serverEncryption = new HAPEncryption(empty, empty, empty, sharedSecret, empty);
      clientEncryption = new HAPEncryption(empty, empty, empty, sharedSecret, empty);

      serverEncryption.accessoryToControllerKey = accessoryToControllerKey;
      serverEncryption.controllerToAccessoryKey = controllerToAccessoryKey;

      clientEncryption.accessoryToControllerKey = controllerToAccessoryKey;
      clientEncryption.controllerToAccessoryKey = accessoryToControllerKey;
    });

    test("simple encryption and decryption", () => {
      const encrypted = hapCrypto.layerEncrypt(message0, serverEncryption);

      const decrypted = hapCrypto.layerDecrypt(encrypted, clientEncryption);
      expect(decrypted).toEqual(message0);
    });

    test("multiple frames encryption and decryption", () => {
      const encrypted0 = hapCrypto.layerEncrypt(message0, serverEncryption);
      const encrypted1 = hapCrypto.layerEncrypt(message1, serverEncryption);
      const encrypted2 = hapCrypto.layerEncrypt(message2, serverEncryption);

      const decrypted = hapCrypto.layerDecrypt(Buffer.concat([encrypted0, encrypted1, encrypted2]), clientEncryption);
      expect(decrypted).toEqual(Buffer.concat([message0, message1, message2]));
    });

    test("multiple frames encryption and decryption intertwined", () => {
      const S_encrypted0 = hapCrypto.layerEncrypt(message0, serverEncryption);
      const S_encrypted1 = hapCrypto.layerEncrypt(message1, serverEncryption);
      const S_encrypted2 = hapCrypto.layerEncrypt(message2, serverEncryption);

      const C_encrypted0 = hapCrypto.layerEncrypt(message1, clientEncryption);
      const C_encrypted1 = hapCrypto.layerEncrypt(message3, clientEncryption);

      const S_decrypted = hapCrypto.layerDecrypt(Buffer.concat([S_encrypted0, S_encrypted1, S_encrypted2]), clientEncryption);
      expect(S_decrypted).toEqual(Buffer.concat([message0, message1, message2]));

      const C_decrypted = hapCrypto.layerDecrypt(Buffer.concat([C_encrypted0, C_encrypted1]), serverEncryption);
      expect(C_decrypted).toEqual(Buffer.concat([message1, message3]));
    });

    test("large message encryption and decryption (multi-chunk)", () => {
      // Message larger than 0x400 (1024) bytes forces multiple chunks
      const largeMessage = crypto.randomBytes(3000);
      const encrypted = hapCrypto.layerEncrypt(largeMessage, serverEncryption);
      const decrypted = hapCrypto.layerDecrypt(encrypted, clientEncryption);
      expect(decrypted).toEqual(largeMessage);
    });

    test("incomplete frames decryption; first", () => {
      const S_encrypted0 = hapCrypto.layerEncrypt(message0, serverEncryption);
      const S_encrypted1 = hapCrypto.layerEncrypt(message1, serverEncryption);
      const S_encrypted2 = hapCrypto.layerEncrypt(message2, serverEncryption);

      const C_encrypted0 = hapCrypto.layerEncrypt(message2, clientEncryption);
      const C_encrypted1 = hapCrypto.layerEncrypt(message3, clientEncryption);

      expect(hapCrypto.layerDecrypt(C_encrypted0.subarray(0, 5), serverEncryption)).toEqual(Buffer.alloc(0));

      const S_decrypted0 = hapCrypto.layerDecrypt(
        Buffer.concat([S_encrypted0, S_encrypted1.subarray(0, 5)]),
        clientEncryption,
      );
      expect(S_decrypted0).toEqual(message0);

      const C_decrypted = hapCrypto.layerDecrypt(
        Buffer.concat([C_encrypted0.subarray(5), C_encrypted1]),
        serverEncryption,
      );
      expect(C_decrypted).toEqual(Buffer.concat([message2, message3]));

      const S_decrypted1 = hapCrypto.layerDecrypt(
        Buffer.concat([S_encrypted1.subarray(5), S_encrypted2]),
        clientEncryption,
      );
      expect(S_decrypted1).toEqual(Buffer.concat([message1, message2]));
    });
  });

  describe("curve25519", () => {
    // RFC 7748, section 6.1
    const alicePrivate = fromHex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
    const alicePublic = fromHex("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
    const bobPrivate = fromHex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
    const bobPublic = fromHex("de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
    const shared = fromHex("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742");

    it("should compute the shared secret of the RFC 7748 test vector", () => {
      expect(Buffer.from(hapCrypto.generateCurve25519SharedSecKey(alicePrivate, bobPublic))).toEqual(shared);
      expect(Buffer.from(hapCrypto.generateCurve25519SharedSecKey(bobPrivate, alicePublic))).toEqual(shared);
    });

    it("should generate key pairs whose public key belongs to the secret key", () => {
      for (let i = 0; i < 10; i++) {
        const keyPair = hapCrypto.generateCurve25519KeyPair();
        expect(keyPair.secretKey.length).toBe(32);
        expect(Buffer.from(keyPair.publicKey)).toEqual(Buffer.from(tweetnacl.scalarMult.base(keyPair.secretKey)));
      }
    });

    it("should compute the same shared secret as tweetnacl", () => {
      for (let i = 0; i < 10; i++) {
        const ours = hapCrypto.generateCurve25519KeyPair();
        const theirs = tweetnacl.box.keyPair();
        expect(Buffer.from(hapCrypto.generateCurve25519SharedSecKey(ours.secretKey, theirs.publicKey)))
          .toEqual(Buffer.from(tweetnacl.scalarMult(theirs.secretKey, ours.publicKey)));
      }
    });

    it("should return zeros for a public key of small order, like tweetnacl", () => {
      const secretKey = hapCrypto.generateCurve25519KeyPair().secretKey;
      // points of small order (0, 1, a point of order 8, p - 1)
      const smallOrder = [
        "0000000000000000000000000000000000000000000000000000000000000000",
        "0100000000000000000000000000000000000000000000000000000000000000",
        "e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800",
        "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
      ].map(fromHex);
      for (const publicKey of smallOrder) {
        expect(Buffer.from(hapCrypto.generateCurve25519SharedSecKey(secretKey, publicKey))).toEqual(Buffer.alloc(32));
        expect(Buffer.from(tweetnacl.scalarMult(secretKey, publicKey))).toEqual(Buffer.alloc(32));
      }
    });

    it("should reject keys of the wrong size", () => {
      expect(() => hapCrypto.generateCurve25519SharedSecKey(Buffer.alloc(31), alicePublic)).toThrow();
      expect(() => hapCrypto.generateCurve25519SharedSecKey(alicePrivate, Buffer.alloc(33))).toThrow();
    });
  });

  describe("ed25519", () => {
    // RFC 8032, section 7.1, TEST 1 and TEST 2
    const vectors = [
      {
        seed: fromHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"),
        publicKey: fromHex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"),
        message: Buffer.alloc(0),
        signature: fromHex(
          "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
        ),
      },
      {
        seed: fromHex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"),
        publicKey: fromHex("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c"),
        message: fromHex("72"),
        signature: fromHex(
          "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
        ),
      },
    ];

    it("should sign and verify the RFC 8032 test vectors", () => {
      for (const vector of vectors) {
        const secretKey = Buffer.concat([vector.seed, vector.publicKey]);
        expect(hapCrypto.ed25519Sign(vector.message, secretKey)).toEqual(vector.signature);
        expect(hapCrypto.ed25519Verify(vector.message, vector.signature, vector.publicKey)).toBe(true);
      }
    });

    it("should generate key pairs in the layout of tweetnacl", () => {
      const keyPair = hapCrypto.generateEd25519KeyPair();
      expect(keyPair.secretKey.length).toBe(64);
      const fromSeed = tweetnacl.sign.keyPair.fromSeed(keyPair.secretKey.subarray(0, 32));
      expect(Buffer.from(keyPair.publicKey)).toEqual(Buffer.from(fromSeed.publicKey));
      expect(Buffer.from(keyPair.secretKey)).toEqual(Buffer.from(fromSeed.secretKey));
    });

    it("should sign like tweetnacl and verify the signatures of tweetnacl", () => {
      for (let i = 0; i < 10; i++) {
        const keyPair = tweetnacl.sign.keyPair();
        const message = crypto.randomBytes(i * 17);
        const signature = tweetnacl.sign.detached(message, keyPair.secretKey);
        expect(hapCrypto.ed25519Sign(message, keyPair.secretKey)).toEqual(Buffer.from(signature));
        expect(hapCrypto.ed25519Verify(message, signature, keyPair.publicKey)).toBe(true);
      }
    });

    it("should not verify a changed message, another key or a public key that is no point on the curve", () => {
      const keyPair = hapCrypto.generateEd25519KeyPair();
      const message = crypto.randomBytes(64);
      const signature = hapCrypto.ed25519Sign(message, keyPair.secretKey);
      const changed = Buffer.from(message);
      changed[0] ^= 1;
      expect(hapCrypto.ed25519Verify(changed, signature, keyPair.publicKey)).toBe(false);
      expect(hapCrypto.ed25519Verify(message, signature, hapCrypto.generateEd25519KeyPair().publicKey)).toBe(false);
      for (let i = 0; i < 10; i++) {
        const publicKey = crypto.randomBytes(32);
        expect(hapCrypto.ed25519Verify(message, signature, publicKey)).toBe(tweetnacl.sign.detached.verify(message, signature, publicKey));
      }
    });

    it("should not verify a signature or public key of the wrong size", () => {
      const keyPair = hapCrypto.generateEd25519KeyPair();
      const message = crypto.randomBytes(16);
      const signature = hapCrypto.ed25519Sign(message, keyPair.secretKey);
      expect(hapCrypto.ed25519Verify(message, signature.subarray(0, 63), keyPair.publicKey)).toBe(false);
      expect(hapCrypto.ed25519Verify(message, signature, keyPair.publicKey.subarray(0, 31))).toBe(false);
      expect(() => hapCrypto.ed25519Sign(message, keyPair.secretKey.subarray(0, 32))).toThrow();
    });
  });
});
