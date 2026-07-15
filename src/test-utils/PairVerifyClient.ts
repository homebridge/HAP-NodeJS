import tweetnacl, { BoxKeyPair } from "tweetnacl";
import { HAPMimeTypes, PairingStates, TLVValues } from "../internal-types";
import { HAPPairingHTTPCode } from "../lib/HAPServer";
import { HAPEncryption } from "../lib/util/eventedhttp";
import * as hapCrypto from "../lib/util/hapCrypto";
import { EncryptedData } from "../lib/util/hapCrypto";
import * as tlv from "../lib/util/tlv";
import { HAPHTTPClient, HTTPResponse } from "./HAPHTTPClient";

export interface PairVerifyM2 {
  sharedSecret: Buffer,
  sessionKey: Buffer,
  serverEphemeralPublicKey: Buffer,
}

export interface PairVerifyM3 {
  encryptedData: EncryptedData;
}

export interface PairVerifyM4 {
  accessoryToControllerKey: Buffer,
  controllerToAccessoryKey: Buffer,
}

export interface PairVerifyServerInfo {
  username: string;
  publicKey: Buffer;
}

export interface PairVerifyClientInfo {
  username: string;
  privateKey: Buffer;
}

/**
 * Drives the pair-verify handshake over a {@link HAPHTTPClient}'s owned connection. The session keys derived by the
 * handshake are bound server-side to the exact HAPConnection it ran on, so riding the client's socket - the same socket
 * that will carry the encrypted session afterwards - is a correctness requirement, not a convenience.
 */
export class PairVerifyClient {
  private readonly client: HAPHTTPClient;

  readonly ephemeralKeyPair: BoxKeyPair;

  constructor(client: HAPHTTPClient, ephemeralKeyPair?: BoxKeyPair) {
    this.client = client;

    this.ephemeralKeyPair = ephemeralKeyPair ?? hapCrypto.generateCurve25519KeyPair();
  }

  async sendPairVerify(serverInfo: PairVerifyServerInfo, clientInfo: PairVerifyClientInfo & { publicKey: Buffer }): Promise<HAPEncryption> {
    // This is the success-path orchestrator, so both hops must come back 200 OK - the TLV payload assertions in the
    // parse steps do not pin the HTTP status on their own.
    // M1
    const responseM1 = await this.sendM1();
    expect(responseM1.statusCode).toBe(HAPPairingHTTPCode.OK);

    // M2
    const M2 = this.parseM2(responseM1.body, serverInfo);

    // M3
    const M3 = this.prepareM3(M2, clientInfo);

    // step 11 & 12
    const responseM3 = await this.sendM3(M3);
    expect(responseM3.statusCode).toBe(HAPPairingHTTPCode.OK);

    // M4
    const M4 = this.parseM4(responseM3.body, M2);

    // verify that encryption works!
    const encryption = new HAPEncryption(
      serverInfo.publicKey,
      clientInfo.privateKey,
      clientInfo.publicKey,
      M2.sharedSecret,
      M2.sessionKey,
    );

    // our HAPCrypto is engineered for the server side, so we have to switch the keys here (deliberately wrongfully)
    // such that hapCrypto uses the controllerToAccessoryKey for encryption!
    encryption.accessoryToControllerKey = M4.controllerToAccessoryKey;
    encryption.controllerToAccessoryKey = M4.accessoryToControllerKey;

    return encryption;
  }

  sendM1(): Promise<HTTPResponse> {
    return this.client.writeHTTPRequest(
      "POST",
      "/pair-verify",
      tlv.encode(
        TLVValues.STATE, PairingStates.M1,
        TLVValues.PUBLIC_KEY, this.ephemeralKeyPair.publicKey,
      ),
      { contentType: HAPMimeTypes.PAIRING_TLV8 },
    );
  }

  parseM2(responseM1: Buffer, serverInfo: PairVerifyServerInfo): PairVerifyM2 {
    const objectsM2 = tlv.decode(responseM1);
    expect(objectsM2[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM2[TLVValues.STATE].readUInt8(0)).toBe(PairingStates.M2);

    const serverPublicKey_M2 = objectsM2[TLVValues.PUBLIC_KEY];
    const encryptedDataM2 = objectsM2[TLVValues.ENCRYPTED_DATA];

    // step 1
    const sharedSecret = Buffer.from(hapCrypto.generateCurve25519SharedSecKey(
      this.ephemeralKeyPair.secretKey,
      serverPublicKey_M2,
    ));
    // step 2
    const sessionKey = hapCrypto.HKDF(
      "sha512",
      Buffer.from("Pair-Verify-Encrypt-Salt"),
      sharedSecret,
      Buffer.from("Pair-Verify-Encrypt-Info"),
      32,
    );

    // step 3 & 4
    const cipherTextM2 = encryptedDataM2.subarray(0, -16);
    const authTagM2 = encryptedDataM2.subarray(-16);

    let plaintextM2: Buffer;
    expect(() => {
      const result = hapCrypto.chacha20_poly1305_decryptAndVerify(
        sessionKey,
        Buffer.from("PV-Msg02"),
        null,
        cipherTextM2,
        authTagM2,
      );
      plaintextM2 = Buffer.from(result);
    }).not.toThrow();

    // step 5
    const dataM2 = tlv.decode(plaintextM2!);
    const accessoryIdentifier = dataM2[TLVValues.IDENTIFIER];
    const accessorySignature = dataM2[TLVValues.SIGNATURE];
    expect(accessoryIdentifier.toString()).toEqual(serverInfo.username);

    // step 6
    const accessoryInfo = Buffer.concat([
      serverPublicKey_M2,
      accessoryIdentifier,
      this.ephemeralKeyPair.publicKey,
    ]);

    expect(
      tweetnacl.sign.detached.verify(accessoryInfo, accessorySignature, serverInfo.publicKey),
    ).toBeTruthy();

    return {
      sharedSecret,
      sessionKey,
      serverEphemeralPublicKey: serverPublicKey_M2,
    };
  }

  prepareM3(m2: PairVerifyM2, clientInfo: PairVerifyClientInfo): PairVerifyM3 {
    // step 7
    const iOSDeviceInfo = Buffer.concat([
      this.ephemeralKeyPair.publicKey,
      Buffer.from(clientInfo.username),
      m2.serverEphemeralPublicKey,
    ]);

    // step 8
    const iOSDeviceSignature = Buffer.from(
      tweetnacl.sign.detached(iOSDeviceInfo, clientInfo.privateKey),
    );

    // step 9
    const plainTextTLV_M3 = tlv.encode(
      TLVValues.IDENTIFIER, clientInfo.username,
      TLVValues.SIGNATURE, iOSDeviceSignature,
    );

    // step 10
    const encrypted_M3 = hapCrypto.chacha20_poly1305_encryptAndSeal(
      m2.sessionKey,
      Buffer.from("PV-Msg03"),
      null,
      plainTextTLV_M3,
    );

    return {
      encryptedData: encrypted_M3,
    };
  }

  sendM3(m3: PairVerifyM3): Promise<HTTPResponse> {
    return this.client.writeHTTPRequest(
      "POST",
      "/pair-verify",
      tlv.encode(
        TLVValues.STATE, PairingStates.M3,
        TLVValues.ENCRYPTED_DATA, Buffer.concat([m3.encryptedData.ciphertext, m3.encryptedData.authTag]),
      ),
      { contentType: HAPMimeTypes.PAIRING_TLV8 },
    );
  }

  parseM4(responseM3: Buffer, m2: PairVerifyM2): PairVerifyM4 {
    const objectsM4 = tlv.decode(responseM3);
    expect(objectsM4[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM4[TLVValues.STATE].readUInt8(0)).toBe(PairingStates.M4);

    const salt = Buffer.from("Control-Salt");
    const accessoryToControllerKey = hapCrypto.HKDF(
      "sha512",
      salt,
      m2.sharedSecret,
      Buffer.from("Control-Read-Encryption-Key"),
      32,
    );
    const controllerToAccessoryKey = hapCrypto.HKDF(
      "sha512",
      salt,
      m2.sharedSecret,
      Buffer.from("Control-Write-Encryption-Key"),
      32,
    );

    return {
      accessoryToControllerKey,
      controllerToAccessoryKey,
    };
  }
}
