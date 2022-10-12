import axios, { AxiosError, AxiosResponse } from "axios";
import { SRP, SrpClient } from "fast-srp-hap";
import { Agent } from "http";
import { Socket } from "net";
import tweetnacl, { BoxKeyPair } from "tweetnacl";
import { Accessory } from "./Accessory";
import {
  AccessoriesCallback,
  HAPHTTPCode,
  HAPPairingHTTPCode,
  HAPServer,
  HAPServerEventTypes,
  HAPStatus,
  IdentifyCallback,
  IsKnownHAPStatusError,
  PairCallback,
  PairingStates,
  PairMethods,
  TLVValues,
} from "./HAPServer";
import { AccessoryInfo, PermissionTypes } from "./model/AccessoryInfo";
import { HAPConnection, HAPEncryption } from "./util/eventedhttp";
import * as hapCrypto from "./util/hapCrypto";
import { EncryptedData } from "./util/hapCrypto";
import { awaitEventOnce, PromiseTimeout } from "./util/promise-utils";
import * as tlv from "./util/tlv";

function accessUnderlyingTOPSSocketOfSingletonAgent(httpAgent: Agent) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freeSockets = ((httpAgent as any).freeSockets as Record<string, [Socket]>);
  expect(Object.values(freeSockets).length).toBe(1);
  return Object.values(freeSockets)[0][0];
}

describe("HAPServer", () => {
  const serverUsername = "AA:AA:AA:AA:AA:AA";
  const clientUsername = "BB:BB:BB:BB:BB:BB";

  let accessoryInfoUnpaired: AccessoryInfo;

  let accessoryInfoPaired: AccessoryInfo;
  let clientPrivateKey: Buffer;
  let clientPublicKey: Buffer;

  let httpAgent: Agent;
  let server: HAPServer | undefined;

  async function bindServer(server: HAPServer, port = 0, host = "localhost"): Promise<[port: number, string: string]> {
    const listenPromise: Promise<[number, string]> = awaitEventOnce(server, HAPServerEventTypes.LISTENING);
    server.listen(port, host);
    return await listenPromise;
  }

  beforeEach(() => {
    server = undefined;

    accessoryInfoUnpaired = AccessoryInfo.create(serverUsername);
    // @ts-expect-error: private access
    accessoryInfoUnpaired.setupID = Accessory._generateSetupID();
    accessoryInfoUnpaired.displayName = "Outlet";
    accessoryInfoUnpaired.category = 7;
    accessoryInfoUnpaired.pincode = " 031-45-154";

    accessoryInfoPaired = AccessoryInfo.create(serverUsername);
    // @ts-expect-error: private access
    accessoryInfoPaired.setupID = Accessory._generateSetupID();
    accessoryInfoPaired.displayName = "Outlet";
    accessoryInfoPaired.category = 7;
    accessoryInfoPaired.pincode = " 031-45-154";

    const clientKeyPair = tweetnacl.sign.keyPair();
    clientPrivateKey = Buffer.from(clientKeyPair.secretKey);
    clientPublicKey = Buffer.from(clientKeyPair.publicKey);
    accessoryInfoPaired.addPairedClient(clientUsername, clientPublicKey, PermissionTypes.ADMIN);

    // used to do long living http connections without own tcp interface
    httpAgent = new Agent({
      keepAlive: true,
    });
  });

  afterEach(() => {
    server?.stop();
    server?.destroy();
    server = undefined;
  });

  test("simple unpaired identify", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    const promise: Promise<IdentifyCallback> = awaitEventOnce(server, HAPServerEventTypes.IDENTIFY);

    const request: Promise<AxiosResponse<string>> = axios.post(`http://localhost:${port}/identify`, { httpAgent });

    const callback = await promise;
    callback(); // signal successful identify!

    const response = await request;
    expect(response.data).toBeFalsy();
  });

  test("reject unpaired identify on paired server", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port] = await bindServer(server);

    try {
      const response = await axios.post(`http://localhost:${port}/identify`, { httpAgent });
      fail(`Expected erroneous response, got ${response}`);
    } catch (error) {
      expect(error).toBeInstanceOf(AxiosError);
      expect(error.response?.status).toBe(HAPPairingHTTPCode.BAD_REQUEST);
      expect(error.response?.data).toEqual({ status: HAPStatus.INSUFFICIENT_PRIVILEGES });
    }
  });

  test("test successful /pair-setup", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    // TODO TLVValues, pairing states, pair methods are now public API?

    // TODO HAPServer doesn't check for the post method?

    const pairSetup = new PairSetupClient(port, httpAgent);

    const responseM1 = await pairSetup.sendM1();

    const M2 = pairSetup.parseM2(responseM1.data);

    const M3 = await pairSetup.prepareM3(M2, accessoryInfoUnpaired.pincode);
    const responseM3 = await pairSetup.sendM3(M3);

    const M4 = pairSetup.parseM4(responseM3.data, M3);

    const M5 = pairSetup.prepareM5(M4, {
      username: clientUsername,
      publicKey: clientPublicKey,
      privateKey: clientPrivateKey,
    });

    // listen to the PAIR event on HAPServer
    const pair: Promise<[string, Buffer, PairCallback]> = awaitEventOnce(server, HAPServerEventTypes.PAIR);
    const requestM5 = pairSetup.sendM5(M5);

    // response to the HAPServer event
    const [username, clientLTPK, callback] = await pair;
    expect(username).toEqual(clientUsername);
    expect(clientLTPK).toEqual(clientPublicKey);

    callback();

    const responseM5 = await requestM5;
    pairSetup.parseM6(responseM5.data, M4, M5);
  });

  test("test successful /pair-verify", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);

    // M1
    const responseM1 = await pairVerify.sendM1();

    // M2
    const M2 = pairVerify.parseM2(responseM1.data, {
      username: serverUsername,
      publicKey: accessoryInfoPaired.signPk,
    });

    // M3
    const M3 = pairVerify.prepareM3(M2, {
      username: clientUsername,
      privateKey: clientPrivateKey,
    });

    // step 11 & 12
    const responseM3 = await pairVerify.sendM3(M3);

    // M4
    const M4 = pairVerify.parseM4(responseM3.data, M2);

    // verify that encryption works!
    const encryption = new HAPEncryption(
      accessoryInfoPaired.signPk,
      clientPrivateKey,
      clientPublicKey,
      M2.sharedSecret,
      M2.sessionKey,
    );

    // our HAPCrypto is engineered for the server side, so we have to switch the keys here (deliberately wrongfully)
    // such that hapCrypto uses the controllerToAccessoryKey for encryption!
    encryption.accessoryToControllerKey = M4.controllerToAccessoryKey;
    encryption.controllerToAccessoryKey = M4.accessoryToControllerKey;


    const tcpSocket = accessUnderlyingTOPSSocketOfSingletonAgent(httpAgent);

    const segments: Buffer[] = [];
    const dataListener = (data: Buffer) => {
      // packets shall fit into a single TCP segment, no need to write a parser!
      segments.push(data);
    };
    tcpSocket.on("data", dataListener);

    const accessoriesPromise: Promise<[connection: HAPConnection, callback: AccessoriesCallback]> = awaitEventOnce(server, HAPServerEventTypes.ACCESSORIES);

    // TODO reuse!
    const httpRequest = Buffer.from("GET /accessories HTTP/1.1\r\n" +
      "Accept: application/json, text/plain, */*\r\n" +
      "User-Agent: axios/0.27.2\r\n" +
      "Host: " + address + ":" + port + "\r\n" +
      "Connection: keep-alive\r\n" +
      "\r\n", "ascii");
    tcpSocket.write(hapCrypto.layerEncrypt(httpRequest, encryption));

    const [connection, callback] = await accessoriesPromise;
    expect(connection.encryption).not.toBeUndefined();
    callback(undefined, { accessories: [] }); // we respond with empty accessories!

    await PromiseTimeout(100);

    expect(segments.length).toEqual(1);
    const response = segments[0];

    let plaintext = Buffer.alloc(0);
    expect(() => plaintext = hapCrypto.layerDecrypt(response, encryption)).not.toThrow();
    expect(plaintext.toString().includes("{\"accessories\":[]}")).toBeTruthy();
  });

  // TODO test not paired pair-verify


  test.each(["pairings", "accessories", "characteristics", "prepare", "resource"])(
    "request to \"/%s\" should be rejected in unverified state",
    async (route: string) => {
      const server = new HAPServer(accessoryInfoUnpaired);
      const [port] = await bindServer(server);

      try {
        const response = await axios.post(`http://localhost:${port}/${route}`, { httpAgent });
        fail(`Expected erroneous response, got ${response}`);
      } catch (error) {
        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response?.status).toBe(HAPPairingHTTPCode.CONNECTION_AUTHORIZATION_REQUIRED);
        expect(error.response?.data).toEqual({ status: HAPStatus.INSUFFICIENT_PRIVILEGES });
      }

      server.stop();
    },
  );

  // TODO test for each protected endpoint: access prevented (in paired and unpaired state!)

  test("test non-existence resource", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    try {
      const response = await axios.post(`http://localhost:${port}/non-existent`, { httpAgent });
      fail(`Expected erroneous response, got ${response}`);
    } catch (error) {
      expect(error).toBeInstanceOf(AxiosError);
      expect(error.response?.status).toBe(HAPHTTPCode.NOT_FOUND);
      expect(error.response?.data).toEqual({ status: HAPStatus.RESOURCE_DOES_NOT_EXIST });
    }
  });

});

describe(IsKnownHAPStatusError, () => {
  it("should approve all defined error codes", () => {
    // @ts-expect-error: forceConsistentCasingInFileNames compiler option
    const errorValues = Object.values(HAPStatus)
      .filter(error => typeof error === "number") // .values will actually include both the enum values and enum names
      .filter(error => error !== 0); // filter out HAPStatus.SUCCESS

    for (const error of errorValues) {
      // @ts-expect-error: type mismatch
      const result = IsKnownHAPStatusError(error);
      if (!result) {
        fail("IsKnownHAPStatusError does not return true for error code " + error);
      }
    }
  });

  it("should reject non defined error codes", () => {
    expect(IsKnownHAPStatusError(23)).toBe(false);
    expect(IsKnownHAPStatusError(-3)).toBe(false);
    expect(IsKnownHAPStatusError(-72037)).toBe(false);
    expect(IsKnownHAPStatusError(HAPStatus.SUCCESS)).toBe(false);
  });

  it("should reject invalid user input", () => {
    // @ts-expect-error: deliberate illegal input
    expect(IsKnownHAPStatusError("asdjw")).toBe(false);
    // @ts-expect-error: deliberate illegal input
    expect(IsKnownHAPStatusError({ "key": "value" })).toBe(false);
    // @ts-expect-error: deliberate illegal input
    expect(IsKnownHAPStatusError([])).toBe(false);
  });
});

interface PairSetupM2 {
  serverPublicKey: Buffer;
  salt: Buffer;
}

interface PairSetupM3 {
  srpClient: SrpClient;
}

interface PairSetupM4 {
  sharedSecret: Buffer;
}

interface PairSetupM5 {
  sessionKey: Buffer;
  encryptedData: EncryptedData;
}

class PairSetupClient {
  private readonly port: number;
  private readonly httpAgent: Agent;

  constructor(port: number, httpAgent: Agent) {
    this.port = port;
    this.httpAgent = httpAgent;
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
    // TODO make a `sendRequest`?
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

  prepareM5(m4: PairSetupM4, clientInfo: { username: string, publicKey: Buffer, privateKey: Buffer}): PairSetupM5 {
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

  parseM6(responseM5: Buffer, m4: PairSetupM4, m5: PairSetupM5) {
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
  }
}

interface PairVerifyM2 {
  sharedSecret: Buffer,
  sessionKey: Buffer,
  serverEphemeralPublicKey: Buffer,
}

interface PairVerifyM3 {
  encryptedData: EncryptedData;
}

interface PairVerifyM4 {
  accessoryToControllerKey: Buffer,
  controllerToAccessoryKey: Buffer,
}

class PairVerifyClient {
  private readonly port: number;
  private readonly httpAgent: Agent;

  readonly ephemeralKeyPair: BoxKeyPair;

  constructor(port: number, httpAgent: Agent, ephemeralKeyPair?: BoxKeyPair) {
    this.port = port;
    this.httpAgent = httpAgent;

    this.ephemeralKeyPair = ephemeralKeyPair ?? hapCrypto.generateCurve25519KeyPair();
  }

  sendM1(): Promise<AxiosResponse<Buffer>> {
    return axios.post(
      `http://localhost:${this.port}/pair-verify`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M1,
        TLVValues.PUBLIC_KEY, this.ephemeralKeyPair.publicKey,
      ),
      { httpAgent: this.httpAgent, responseType: "arraybuffer" },
    );
  }

  parseM2(responseM1: Buffer, serverInfo: { username: string, publicKey: Buffer }): PairVerifyM2 {
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
    const cipherTextM2 = encryptedDataM2.slice(0, -16);
    const authTagM2 = encryptedDataM2.slice(-16);

    let plaintextM2 = Buffer.alloc(0);
    expect(() => plaintextM2 = hapCrypto.chacha20_poly1305_decryptAndVerify(
      sessionKey,
      Buffer.from("PV-Msg02"),
      null,
      cipherTextM2,
      authTagM2,
    )).not.toThrow();

    // step 5
    const dataM2 = tlv.decode(plaintextM2);
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

  prepareM3(m2: PairVerifyM2, clientInfo: { username: string, privateKey: Buffer }): PairVerifyM3 {
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

  sendM3(m3: PairVerifyM3): Promise<AxiosResponse<Buffer>> {
    return axios.post(
      `http://localhost:${this.port}/pair-verify`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M3,
        TLVValues.ENCRYPTED_DATA, Buffer.concat([m3.encryptedData.ciphertext, m3.encryptedData.authTag]),
      ),
      { httpAgent: this.httpAgent, responseType: "arraybuffer" },
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
