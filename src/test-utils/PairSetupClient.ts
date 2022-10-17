import axios, { AxiosResponse } from "axios";
import { SRP, SrpClient } from "fast-srp-hap";
import { Agent } from "http";
import tweetnacl from "tweetnacl";
import { PairingStates, PairMethods, TLVValues } from "../internal-types";
import * as hapCrypto from "../lib/util/hapCrypto";
import { EncryptedData } from "../lib/util/hapCrypto";
import * as tlv from "../lib/util/tlv";

export interface PairSetupM2 {
  serverPublicKey: Buffer;
  salt: Buffer;
}

export interface PairSetupM3 {
  srpClient: SrpClient;
}

export interface PairSetupM4 {
  sharedSecret: Buffer;
}

export interface PairSetupM5 {
  sessionKey: Buffer;
  encryptedData: EncryptedData;
}

export interface PairSetupM6 {
  accessoryLTPK: Buffer,
  accessoryIdentifier: string,
}

export interface PairSetupClientInfo {
  username: string;
  publicKey: Buffer;
  privateKey: Buffer
}

export class PairSetupClient {
  private readonly port: number;
  private readonly httpAgent: Agent;

  constructor(port: number, httpAgent: Agent) {
    this.port = port;
    this.httpAgent = httpAgent;
  }

  async sendPairSetup(pincode: string, clientInfo: PairSetupClientInfo): Promise<PairSetupM6> {
    const responseM1 = await this.sendM1();

    const M2 = this.parseM2(responseM1.data);

    const M3 = await this.prepareM3(M2, pincode);
    const responseM3 = await this.sendM3(M3);

    const M4 = this.parseM4(responseM3.data, M3);

    const M5 = this.prepareM5(M4, clientInfo);
    const responseM5 = await this.sendM5(M5);

    return this.parseM6(responseM5.data, M4, M5);
  }

  sendM1(): Promise<AxiosResponse<Buffer>> {
    return axios.post(
      `http://localhost:${this.port}/pair-setup`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M1,
        TLVValues.METHOD, PairMethods.PAIR_SETUP,
      ),
      { httpAgent: this.httpAgent, responseType: "arraybuffer" },
    );
  }

  parseM2(m1Response: Buffer): PairSetupM2 {
    const objectsM2 = tlv.decode(m1Response);
    expect(objectsM2[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM2[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M2);

    return {
      serverPublicKey: objectsM2[TLVValues.PUBLIC_KEY],
      salt: objectsM2[TLVValues.SALT],
    };
  }

  async prepareM3(m2: PairSetupM2, pincode: string): Promise<PairSetupM3> {
    const srpKey = await SRP.genKey(32);
    const srpClient = new SrpClient(SRP.params.hap, m2.salt, Buffer.from("Pair-Setup"), Buffer.from(pincode), srpKey);
    srpClient.setB(m2.serverPublicKey);

    return {
      srpClient,
    };
  }

  sendM3(m3: PairSetupM3): Promise<AxiosResponse<Buffer>> {
    return axios.post(
      `http://localhost:${this.port}/pair-setup`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M3,
        TLVValues.PUBLIC_KEY, m3.srpClient.computeA(),
        TLVValues.PASSWORD_PROOF, m3.srpClient.computeM1(),
      ),
      { httpAgent: this.httpAgent, responseType: "arraybuffer" },
    );
  }

  parseM4(m3Response: Buffer, m3: PairSetupM3): PairSetupM4 {
    const objectsM4 = tlv.decode(m3Response);
    expect(objectsM4[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM4[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M4);

    const serverProof = objectsM4[TLVValues.PASSWORD_PROOF];
    const encryptedDataM4 = objectsM4[TLVValues.ENCRYPTED_DATA];

    expect(() => m3.srpClient.checkM2(serverProof)).not.toThrow();
    expect(encryptedDataM4).toBeUndefined(); // we don't do MFI challenges

    return {
      sharedSecret: m3.srpClient.computeK(),
    };
  }

  prepareM5(m4: PairSetupM4, clientInfo: PairSetupClientInfo): PairSetupM5 {
    const iOSDeviceX = hapCrypto.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Controller-Sign-Salt"),
      m4.sharedSecret,
      Buffer.from("Pair-Setup-Controller-Sign-Info"),
      32,
    );

    const iOSDeviceInfo = Buffer.concat([
      iOSDeviceX,
      Buffer.from(clientInfo.username),
      clientInfo.publicKey,
    ]);

    const iOSDeviceSignature = tweetnacl.sign.detached(iOSDeviceInfo, clientInfo.privateKey);

    const subTLV_M5 = tlv.encode(
      TLVValues.IDENTIFIER, clientInfo.username,
      TLVValues.PUBLIC_KEY, clientInfo.publicKey,
      TLVValues.SIGNATURE, iOSDeviceSignature,
    );

    const sessionKey = hapCrypto.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Encrypt-Salt"),
      m4.sharedSecret,
      Buffer.from("Pair-Setup-Encrypt-Info"),
      32,
    );

    const encrypted = hapCrypto.chacha20_poly1305_encryptAndSeal(sessionKey, Buffer.from("PS-Msg05"), null, subTLV_M5);

    return {
      sessionKey,
      encryptedData: encrypted,
    };
  }

  sendM5(m5: PairSetupM5): Promise<AxiosResponse<Buffer>> {
    return axios.post(
      `http://localhost:${this.port}/pair-setup`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M5,
        TLVValues.ENCRYPTED_DATA, Buffer.concat([m5.encryptedData.ciphertext, m5.encryptedData.authTag]),
      ),
      { httpAgent: this.httpAgent, responseType: "arraybuffer" },
    );
  }

  parseM6(responseM5: Buffer, m4: PairSetupM4, m5: PairSetupM5): PairSetupM6 {
    const objectsM6 = tlv.decode(responseM5);
    expect(objectsM6[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM6[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M6);

    // step 1 & 2
    const encryptedDataTagM6 = objectsM6[TLVValues.ENCRYPTED_DATA];
    const encryptedDataM6 = encryptedDataTagM6.slice(0, -16);
    const authTagM6 = encryptedDataTagM6.slice(-16);

    let plaintextM6 = Buffer.alloc(0);
    expect(() => plaintextM6 = hapCrypto.chacha20_poly1305_decryptAndVerify(
      m5.sessionKey,
      Buffer.from("PS-Msg06"),
      null,
      encryptedDataM6,
      authTagM6,
    )).not.toThrow();

    const subTLV_M6 = tlv.decode(plaintextM6);
    const accessoryIdentifier = subTLV_M6[TLVValues.IDENTIFIER];
    const accessoryLTPK = subTLV_M6[TLVValues.PUBLIC_KEY];
    const accessorySignature = subTLV_M6[TLVValues.SIGNATURE];

    // step 3
    const accessoryX = hapCrypto.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Accessory-Sign-Salt"),
      m4.sharedSecret,
      Buffer.from("Pair-Setup-Accessory-Sign-Info"),
      32,
    );

    const accessoryInfo = Buffer.concat([
      accessoryX,
      accessoryIdentifier,
      accessoryLTPK,
    ]);

    expect(
      tweetnacl.sign.detached.verify(accessoryInfo, accessorySignature, accessoryLTPK),
    ).toEqual(true);

    return {
      accessoryLTPK,
      accessoryIdentifier: accessoryIdentifier.toString(),
    };
  }
}
