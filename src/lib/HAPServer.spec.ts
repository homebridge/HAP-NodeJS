import axios, { AxiosError, AxiosResponse } from "axios";
import crypto from "crypto";
import { Agent } from "http";
import tweetnacl from "tweetnacl";
import { CharacteristicReadData } from "../internal-types";
import { HTTPClient } from "../test-utils/HTTPClient";
import { PairSetupClient } from "../test-utils/PairSetupClient";
import { PairVerifyClient } from "../test-utils/PairVerifyClient";
import { Accessory } from "./Accessory";
import { Characteristic } from "./Characteristic";
import {
  HAPHTTPCode,
  HAPPairingHTTPCode,
  HAPServer,
  HAPServerEventTypes,
  HAPStatus,
  IdentifyCallback,
  IsKnownHAPStatusError,
  PairingStates,
  PairMethods,
  TLVErrorCode,
  TLVValues,
} from "./HAPServer";
import { AccessoryInfo, PermissionTypes } from "./model/AccessoryInfo";
import * as hapCrypto from "./util/hapCrypto";
import { awaitEventOnce, PromiseTimeout } from "./util/promise-utils";
import * as tlv from "./util/tlv";

describe("HAPServer", () => {
  const serverUsername = "AA:AA:AA:AA:AA:AA";
  const clientUsername = "BB:BB:BB:BB:BB:BB";
  const thirdUsername = "CC:CC:CC:CC:CC:CC";

  let accessoryInfoUnpaired: AccessoryInfo;
  const serverInfoUnpaired = {
    username: serverUsername,
    publicKey: Buffer.alloc(0),
  };

  let accessoryInfoPaired: AccessoryInfo;
  const serverInfoPaired = {
    username: serverUsername,
    publicKey: Buffer.alloc(0),
  };

  const clientInfo = {
    username: clientUsername,
    privateKey: Buffer.alloc(0),
    publicKey: Buffer.alloc(0),
  };

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
    serverInfoUnpaired.publicKey = accessoryInfoUnpaired.signPk;

    accessoryInfoPaired = AccessoryInfo.create(serverUsername);
    // @ts-expect-error: private access
    accessoryInfoPaired.setupID = Accessory._generateSetupID();
    accessoryInfoPaired.displayName = "Outlet";
    accessoryInfoPaired.category = 7;
    accessoryInfoPaired.pincode = " 031-45-154";
    serverInfoPaired.publicKey = accessoryInfoPaired.signPk;

    const clientKeyPair = tweetnacl.sign.keyPair();
    clientInfo.privateKey = Buffer.from(clientKeyPair.secretKey);
    clientInfo.publicKey = Buffer.from(clientKeyPair.publicKey);
    accessoryInfoPaired.addPairedClient(clientUsername, clientInfo.publicKey, PermissionTypes.ADMIN);

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

  test("test-utils successful /pair-setup", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    // TODO TLVValues, pairing states, pair methods are now public API?

    // TODO HAPServer doesn't check for the post method?

    server.on(HAPServerEventTypes.PAIR, (username, clientLTPK, callback) => {
      expect(username).toEqual(clientUsername);
      expect(clientLTPK).toEqual(clientInfo.publicKey);
      callback();
    });

    const pairSetup = new PairSetupClient(port, httpAgent);

    const M6 = await pairSetup.sendPairSetup(accessoryInfoPaired.pincode, clientInfo);

    expect(M6.accessoryIdentifier).toEqual(serverUsername);
    expect(M6.accessoryLTPK).toEqual(accessoryInfoUnpaired.signPk);
  });

  test("reject pair-setup after already paired", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port] = await bindServer(server);

    const pairSetup = new PairSetupClient(port, httpAgent);

    const response = await pairSetup.sendM1();
    const objectsM2 = tlv.decode(response.data);
    expect(objectsM2[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M2);
    expect(objectsM2[TLVValues.ERROR_CODE].readUInt8(0)).toEqual(TLVErrorCode.UNAVAILABLE);
  });

  test("reject pair-setup with state M3", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    const pairSetup = new PairSetupClient(port, httpAgent);

    const M3 = await pairSetup.prepareM3({
      salt: crypto.randomBytes(16),
      serverPublicKey: crypto.randomBytes(384),
    }, accessoryInfoUnpaired.pincode);

    try {
      const response = await pairSetup.sendM3(M3);
      fail(`Expected erroneous response, got ${response}`);
    } catch (error) {
      expect(error).toBeInstanceOf(AxiosError);
      expect(error.response?.status).toBe(HAPHTTPCode.BAD_REQUEST);

      const objectsM4 = tlv.decode(error.response?.data);
      expect(objectsM4[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M4);
      expect(objectsM4[TLVValues.ERROR_CODE].readUInt8(0)).toEqual(TLVErrorCode.UNKNOWN);
    }
  });

  test("reject pair-setup with state M5", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    const pairSetup = new PairSetupClient(port, httpAgent);

    const M5 = await pairSetup.prepareM5({ sharedSecret: crypto.randomBytes(256) }, clientInfo);

    try {
      const response = await pairSetup.sendM5(M5);
      fail(`Expected erroneous response, got ${response}`);
    } catch (error) {
      expect(error).toBeInstanceOf(AxiosError);
      expect(error.response?.status).toBe(HAPHTTPCode.BAD_REQUEST);

      const objectsM4 = tlv.decode(error.response?.data);
      expect(objectsM4[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M6);
      expect(objectsM4[TLVValues.ERROR_CODE].readUInt8(0)).toEqual(TLVErrorCode.UNKNOWN);
    }
  });

  // TODO test 100 tries?

  // TODO reject second pair-setup while one is going on?

  test("test successful /pair-verify", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);
  });

  // TODO test-utils not paired pair-verify

  test("test /pairings ADD_PAIRING", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    server.on(HAPServerEventTypes.ADD_PAIRING, (connection, username, publicKey, permission, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      expect(username).toEqual(thirdUsername);
      expect(publicKey).toEqual(Buffer.alloc(32, 0));
      expect(permission).toEqual(PermissionTypes.ADMIN);
      callback(0);
    });

    const requestTLV = tlv.encode(
      TLVValues.METHOD, PairMethods.ADD_PAIRING,
      TLVValues.STATE, PairingStates.M1,
      TLVValues.IDENTIFIER, thirdUsername,
      TLVValues.PUBLIC_KEY, Buffer.alloc(32, 0),
      TLVValues.PERMISSIONS, PermissionTypes.ADMIN,
    );
    const httpRequest = client.formatHTTPRequest("POST", "/pairings", requestTLV, "application/pairing+tlv8");
    client.write(httpRequest, encryption);

    await PromiseTimeout(10);

    expect(client.receiveBufferCount).toEqual(1);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPPairingHTTPCode.OK);
    expect(response.headers["Content-Type"]).toEqual("application/pairing+tlv8");

    const responseTLV = tlv.decode(response.body);
    expect(responseTLV[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M2);
  });

  test("test /pairings REMOVE_PAIRING", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    server.on(HAPServerEventTypes.REMOVE_PAIRING, (connection, username, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      expect(username).toEqual(thirdUsername);
      callback(0);
    });

    const requestTLV = tlv.encode(
      TLVValues.METHOD, PairMethods.REMOVE_PAIRING,
      TLVValues.STATE, PairingStates.M1,
      TLVValues.IDENTIFIER, thirdUsername,
    );
    const httpRequest = client.formatHTTPRequest("POST", "/pairings", requestTLV, "application/pairing+tlv8");
    client.write(httpRequest, encryption);

    await PromiseTimeout(10);

    expect(client.receiveBufferCount).toEqual(1);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPPairingHTTPCode.OK);
    expect(response.headers["Content-Type"]).toEqual("application/pairing+tlv8");

    const responseTLV = tlv.decode(response.body);
    expect(responseTLV[TLVValues.STATE].readUInt8(0)).toEqual(PairingStates.M2);
  });

  test("test /pairings LIST_PAIRINGS", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    server.on(HAPServerEventTypes.LIST_PAIRINGS, (connection, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      callback(0, [
        {
          username: clientUsername,
          publicKey: clientInfo.publicKey,
          permission: PermissionTypes.ADMIN,
        },
        {
          username: thirdUsername,
          publicKey: Buffer.alloc(32, 0),
          permission: PermissionTypes.USER,
        },
      ]);
    });

    const requestTLV = tlv.encode(
      TLVValues.METHOD, PairMethods.LIST_PAIRINGS,
      TLVValues.STATE, PairingStates.M1,
    );
    const httpRequest = client.formatHTTPRequest("POST", "/pairings", requestTLV, "application/pairing+tlv8");
    client.write(httpRequest, encryption);

    await PromiseTimeout(10);

    expect(client.receiveBufferCount).toEqual(1);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPPairingHTTPCode.OK);
    expect(response.headers["Content-Type"]).toEqual("application/pairing+tlv8");

    // assert STATE=M2
    expect(response.body.slice(0, 3)).toEqual(Buffer.from("060102", "hex"));

    const responseTLV = tlv.decodeList(response.body.slice(3), TLVValues.IDENTIFIER);
    expect(responseTLV.length).toEqual(2);

    expect(responseTLV[0][TLVValues.IDENTIFIER].toString()).toEqual(clientUsername);
    expect(responseTLV[0][TLVValues.PUBLIC_KEY]).toEqual(clientInfo.publicKey);
    expect(responseTLV[0][TLVValues.PERMISSIONS].readUInt8(0)).toEqual(PermissionTypes.ADMIN);

    expect(responseTLV[1][TLVValues.IDENTIFIER].toString()).toEqual(thirdUsername);
    expect(responseTLV[1][TLVValues.PUBLIC_KEY]).toEqual(Buffer.alloc(32, 0));
    expect(responseTLV[1][TLVValues.PERMISSIONS].readUInt8(0)).toEqual(PermissionTypes.USER);
  });

  test("test /accessories", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    server.on(HAPServerEventTypes.ACCESSORIES, (connection, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      callback(undefined, { accessories: [] }); // we respond with empty accessories!
    });

    const httpRequest = client.formatHTTPRequest("GET", "/accessories");
    client.write(httpRequest, encryption);

    await PromiseTimeout(10);

    expect(client.receiveBufferCount).toEqual(1);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPHTTPCode.OK);
    expect(response.headers["Content-Type"]).toEqual("application/hap+json");

    const responseJSON = JSON.parse(response.body.toString());
    expect(responseJSON).toEqual({ accessories: [] });
  });

  test("test successful GET /characteristics", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    const readData: CharacteristicReadData[] = [
      {
        aid: 1,
        iid: 9,
        value: "Hello World",
        type: Characteristic.Name.UUID,
        ev: true,
      },
      {
        aid: 2,
        iid: 14,
        value: true,
        type: Characteristic.Active.UUID,
        ev: false,
      },
    ];

    server.on(HAPServerEventTypes.GET_CHARACTERISTICS, (connection, request, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      expect(request.ids).toEqual([ { aid: 1, iid: 9 }, { aid: 2, iid: 14 } ]);
      expect(request.includeMeta).toBeFalsy();
      expect(request.includePerms).toBeFalsy();
      expect(request.includeType).toBeTruthy();
      expect(request.includeEvent).toBeTruthy();
      callback(undefined, { characteristics: readData });
    });

    const httpRequest = client.formatHTTPRequest(
      "GET",
      "/characteristics?id=1.9,2.14&meta=false&perms=0&type=true&ev=1",
    );
    client.write(httpRequest, encryption);
    await PromiseTimeout(10);

    expect(client.receiveBufferCount).toEqual(1);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPHTTPCode.OK);
    expect(response.headers["Content-Type"]).toEqual("application/hap+json");

    const responseJSON = JSON.parse(response.body.toString());
    expect(responseJSON).toEqual({ characteristics: readData });
  });

  test("test GET /characteristics with errors", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    const readData: CharacteristicReadData[] = [
      {
        aid: 1,
        iid: 9,
        value: "Hello World",
      },
      {
        aid: 2,
        iid: 14,
        status: HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      },
    ];

    server.on(HAPServerEventTypes.GET_CHARACTERISTICS, (connection, request, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      expect(request.ids).toEqual([ { aid: 1, iid: 9 }, { aid: 2, iid: 14 } ]);
      expect(request.includeMeta).toBeFalsy();
      expect(request.includePerms).toBeFalsy();
      expect(request.includeType).toBeFalsy();
      expect(request.includeEvent).toBeFalsy();
      callback(undefined, { characteristics: readData });
    });

    const httpRequest = client.formatHTTPRequest(
      "GET",
      "/characteristics?id=1.9,2.14",
    );
    client.write(httpRequest, encryption);
    await PromiseTimeout(10);

    expect(client.receiveBufferCount).toEqual(1);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPHTTPCode.MULTI_STATUS);
    expect(response.headers["Content-Type"]).toEqual("application/hap+json");

    const responseJSON = JSON.parse(response.body.toString());
    expect(responseJSON).toEqual({ characteristics: [
      {
        ...readData[0],
        status: HAPStatus.SUCCESS,
      },
      readData[1],
    ] });
  });

  test("test successful GET /characteristics value write", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port, address] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    const encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

    const client = new HTTPClient(httpAgent, address, port);
    client.attachSocket();

    server.on(HAPServerEventTypes.SET_CHARACTERISTICS, (connection, request, callback) => {
      expect(connection.encryption).not.toBeUndefined();
      // TODO validate
      callback(undefined, { characteristics: [] }); // TODO response!
    });

    const httpRequest = client.formatHTTPRequest(
      "PUT",
      "/characteristics",
      Buffer.from(JSON.stringify({

      })),
      "application/hap+json",
    );
    client.write(httpRequest, encryption);
    await PromiseTimeout(10);

    const plaintext = client.popReceiveBuffer(encryption);
    const response = client.parseHTTPResponse(plaintext);
    expect(response.statusCode).toEqual(HAPHTTPCode.NO_CONTENT);
  });

  // TODO PUT /characteristic with MULTI_STATUS resposnse!

  // TODO test write reponse?

  // TODO test illegal json formatting!

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
