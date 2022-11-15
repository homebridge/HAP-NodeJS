import axios, { AxiosError, AxiosResponse } from "axios";
import crypto from "crypto";
import { Agent } from "http";
import tweetnacl from "tweetnacl";
import {
  AccessoriesResponse,
  CharacteristicId,
  CharacteristicReadData,
  CharacteristicsWriteRequest,
  CharacteristicsWriteResponse,
  PairingStates,
  ResourceRequest,
  ResourceRequestType,
  TLVValues,
} from "../internal-types";
import { HAPHTTPClient } from "../test-utils/HAPHTTPClient";
import { PairSetupClient } from "../test-utils/PairSetupClient";
import { PairVerifyClient } from "../test-utils/PairVerifyClient";
import { Accessory } from "./Accessory";
import { Characteristic, Formats, Perms } from "./Characteristic";
import {
  HAPHTTPCode,
  HAPPairingHTTPCode,
  HAPServer,
  HAPServerEventTypes,
  HAPStatus,
  IdentifyCallback,
  IsKnownHAPStatusError,
  TLVErrorCode,
} from "./HAPServer";
import { AccessoryInfo, PairingInformation, PermissionTypes } from "./model/AccessoryInfo";
import { Service } from "./Service";
import { HAPConnection, HAPEncryption } from "./util/eventedhttp";
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
  let server: HAPServer;

  async function bindServer(server: HAPServer, port = 0, host = "localhost"): Promise<[port: number, string: string]> {
    const listenPromise: Promise<[number, string]> = awaitEventOnce(server, HAPServerEventTypes.LISTENING);
    server.listen(port, host);
    return await listenPromise;
  }

  beforeEach(() => {
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

  test("test successful /pair-verify", async () => {
    server = new HAPServer(accessoryInfoPaired);
    const [port] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);
    await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);
  });

  test("test /pair-verify with not being paired", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    const pairVerify = new PairVerifyClient(port, httpAgent);

    // M1
    const responseM1 = await pairVerify.sendM1();

    // M2
    const M2 = pairVerify.parseM2(responseM1.data, serverInfoUnpaired);

    // M3
    const M3 = pairVerify.prepareM3(M2, clientInfo);

    const responseM3 = await pairVerify.sendM3(M3);
    const objectsM4 = tlv.decode(responseM3.data);

    expect(objectsM4[TLVValues.STATE].readUInt8(0)).toBe(PairingStates.M4);
    expect(objectsM4[TLVValues.ERROR_CODE].readUInt8(0)).toEqual(TLVErrorCode.AUTHENTICATION);
  });

  describe("tests with paired and pair-verified connection", () => {
    let port: number;
    let address: string;
    let encryption: HAPEncryption;
    let client: HAPHTTPClient;

    beforeEach(async () => {
      server = new HAPServer(accessoryInfoPaired);
      const addressInformation = await bindServer(server);
      port = addressInformation[0];
      address = addressInformation[1];

      const pairVerify = new PairVerifyClient(port, httpAgent);
      encryption = await pairVerify.sendPairVerify(serverInfoPaired, clientInfo);

      client = new HAPHTTPClient(httpAgent, address, port);
      client.attachSocket();

      client.enableEncryption(encryption);
    });

    afterEach(() => {
      client.releaseSocket();
    });

    test("test /pairings ADD_PAIRING", async () => {
      const exampleKey = crypto.randomBytes(32);

      server.on(HAPServerEventTypes.ADD_PAIRING, (connection, username, publicKey, permission, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(username).toEqual(thirdUsername);
        expect(publicKey).toEqual(exampleKey);
        expect(permission).toEqual(PermissionTypes.ADMIN);
        callback(0);
      });

      await client.sendAddPairingRequest(thirdUsername, exampleKey, PermissionTypes.ADMIN);
    });

    test("test /pairings REMOVE_PAIRING", async () => {
      server.on(HAPServerEventTypes.REMOVE_PAIRING, (connection, username, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(username).toEqual(thirdUsername);
        callback(0);
      });

      await client.sendRemovePairingRequest(thirdUsername);
    });

    test("test /pairings LIST_PAIRINGS", async () => {
      const list: PairingInformation[] = [
        {
          username: clientUsername,
          publicKey: clientInfo.publicKey,
          permission: PermissionTypes.ADMIN,
        },
        {
          username: thirdUsername,
          publicKey: crypto.randomBytes(32),
          permission: PermissionTypes.USER,
        },
      ];

      server.on(HAPServerEventTypes.LIST_PAIRINGS, (connection, callback) => {
        expect(connection.encryption).toBeDefined();
        callback(0, list);
      });

      const response = await client.sendListPairingsRequest();
      expect(response).toEqual(list);
    });

    test("test /accessories", async () => {
      const accessoryResponse: AccessoriesResponse = {
        accessories: [{
          aid: 1,
          services: [{
            iid: 2,
            type: Service.Switch.UUID,
            characteristics: [{
              iid: 3,
              format: Formats.STRING,
              perms: [Perms.PAIRED_READ],
              value: "Hello World",
              type: Characteristic.Name.UUID,
            }],
          }],
        }],
      };

      server.on(HAPServerEventTypes.ACCESSORIES, (connection, callback) => {
        expect(connection.encryption).toBeDefined();
        callback(undefined, accessoryResponse);
      });

      const accessories = await client.sendAccessoriesRequest();
      expect(accessories).toEqual(accessoryResponse);
    });

    test("test successful GET /characteristics", async () => {
      const ids: CharacteristicId[] = [ { aid: 1, iid: 9 }, { aid: 2, iid: 14 } ];
      const readData: CharacteristicReadData[] = [
        {
          ...ids[0],
          value: "Hello World",
          type: Characteristic.Name.UUID,
          ev: true,
        },
        {
          ...ids[1],
          value: true,
          type: Characteristic.Active.UUID,
          ev: false,
        },
      ];

      server.on(HAPServerEventTypes.GET_CHARACTERISTICS, (connection, request, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(request.ids).toEqual(ids);
        expect(request.includeMeta).toBeFalsy();
        expect(request.includePerms).toBeFalsy();
        expect(request.includeType).toBeTruthy();
        expect(request.includeEvent).toBeTruthy();
        callback(undefined, { characteristics: readData });
      });

      const httpResponse = await client.sendCharacteristicRead(ids, false, false, true, true);
      expect(httpResponse.statusCode).toEqual(HAPHTTPCode.OK);
      expect(httpResponse.body).toEqual({ characteristics: readData });
    });

    test("test GET /characteristics with errors", async () => {
      const ids: CharacteristicId[] = [ { aid: 1, iid: 9 }, { aid: 2, iid: 14 } ];
      const readData: CharacteristicReadData[] = [
        {
          ...ids[0],
          value: "Hello World",
        },
        {
          ...ids[1],
          status: HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        },
      ];

      server.on(HAPServerEventTypes.GET_CHARACTERISTICS, (connection, request, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(request.ids).toEqual(ids);
        expect(request.includeMeta).toBeFalsy();
        expect(request.includePerms).toBeFalsy();
        expect(request.includeType).toBeFalsy();
        expect(request.includeEvent).toBeFalsy();
        callback(undefined, { characteristics: readData });
      });

      const httpResponse = await client.sendCharacteristicRead(ids);
      expect(httpResponse.statusCode).toEqual(HAPHTTPCode.MULTI_STATUS);
      expect(httpResponse.body).toEqual({
        characteristics: [
          {
            ...readData[0],
            status: HAPStatus.SUCCESS,
          },
          readData[1],
        ],
      });
    });

    test("test successful PUT /characteristics value write NO_CONTENT", async () => {
      const writeRequest: CharacteristicsWriteRequest = {
        characteristics: [
          {
            aid: 1,
            iid: 9,
            value: "Hello World",
          },
          {
            aid: 2,
            iid: 14,
            value: true,
          },
        ],
      };

      const hapResponse: CharacteristicsWriteResponse = {
        characteristics: [
          {
            aid: 1,
            iid: 9,
            status: HAPStatus.SUCCESS,
          },
          {
            aid: 2,
            iid: 14,
            status: HAPStatus.SUCCESS,
          },
        ],
      };

      server.on(HAPServerEventTypes.SET_CHARACTERISTICS, (connection, request, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(request).toEqual(writeRequest);
        callback(undefined, hapResponse);
      });

      const httpResponse = await client.sendCharacteristicWrite(writeRequest);
      expect(httpResponse.statusCode).toEqual(HAPHTTPCode.NO_CONTENT);
    });

    test("test PUT /characteristics value with MULTI_STATUS", async () => {
      const ids: CharacteristicId[] = [ { aid: 1, iid: 9 }, { aid: 2, iid: 14 } ];
      const writeRequest: CharacteristicsWriteRequest = {
        characteristics: [
          {
            ...ids[0],
            value: "Hello World",
          },
          {
            ...ids[1],
            value: true,
            ev: true,
          },
        ],
        pid: 1337,
      };

      const hapResponse: CharacteristicsWriteResponse = {
        characteristics: [
          {
            ...ids[0],
            status: HAPStatus.SUCCESS,
          },
          {
            ...ids[1],
            status: HAPStatus.SERVICE_COMMUNICATION_FAILURE,
          },
        ],
      };

      server.on(HAPServerEventTypes.SET_CHARACTERISTICS, (connection, request, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(request).toEqual(writeRequest);
        callback(undefined, hapResponse);
      });

      const httpResponse = await client.sendCharacteristicWrite(writeRequest);
      expect(httpResponse.statusCode).toEqual(HAPHTTPCode.MULTI_STATUS);
    });

    test("test PUT /characteristics value with write response", async () => {
      const ids: CharacteristicId[] = [ { aid: 1, iid: 9 } ];
      const writeRequest: CharacteristicsWriteRequest = {
        characteristics: [
          {
            ...ids[0],
            value: "Hello",
          },
        ],
      };

      const hapResponse: CharacteristicsWriteResponse = {
        characteristics: [
          {
            ...ids[0],
            status: HAPStatus.SUCCESS,
            value: "World",
          },
        ],
      };

      server.on(HAPServerEventTypes.SET_CHARACTERISTICS, (connection, request, callback) => {
        expect(connection.encryption).toBeDefined();
        expect(request).toEqual(writeRequest);
        callback(undefined, hapResponse);
      });

      const httpResponse = await client.sendCharacteristicWrite(writeRequest);
      expect(httpResponse.statusCode).toEqual(HAPHTTPCode.MULTI_STATUS);
    });

    test("test prepare write request", async () => {
      await client.sendPrepareWrite({
        pid: 1337,
        ttl: 1000,
      });

      await PromiseTimeout(50);

      // testing that pid is overwritten!
      await client.sendPrepareWrite({
        pid: 13337,
        ttl: 100,
      });

      // we just do a /accessories request to get hold onto the HAPConnection object
      let hapConnection!: HAPConnection;
      server.on(HAPServerEventTypes.ACCESSORIES, (connection, callback) => {
        hapConnection = connection;
        callback(undefined, { accessories:[] });
      });
      await client.sendAccessoriesRequest();

      expect(hapConnection.timedWriteTimeout).toBeDefined();
      expect(hapConnection.timedWritePid).toBe(13337);

      await PromiseTimeout(120);

      expect(hapConnection.timedWriteTimeout).toBeUndefined();
      expect(hapConnection.timedWritePid).toBeUndefined();
    });

    test("test resource request", async () => {
      const image = crypto.randomBytes(256);
      const request: ResourceRequest = {
        "image-height": 256,
        "image-width": 512,
        "resource-type": ResourceRequestType.IMAGE,
      };

      server.on(HAPServerEventTypes.REQUEST_RESOURCE, (resource, callback) => {
        expect(resource).toEqual(request);
        callback(undefined, image);
      });

      const result = await client.sendResourceRequest(request);
      expect(result).toEqual(image);
    });
  });

  test.each(["pairings", "accessories", "characteristics", "prepare", "resource"])(
    "request to \"/%s\" should be rejected in unpaired and unverified state",
    async (route: string) => {
      server = new HAPServer(accessoryInfoUnpaired);
      const [port] = await bindServer(server);

      try {
        const response = await axios.post(`http://localhost:${port}/${route}`, { httpAgent });
        fail(`Expected erroneous response, got ${response}`);
      } catch (error) {
        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response?.status).toBe(HAPPairingHTTPCode.CONNECTION_AUTHORIZATION_REQUIRED);
        expect(error.response?.data).toEqual({ status: HAPStatus.INSUFFICIENT_PRIVILEGES });
      }
    },
  );

  test.each(["pairings", "accessories", "characteristics", "prepare", "resource"])(
    "request to \"/%s\" should be rejected in paired and unverified state",
    async (route: string) => {
      server = new HAPServer(accessoryInfoPaired);
      const [port] = await bindServer(server);

      try {
        const response = await axios.post(`http://localhost:${port}/${route}`, { httpAgent });
        fail(`Expected erroneous response, got ${response}`);
      } catch (error) {
        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response?.status).toBe(HAPPairingHTTPCode.CONNECTION_AUTHORIZATION_REQUIRED);
        expect(error.response?.data).toEqual({ status: HAPStatus.INSUFFICIENT_PRIVILEGES });
      }
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
    expect(IsKnownHAPStatusError("aaaa")).toBe(false);
    // @ts-expect-error: deliberate illegal input
    expect(IsKnownHAPStatusError({ "key": "value" })).toBe(false);
    // @ts-expect-error: deliberate illegal input
    expect(IsKnownHAPStatusError([])).toBe(false);
  });
});
