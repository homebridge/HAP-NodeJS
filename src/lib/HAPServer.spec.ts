import axios, { AxiosError, AxiosResponse } from "axios";
import { SRP, SrpClient } from "fast-srp-hap";
import { Agent } from "http";
import tweetnacl from "tweetnacl";
import { Accessory } from "./Accessory";
import {
  HAPHTTPCode,
  HAPPairingHTTPCode,
  HAPServer,
  HAPServerEventTypes,
  HAPStatus,
  IdentifyCallback,
  IsKnownHAPStatusError, PairCallback,
  PairingStates, PairMethods, TLVValues,
} from "./HAPServer";
import { AccessoryInfo, PermissionTypes } from "./model/AccessoryInfo";
import { awaitEventOnce } from "./util/promise-utils";
import * as tlv from "./util/tlv";
import * as hapCrypto from "./util/hapCrypto";

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

    // M1
    const responseM1 = await axios.post(
      `http://localhost:${port}/pair-setup`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M1,
        TLVValues.METHOD, PairMethods.PAIR_SETUP,
      ),
      { httpAgent, responseType: "arraybuffer" },
    );

    // M2
    const objectsM2 = tlv.decode(responseM1.data);
    expect(objectsM2[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM2[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M2);

    const serverPublicKey = objectsM2[TLVValues.PUBLIC_KEY];
    const salt = objectsM2[TLVValues.SALT];

    // M3
    const srpKey = await SRP.genKey(32);
    const srpClient = new SrpClient(SRP.params.hap, salt, Buffer.from("Pair-Setup"), Buffer.from(accessoryInfoUnpaired.pincode), srpKey);
    srpClient.setB(serverPublicKey);
    const A = srpClient.computeA(); // TODO inline?
    const M1 = srpClient.computeM1();

    const responseM3 = await axios.post(
      `http://localhost:${port}/pair-setup`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M3,
        TLVValues.PUBLIC_KEY, A,
        TLVValues.PASSWORD_PROOF, M1,
      ),
      { httpAgent, responseType: "arraybuffer" },
    );

    // M4
    const objectsM4 = tlv.decode(responseM3.data);
    expect(objectsM4[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM4[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M4);

    const serverProof = objectsM4[TLVValues.PASSWORD_PROOF];
    const encryptedDataM4 = objectsM4[TLVValues.ENCRYPTED_DATA];

    expect(() => srpClient.checkM2(serverProof)).not.toThrow();
    expect(encryptedDataM4).toBeUndefined(); // we don't do MFI challenges

    const sharedSecret = srpClient.computeK();

    // M5
    const iOSDeviceX = hapCrypto.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Controller-Sign-Salt"),
      sharedSecret,
      Buffer.from("Pair-Setup-Controller-Sign-Info"),
      32,
    );

    const iOSDeviceInfo = Buffer.concat([
      iOSDeviceX,
      Buffer.from(clientUsername),
      clientPublicKey,
    ]);

    const iOSDeviceSignature = tweetnacl.sign.detached(iOSDeviceInfo, clientPrivateKey);

    const subTLV_M5 = tlv.encode(
      TLVValues.IDENTIFIER, clientUsername,
      TLVValues.PUBLIC_KEY, clientPublicKey,
      TLVValues.SIGNATURE, iOSDeviceSignature,
    );

    const sessionKey = hapCrypto.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Encrypt-Salt"),
      sharedSecret,
      Buffer.from("Pair-Setup-Encrypt-Info"),
      32,
    );

    const encrypted = hapCrypto.chacha20_poly1305_encryptAndSeal(sessionKey, Buffer.from("PS-Msg05"), null, subTLV_M5);


    const pair: Promise<[string, Buffer, PairCallback]> = awaitEventOnce(server, HAPServerEventTypes.PAIR);
    const requestM5 = axios.post(
      `http://localhost:${port}/pair-setup`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M5,
        TLVValues.ENCRYPTED_DATA, Buffer.concat([encrypted.ciphertext, encrypted.authTag]),
      ),
      { httpAgent, responseType: "arraybuffer" },
    );

    // M6
    const [username, clientLTPK, callback] = await pair;
    expect(username).toEqual(clientUsername);
    expect(clientLTPK).toEqual(clientPublicKey);
    callback();

    const responseM6 = await requestM5;

    const objectsM6 = tlv.decode(responseM6.data);
    expect(objectsM6[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM6[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M6);

    // step 1 & 2
    const encryptedDataTagM6 = objectsM6[TLVValues.ENCRYPTED_DATA];
    const encryptedDataM6 = encryptedDataTagM6.slice(0, -16);
    const authTagM6 = encryptedDataTagM6.slice(-16);

    let plaintextM6 = Buffer.alloc(0);
    expect(() => plaintextM6 = hapCrypto.chacha20_poly1305_decryptAndVerify(
      sessionKey,
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
      sharedSecret,
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


    // TODO verify pair-setup!!!
  });

  test("test successful /pair-verify", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port] = await bindServer(server);

    const ephemeralKeyPair = hapCrypto.generateCurve25519KeyPair();

    // M1
    const responseM1 = await axios.post(
      `http://localhost:${port}/pair-verify`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M1,
        TLVValues.PUBLIC_KEY, ephemeralKeyPair.publicKey,
      ),
      { httpAgent, responseType: "arraybuffer" },
    );

    // M2
    const objectsM2 = tlv.decode(responseM1.data);
    expect(objectsM2[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM2[TLVValues.STATE].readUInt8(0)).toBe(PairingStates.M2);

    const serverPublicKey_M2 = objectsM2[TLVValues.PUBLIC_KEY];
    const encryptedDataM2 = objectsM2[TLVValues.ENCRYPTED_DATA];

    // step 1
    const sharedSecret = Buffer.from(hapCrypto.generateCurve25519SharedSecKey(
      ephemeralKeyPair.secretKey,
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
    expect(accessoryIdentifier.toString()).toEqual(serverUsername);

    // step 6
    const accessoryInfo = Buffer.concat([
      serverPublicKey_M2,
      accessoryIdentifier,
      ephemeralKeyPair.publicKey,
    ]);

    expect(
      tweetnacl.sign.detached.verify(accessoryInfo, accessorySignature, accessoryInfoPaired.signPk),
    ).toBeTruthy();

    // M3
    // step 7
    const iOSDeviceInfo = Buffer.concat([
      ephemeralKeyPair.publicKey,
      Buffer.from(clientUsername),
      serverPublicKey_M2,
    ]);

    // step 8
    const iOSDeviceSignature = Buffer.from(
      tweetnacl.sign.detached(iOSDeviceInfo, clientPrivateKey),
    );

    // step 9
    const plainTextTLV_M3 = tlv.encode(
      TLVValues.IDENTIFIER, clientUsername,
      TLVValues.SIGNATURE, iOSDeviceSignature,
    );

    // step 10
    const encrypted_M3 = hapCrypto.chacha20_poly1305_encryptAndSeal(
      sessionKey,
      Buffer.from("PV-Msg03"),
      null,
      plainTextTLV_M3,
    );

    // step 11 & 12
    const responseM3 = await axios.post(
      `http://localhost:${port}/pair-verify`,
      tlv.encode(
        TLVValues.STATE, PairingStates.M3,
        TLVValues.ENCRYPTED_DATA, Buffer.concat([encrypted_M3.ciphertext, encrypted_M3.authTag]),
      ),
      { httpAgent, responseType: "arraybuffer" },
    );

    // M4
    const objectsM4 = tlv.decode(responseM3.data);
    expect(objectsM4[TLVValues.ERROR_CODE]).toBeUndefined();
    expect(objectsM4[TLVValues.STATE].readUInt8(0)).toBe(PairingStates.M4);

    const salt = Buffer.from("Control-Salt");
    const accessoryToControllerKey = hapCrypto.HKDF(
      "sha512",
      salt,
      sharedSecret,
      Buffer.from("Control-Read-Encryption-Key"),
      32,
    );
    const controllerToAccessoryKey = hapCrypto.HKDF(
      "sha512",
      salt,
      sharedSecret,
      Buffer.from("Control-Write-Encryption-Key"),
      32,
    );

    // TODO test that encryption works!!!
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

  // TODO test for each protected endpoint: access prevented (in paired and unpaired state!)
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
