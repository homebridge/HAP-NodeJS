import crypto from "crypto";
import {
  AccessoriesResponse,
  CharacteristicJsonObject,
  CharacteristicReadData,
  CharacteristicsReadRequest,
  CharacteristicsReadResponse,
} from "../internal-types";
import { CharacteristicValue } from "../types";
import { Accessory, AccessoryEventTypes, Categories, MDNSAdvertiser, PublishInfo } from "./Accessory";
import { BonjourHAPAdvertiser } from "./Advertiser";
import { Bridge } from "./Bridge";
import { Characteristic, CharacteristicEventTypes } from "./Characteristic";
import { Controller, ControllerIdentifier, ControllerServiceMap } from "./controller";
import { HAPStatus, TLVErrorCode } from "./HAPServer";
import { AccessoryInfo, PairingInformation, PermissionTypes } from "./model/AccessoryInfo";
import { Service } from "./Service";
import { EventedHTTPServer, HAPConnection } from "./util/eventedhttp";
import { awaitEventOnce, PromiseTimeout } from "./util/promise-utils";
import * as uuid from "./util/uuid";
import { toShortForm } from "./util/uuid";
import Mock = jest.Mock;

describe("Accessory", () => {
  const TEST_DISPLAY_NAME = "Test Accessory";
  const TEST_UUID = uuid.generate("HAP-NODEJS-TEST-ACCESSORY!");

  let accessory: Accessory;
  let connection: HAPConnection;

  const serverUsername = "AB:CD:EF:00:11:22";
  const clientUsername0 = "AB:CD:EF:00:11:23";
  let clientPublicKey0: Buffer;
  const clientUsername1 = "AB:CD:EF:00:11:24";
  let clientPublicKey1: Buffer;
  const clientUsername2 = "AB:CD:EF:00:11:25"; // TODO remove third client?
  let clientPublicKey2: Buffer;

  let accessoryInfoUnpaired: AccessoryInfo;
  let accessoryInfoPaired: AccessoryInfo;
  const saveMock: Mock = jest.fn();

  let callback: Mock;
  // a void promise to wait for the above callback to be called!
  let callbackPromise: Promise<void>;

  beforeEach(() => {
    clientPublicKey0 = crypto.randomBytes(32);
    clientPublicKey1 = crypto.randomBytes(32);
    clientPublicKey2 = crypto.randomBytes(32);

    accessoryInfoUnpaired = AccessoryInfo.create(serverUsername);
    // @ts-expect-error: private access
    accessoryInfoUnpaired.setupID = Accessory._generateSetupID();
    accessoryInfoUnpaired.displayName = "Outlet";
    accessoryInfoUnpaired.category = 7;
    accessoryInfoUnpaired.pincode = " 031-45-154";
    accessoryInfoUnpaired.save = saveMock;

    accessoryInfoPaired = AccessoryInfo.create(serverUsername);
    // @ts-expect-error: private access
    accessoryInfoPaired.setupID = Accessory._generateSetupID();
    accessoryInfoPaired.displayName = "Outlet";
    accessoryInfoPaired.category = 7;
    accessoryInfoPaired.pincode = " 031-45-154";
    accessoryInfoPaired.addPairedClient(clientUsername0, clientPublicKey0, PermissionTypes.ADMIN);
    accessoryInfoPaired.save = saveMock;

    // ensure we start with a clean Accessory for every test
    Accessory.cleanupAccessoryData(serverUsername);
    accessory = new Accessory(TEST_DISPLAY_NAME, TEST_UUID);

    connection = {
      username: clientUsername0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    callback = jest.fn();
    const originalReset = callback.mockReset;
    callback.mockReset = () => {
      const resetResult = originalReset();
      callbackPromise = new Promise(resolve => {
        callback.mockImplementationOnce(() => resolve());
      });
      return resetResult;
    };

    callback.mockReset();

    saveMock.mockReset();
  });

  afterEach(async () => {
    await accessory?.unpublish();
    await accessory?.destroy();
  });

  describe("constructor", () => {
    test("identify itself with a valid UUID", () => {
      const accessory = new Accessory("Test", uuid.generate("Foo"));

      const VALUE = true;

      accessory.getService(Service.AccessoryInformation)!
        .getCharacteristic(Characteristic.Identify)!
        .on(CharacteristicEventTypes.SET, (value, callback) => {
          // TODO is this ever called?
          expect(value).toEqual(VALUE);
          callback();
        });
    });

    test("fail to load with no display name", () => {
      expect(() => new Accessory("", ""))
        .toThrow("non-empty displayName");
    });

    test("fail to load with no UUID", () => {
      expect(() => new Accessory("Test", ""))
        .toThrow("valid UUID");
    });

    test("fail to load with an invalid UUID", () => {
      expect(() => new Accessory("Test", "test"))
        .toThrow("not a valid UUID");
    });
  });

  describe("publish", () => {
    test.each`
      advertiser                 | republish
      ${MDNSAdvertiser.BONJOUR}  | ${false}
      ${MDNSAdvertiser.CIAO}     | ${false}
      ${MDNSAdvertiser.BONJOUR}  | ${true}
      ${MDNSAdvertiser.CIAO}     | ${true}
    `("Clean Accessory publish and unpublish (advertiser: $advertiser; republish: $republish)", async ({ advertiser, republish }) => {
      const switchService = new Service.Switch("My Example Switch");
      accessory.addService(switchService);

      const publishInfo: PublishInfo = {
        username: serverUsername,
        pincode: "000-00-000",
        category: Categories.SWITCH,
        advertiser: advertiser,
      };

      await accessory.publish(publishInfo);

      expect(accessory.displayName.startsWith(TEST_DISPLAY_NAME));
      expect(accessory.displayName.length).toEqual(TEST_DISPLAY_NAME.length + 1 + 4); // added hash!

      await awaitEventOnce(accessory, AccessoryEventTypes.ADVERTISED);

      const displayNameWithIdentifyingMaterial = accessory.displayName;

      await accessory.unpublish();

      if (!republish) {
        return;
      }
      // This second round tests, that the Accessory is reusable after unpublished was called

      await PromiseTimeout(200);

      await accessory.publish(publishInfo);

      // ensure unification isn't done twice!
      expect(accessory.displayName).toEqual(displayNameWithIdentifyingMaterial);

      await awaitEventOnce(accessory, AccessoryEventTypes.ADVERTISED);
    });

    test("Clean Accessory publish and unpublish with default advertiser selection", async () => {
      const switchService = new Service.Switch("My Example Switch");
      accessory.addService(switchService);

      const publishInfo: PublishInfo = {
        username: serverUsername,
        pincode: "000-00-000",
        category: Categories.SWITCH,
        advertiser: undefined,
      };

      await accessory.publish(publishInfo);

      expect(accessory.displayName.startsWith(TEST_DISPLAY_NAME));
      expect(accessory.displayName.length).toEqual(TEST_DISPLAY_NAME.length + 1 + 4); // added hash!

      await awaitEventOnce(accessory, AccessoryEventTypes.ADVERTISED);
    });
  });

  describe("pairing", () => {
    let defaultPairingInfo: PairingInformation;

    beforeEach(() => {
      defaultPairingInfo = { username: clientUsername0, publicKey: clientPublicKey0, permission: PermissionTypes.ADMIN };
    });

    test("handleInitialPairSetupFinished", async () => {
      // TODO fix: CiaoAdvertiser constructor creates open handles!
      // const advertiser = new CiaoAdvertiser(accessoryInfoUnpaired);

      const advertiser = new BonjourHAPAdvertiser(accessoryInfoUnpaired);
      advertiser.updateAdvertisement = jest.fn();
      accessory._advertiser = advertiser;

      accessoryInfoUnpaired.addPairedClient = jest.fn();
      accessory._accessoryInfo = accessoryInfoUnpaired;

      const publicKey = crypto.randomBytes(32);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const callback = jest.fn();
      // @ts-expect-error: private access
      accessory.handleInitialPairSetupFinished(clientUsername0, publicKey, callback);

      expect(accessoryInfoUnpaired.addPairedClient).toBeCalledTimes(1);
      expect(accessoryInfoUnpaired.addPairedClient).toBeCalledWith(clientUsername0, publicKey, PermissionTypes.ADMIN);

      expect(saveMock).toBeCalledTimes(1);

      expect(advertiser.updateAdvertisement).toBeCalledTimes(1);

      await advertiser.destroy();
    });

    describe("handleAddPairing", () => {
      test("unavailable", () => {
        // @ts-expect-error: private access
        accessory.handleAddPairing(connection, clientUsername1, clientPublicKey1, PermissionTypes.USER, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.UNAVAILABLE);
      });

      test("missing admin permissions", () => {
        accessory._accessoryInfo = accessoryInfoUnpaired;
        // @ts-expect-error: private access
        accessory.handleAddPairing(connection, clientUsername1, clientPublicKey1, PermissionTypes.USER, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.AUTHENTICATION);
      });

      test.each([PermissionTypes.USER, PermissionTypes.ADMIN])(
        "adding pairing: %p", type => {
          accessory._accessoryInfo = accessoryInfoPaired;

          // @ts-expect-error: private access
          accessory.handleAddPairing(connection, clientUsername1, clientPublicKey1, type, callback);
          expect(callback).toBeCalledWith(0);

          const expectedPairings: PairingInformation[] = [
            defaultPairingInfo,
            { username: clientUsername1, publicKey: clientPublicKey1, permission: type },
          ];
          expect(accessoryInfoPaired.listPairings()).toEqual(expectedPairings);

          expect(accessoryInfoPaired.pairedAdminClients)
            .toEqual(type === PermissionTypes.ADMIN ? 2 : 1);

          expect(saveMock).toBeCalledTimes(1);
        });

      test.each([
        { previous: PermissionTypes.USER, update: PermissionTypes.ADMIN },
        { previous: PermissionTypes.ADMIN, update: PermissionTypes.USER },
        { previous: PermissionTypes.USER, update: PermissionTypes.USER },
        { previous: PermissionTypes.ADMIN, update: PermissionTypes.ADMIN },
      ])(
        "update pairing: %p", type => {
          accessory._accessoryInfo = accessoryInfoPaired;
          accessoryInfoPaired.addPairedClient(clientUsername1, clientPublicKey1, type.previous);
          expect(accessoryInfoPaired.pairedAdminClients)
            .toEqual(type.previous === PermissionTypes.ADMIN ? 2 : 1);

          // @ts-expect-error: private access
          accessory.handleAddPairing(connection, clientUsername1, clientPublicKey1, type.update, callback);
          expect(callback).toBeCalledWith(0);

          const expectedPairings: PairingInformation[] = [
            defaultPairingInfo,
            { username: clientUsername1, publicKey: clientPublicKey1, permission: type.update },
          ];
          expect(accessoryInfoPaired.listPairings()).toEqual(expectedPairings);

          expect(accessoryInfoPaired.pairedAdminClients)
            .toEqual(type.update === PermissionTypes.ADMIN ? 2 : 1);

          expect(saveMock).toBeCalledTimes(1);
        });

      test("update permission with non-matching public key", () => {
        accessory._accessoryInfo = accessoryInfoPaired;
        accessoryInfoPaired.addPairedClient(clientUsername1, clientPublicKey1, PermissionTypes.USER);

        // @ts-expect-error: private access
        accessory.handleAddPairing(connection, clientUsername1, clientPublicKey2, PermissionTypes.ADMIN, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.UNKNOWN);
      });
    });

    describe("handleRemovePairing", () => {
      let storage: typeof EventedHTTPServer.destroyExistingConnectionsAfterUnpair;
      beforeEach(() => {
        storage = EventedHTTPServer.destroyExistingConnectionsAfterUnpair;
        EventedHTTPServer.destroyExistingConnectionsAfterUnpair = jest.fn();
      });

      afterEach(() => {
        EventedHTTPServer.destroyExistingConnectionsAfterUnpair = storage;
      });

      test("unavailable", () => {
        // @ts-expect-error: private access
        accessory.handleRemovePairing(connection, clientUsername1, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.UNAVAILABLE);
      });

      test("missing admin permissions", () => {
        accessory._accessoryInfo = accessoryInfoUnpaired;
        // @ts-expect-error: private access
        accessory.handleRemovePairing(connection, clientUsername1, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.AUTHENTICATION);
      });

      test.each([PermissionTypes.ADMIN, PermissionTypes.USER])(
        "remove pairing: %s", type => {
          const count = type === PermissionTypes.ADMIN ? 2 : 1;
          accessory._accessoryInfo = accessoryInfoPaired;
          accessoryInfoPaired.addPairedClient(clientUsername1, clientPublicKey1, type);
          expect(accessoryInfoPaired.pairedAdminClients).toEqual(count);

          // @ts-expect-error: private access
          accessory.handleRemovePairing(connection, clientUsername1, callback);
          expect(callback).toBeCalledWith(0);

          expect(accessoryInfoPaired.listPairings())
            .toEqual([ defaultPairingInfo ]);
          expect(accessoryInfoPaired.pairedAdminClients).toEqual(1);

          expect(EventedHTTPServer.destroyExistingConnectionsAfterUnpair).toBeCalledTimes(1);
          expect(EventedHTTPServer.destroyExistingConnectionsAfterUnpair)
            .toBeCalledWith(connection, clientUsername1);
        });

      test("remove last ADMIN pairing", () => {
        accessory._accessoryInfo = accessoryInfoPaired;
        accessoryInfoPaired.addPairedClient(clientUsername1, clientPublicKey1, PermissionTypes.USER);

        // a mock which just forwards to the normal function call, so that data integrity is ensured
        const _removePairedClient0Mock = jest.fn();
        // @ts-expect-error: private access
        _removePairedClient0Mock.mockImplementation(accessoryInfoPaired._removePairedClient0);
        // @ts-expect-error: private access
        accessoryInfoPaired._removePairedClient0 = _removePairedClient0Mock;

        expect(accessoryInfoPaired.pairedAdminClients).toEqual(1);

        // after we removed pairing we also expect that the accessory is advertised as unpaired
        const advertiser = new BonjourHAPAdvertiser(accessoryInfoUnpaired);
        advertiser.updateAdvertisement = jest.fn();
        accessory._advertiser = advertiser;
        const eventMock = jest.fn();
        accessory.on(AccessoryEventTypes.UNPAIRED, eventMock);

        // @ts-expect-error: private access
        accessory.handleRemovePairing(connection, clientUsername0, callback);
        expect(callback).toBeCalledWith(0);

        expect(accessoryInfoPaired.listPairings()).toEqual([]);
        expect(accessoryInfoPaired.pairedAdminClients).toEqual(0);

        // verify calls to _removePairedClient0
        expect(_removePairedClient0Mock).toBeCalledTimes(2);
        expect(_removePairedClient0Mock)
          .toHaveBeenNthCalledWith(1, connection, clientUsername0);
        expect(_removePairedClient0Mock)
          .toHaveBeenNthCalledWith(2, connection, clientUsername1); // it shall also remove the user pairing

        expect(EventedHTTPServer.destroyExistingConnectionsAfterUnpair).toBeCalledTimes(2);

        // verify that accessory is marked as unpaired again
        expect(advertiser.updateAdvertisement).toBeCalledTimes(1);
        expect(eventMock).toBeCalledTimes(1);
      });
    });

    describe("handleListPairings", () => {
      test("unavailable", () => {
        // @ts-expect-error: private access
        accessory.handleListPairings(connection, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.UNAVAILABLE);
      });

      test("missing admin permissions", () => {
        accessory._accessoryInfo = accessoryInfoUnpaired;
        // @ts-expect-error: private access
        accessory.handleListPairings(connection, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.AUTHENTICATION);

        accessory._accessoryInfo = accessoryInfoPaired;
        accessoryInfoPaired.addPairedClient(clientUsername1, clientPublicKey1, PermissionTypes.USER);
        connection.username = clientUsername1;
        // @ts-expect-error: private access
        accessory.handleListPairings(connection, callback);
        expect(callback).toBeCalledWith(TLVErrorCode.AUTHENTICATION);
      });

      test("list pairings", () => {
        accessory._accessoryInfo = accessoryInfoPaired;
        // @ts-expect-error: private access
        accessory.handleListPairings(connection, callback);
        expect(callback).toBeCalledWith(0, [ defaultPairingInfo ]);
      });
    });
  });

  describe("published switch service", () => {
    let switchService: Service;

    let aid: number;
    let iidSwitch: number;
    let iidOnCharacteristic: number;

    beforeEach(() => { // TODO duplication!
      const loadBackup = AccessoryInfo.load;
      AccessoryInfo.load = jest.fn(() => {
        // inject our mocked accessoryInfo object
        return accessoryInfoPaired;
      });

      const publishInfo: PublishInfo = {
        username: serverUsername,
        pincode: "000-00-000",
        category: Categories.SWITCH,
      };

      switchService = new Service.Switch("Switch");
      accessory.addService(switchService);

      accessory.publish(publishInfo);

      AccessoryInfo.load = loadBackup;

      // saveMock may be called in `publish`
      saveMock.mockReset();

      aid = accessory.aid!;
      iidSwitch = switchService.iid!;
      iidOnCharacteristic = switchService.getCharacteristic(Characteristic.On).iid!;
    });

    describe("handleAccessories", () => {
      const characteristicHAPInfo = async (
        characteristicConstructor: new () => Characteristic,
        iid: number,
        value?: CharacteristicValue,
      ): Promise<CharacteristicJsonObject>  => {
        const characteristic = new characteristicConstructor();
        if (value !== undefined) {
          characteristic.value = value;
        }
        characteristic.iid = iid;
        return characteristic.toHAP(connection);
      };

      test("test accessories database retrieval", async () => {
        // @ts-expect-error: private access
        accessory.handleAccessories(connection, callback);

        await callbackPromise;

        // TODO test Service.toHAP and Characteristic.toHAP!
        const expected: AccessoriesResponse = {
          accessories: [{
            aid: 1,
            services: [
              {
                iid: 1,
                type: toShortForm(Service.AccessoryInformation.UUID),
                hidden: undefined,
                primary: undefined,
                characteristics: [
                  await characteristicHAPInfo(Characteristic.Identify, 2),
                  await characteristicHAPInfo(Characteristic.Manufacturer, 3),
                  await characteristicHAPInfo(Characteristic.Model, 4),
                  await characteristicHAPInfo(Characteristic.Name, 5, accessory.displayName),
                  await characteristicHAPInfo(Characteristic.SerialNumber, 6),
                  await characteristicHAPInfo(Characteristic.FirmwareRevision, 7),
                ],
              },
              {
                iid: 8,
                type: toShortForm(Service.Switch.UUID),
                hidden: undefined,
                primary: undefined,
                characteristics: [
                  await characteristicHAPInfo(Characteristic.Name, 9, "Switch"),
                  await characteristicHAPInfo(Characteristic.On, 10, false),
                ],
              },
              {
                iid: 11,
                type: toShortForm(Service.ProtocolInformation.UUID),
                hidden: undefined,
                primary: undefined,
                characteristics: [
                  await characteristicHAPInfo(Characteristic.Version, 12, "1.1.0"),
                ],
              },
            ],
          }],
        };
        expect(callback).toBeCalledTimes(1);
        expect(callback).toBeCalledWith(undefined, expected);
        // TODO add test coverage badge to README!
      });
    });

    describe("handleGetCharacteristic", () => {
      const testRequestResponse = async (
        request: Partial<CharacteristicsReadRequest>,
        ...expectedReadData: CharacteristicReadData[]
      ): Promise<void> => {
        // TODO hasEventNotification method on HAPConnection?
        // @ts-expect-error: private access
        accessory.handleGetCharacteristics(connection, {
          ids: [],
          includeMeta: false,
          includeEvent: false,
          includeType: false,
          includePerms: false,
          ...request,
        }, callback);

        await callbackPromise;

        const expectedResponse: CharacteristicsReadResponse = {
          characteristics: expectedReadData,
        };

        expect(callback).toBeCalledTimes(1);
        expect(callback).toBeCalledWith(undefined, expectedResponse);

        callback.mockReset();
      };

      test("read Switch.On characteristic", async () => {
        await testRequestResponse({
          ids: [{ aid: aid, iid: iidOnCharacteristic }],
        }, {
          aid: aid,
          iid: iidOnCharacteristic,
          value: 0,
        });
      });

      test("read non-existent characteristic", async () => {
        await testRequestResponse({
          ids: [{ aid: 2, iid: iidOnCharacteristic }],
        }, {
          aid: 2,
          iid: iidOnCharacteristic,
          status: HAPStatus.INVALID_VALUE_IN_REQUEST,
        });

        await testRequestResponse({
          ids: [{ aid: aid, iid: 15 }],
        }, {
          aid: aid,
          iid: 15,
          status: HAPStatus.INVALID_VALUE_IN_REQUEST,
        });
      });

      test("reading write-only characteristic", async () => {
        await testRequestResponse({
          ids: [{ aid: aid, iid: 2 }], // TODO identify
        }, {
          aid: aid,
          iid: 2,
          status: HAPStatus.WRITE_ONLY_CHARACTERISTIC,
        });
      });
    });
  });

  describe("characteristicWarning", () => {
    test("emit characteristic warning", () => {
      const handler = jest.fn();
      accessory.on(AccessoryEventTypes.CHARACTERISTIC_WARNING, handler);

      const service = accessory.addService(Service.Lightbulb, "Light");
      const on = service.getCharacteristic(Characteristic.On);

      on.updateValue({});
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("forward characteristic on bridged accessory", () => {
      const bridge = new Bridge("Test bridge", uuid.generate("bridge test"));

      bridge.addBridgedAccessory(accessory);

      const handler = jest.fn();
      bridge.on(AccessoryEventTypes.CHARACTERISTIC_WARNING, handler);
      accessory.on(AccessoryEventTypes.CHARACTERISTIC_WARNING, handler);

      const service = accessory.addService(Service.Lightbulb, "Light");
      const on = service.getCharacteristic(Characteristic.On);

      on.updateValue({});
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should run without characteristic warning handler", () => {
      const service = accessory.addService(Service.Lightbulb, "Light");
      const on = service.getCharacteristic(Characteristic.On);

      on.updateValue({});
    });
  });

  describe("serialize", () => {
    test("serialize accessory", () => {
      accessory.category = Categories.LIGHTBULB;

      const lightService = new Service.Lightbulb("TestLight", "subtype");
      const switchService = new Service.Switch("TestSwitch", "subtype");
      lightService.addLinkedService(switchService);

      accessory.addService(lightService);
      accessory.addService(switchService);

      const json = Accessory.serialize(accessory);
      expect(json.displayName).toEqual(accessory.displayName);
      expect(json.UUID).toEqual(accessory.UUID);
      expect(json.category).toEqual(Categories.LIGHTBULB);

      expect(json.services).toBeDefined();
      expect(json.services.length).toEqual(3); // 2 above + accessory information service
      expect(json.linkedServices).toBeDefined();
      expect(Object.keys(json.linkedServices!)).toEqual([lightService.UUID + "subtype"]);
      expect(Object.values(json.linkedServices!)).toEqual([[switchService.UUID + "subtype"]]);
    });
  });

  describe("deserialize", () => {
    test("deserialize legacy json from homebridge", () => {
      const json = JSON.parse("{\"plugin\":\"homebridge-samplePlatform\",\"platform\":\"SamplePlatform\"," +
          "\"displayName\":\"2020-01-17T18:45:41.049Z\",\"UUID\":\"dc3951d8-662e-46f7-b6fe-d1b5b5e1a995\",\"category\":1," +
          "\"context\":{},\"linkedServices\":{\"0000003E-0000-1000-8000-0026BB765291\":[],\"00000043-0000-1000-8000-0026BB765291\":[]}," +
          "\"services\":[{\"UUID\":\"0000003E-0000-1000-8000-0026BB765291\",\"characteristics\":[" +
          "{\"displayName\":\"Identify\",\"UUID\":\"00000014-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"bool\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pw\"]}," +
          "\"value\":false,\"eventOnlyCharacteristic\":false},{\"displayName\":\"Manufacturer\",\"UUID\":\"00000020-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"Default-Manufacturer\",\"eventOnlyCharacteristic\":false},{\"displayName\":\"Model\"," +
          "\"UUID\":\"00000021-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"Default-Model\",\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Name\",\"UUID\":\"00000023-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null," +
          "\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"2020-01-17T18:45:41.049Z\"," +
          "\"eventOnlyCharacteristic\":false},{\"displayName\":\"Serial Number\",\"UUID\":\"00000030-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"Default-SerialNumber\",\"eventOnlyCharacteristic\":false},{\"displayName\":\"Firmware Revision\"," +
          "\"UUID\":\"00000052-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"\",\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Product Data\",\"UUID\":\"00000220-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"data\"," +
          "\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":null," +
          "\"eventOnlyCharacteristic\":false}]},{\"displayName\":\"Test Light\",\"UUID\":\"00000043-0000-1000-8000-0026BB765291\"," +
          "\"characteristics\":[{\"displayName\":\"Name\",\"UUID\":\"00000023-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"Test Light\",\"eventOnlyCharacteristic\":false},{\"displayName\":\"On\"," +
          "\"UUID\":\"00000025-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"bool\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\",\"pw\",\"ev\"]},\"value\":false,\"eventOnlyCharacteristic\":false}]}]}");

      const accessory = Accessory.deserialize(json);

      expect(accessory.displayName).toEqual(json.displayName);
      expect(accessory.UUID).toEqual(json.UUID);
      expect(accessory.category).toEqual(json.category);

      expect(accessory.services).toBeDefined();
      expect(accessory.services.length).toEqual(2);
    });

    test("deserialize complete json", () => {
      // json for a light accessory
      const json = JSON.parse("{\"displayName\":\"TestAccessory\",\"UUID\":\"0beec7b5-ea3f-40fd-bc95-d0dd47f3c5bc\"," +
          "\"category\":5,\"services\":[{\"UUID\":\"0000003E-0000-1000-8000-0026BB765291\",\"hiddenService\":false," +
          "\"primaryService\":false,\"characteristics\":[{\"displayName\":\"Identify\",\"UUID\":\"00000014-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"bool\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pw\"]}," +
          "\"value\":false,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Manufacturer\",\"UUID\":\"00000020-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"Default-Manufacturer\",\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Model\",\"UUID\":\"00000021-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"Default-Model\",\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Name\",\"UUID\":\"00000023-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"TestAccessory\",\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Serial Number\",\"UUID\":\"00000030-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\"," +
          "\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"Default-SerialNumber\"," +
          "\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false},{\"displayName\":\"Firmware Revision\"," +
          "\"UUID\":\"00000052-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"1.0\",\"accessRestrictedToAdmins\":[]," +
          "\"eventOnlyCharacteristic\":false},{\"displayName\":\"Product Data\"," +
          "\"UUID\":\"00000220-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"data\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":null,\"accessRestrictedToAdmins\":[]," +
          "\"eventOnlyCharacteristic\":false}],\"optionalCharacteristics\":[{\"displayName\":\"Hardware Revision\"," +
          "\"UUID\":\"00000053-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"\",\"accessRestrictedToAdmins\":[]," +
          "\"eventOnlyCharacteristic\":false},{\"displayName\":\"Accessory Flags\",\"UUID\":\"000000A6-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"uint32\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\",\"ev\"]}," +
          "\"value\":0,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}]}," +
          "{\"displayName\":\"TestLight\",\"UUID\":\"00000043-0000-1000-8000-0026BB765291\"," +
          "\"subtype\":\"subtype\",\"hiddenService\":false,\"primaryService\":false," +
          "\"characteristics\":[{\"displayName\":\"Name\",\"UUID\":\"00000023-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"TestLight\",\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"On\",\"UUID\":\"00000025-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"bool\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\",\"pw\",\"ev\"]}," +
          "\"value\":false,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}]," +
          "\"optionalCharacteristics\":[{\"displayName\":\"Brightness\",\"UUID\":\"00000008-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"int\",\"unit\":\"percentage\",\"minValue\":0,\"maxValue\":100,\"minStep\":1," +
          "\"perms\":[\"pr\",\"pw\",\"ev\"]},\"value\":0,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Hue\",\"UUID\":\"00000013-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"float\",\"unit\":\"arcdegrees\",\"minValue\":0,\"maxValue\":360,\"minStep\":1,\"perms\":[\"pr\",\"pw\",\"ev\"]}," +
          "\"value\":0,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Saturation\",\"UUID\":\"0000002F-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"float\"," +
          "\"unit\":\"percentage\",\"minValue\":0,\"maxValue\":100,\"minStep\":1,\"perms\":[\"pr\",\"pw\",\"ev\"]},\"value\":0," +
          "\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false},{\"displayName\":\"Name\"," +
          "\"UUID\":\"00000023-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null," +
          "\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"\"," +
          "\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}," +
          "{\"displayName\":\"Color Temperature\",\"UUID\":\"000000CE-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"uint32\",\"unit\":null,\"minValue\":140,\"maxValue\":500,\"minStep\":1,\"perms\":[\"pr\",\"pw\",\"ev\"]}," +
          "\"value\":140,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}]}," +
          "{\"displayName\":\"TestSwitch\",\"UUID\":\"00000049-0000-1000-8000-0026BB765291\",\"subtype\":\"subtype\"," +
          "\"hiddenService\":false,\"primaryService\":false,\"characteristics\":[{\"displayName\":\"Name\"," +
          "\"UUID\":\"00000023-0000-1000-8000-0026BB765291\",\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null," +
          "\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]},\"value\":\"TestSwitch\",\"accessRestrictedToAdmins\":[]," +
          "\"eventOnlyCharacteristic\":false},{\"displayName\":\"On\",\"UUID\":\"00000025-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"bool\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null," +
          "\"perms\":[\"pr\",\"pw\",\"ev\"]},\"value\":false,\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}]," +
          "\"optionalCharacteristics\":[{\"displayName\":\"Name\",\"UUID\":\"00000023-0000-1000-8000-0026BB765291\"," +
          "\"props\":{\"format\":\"string\",\"unit\":null,\"minValue\":null,\"maxValue\":null,\"minStep\":null,\"perms\":[\"pr\"]}," +
          "\"value\":\"\",\"accessRestrictedToAdmins\":[],\"eventOnlyCharacteristic\":false}]}]," +
          "\"linkedServices\":{\"00000043-0000-1000-8000-0026BB765291subtype\":[\"00000049-0000-1000-8000-0026BB765291subtype\"]}}");

      const accessory = Accessory.deserialize(json);

      expect(accessory.displayName).toEqual(json.displayName);
      expect(accessory.UUID).toEqual(json.UUID);
      expect(accessory.category).toEqual(json.category);

      expect(accessory.services).toBeDefined();
      expect(accessory.services.length).toEqual(3);
      expect(accessory.getService(Service.Lightbulb)).toBeDefined();
      expect(accessory.getService(Service.Lightbulb)!.linkedServices.length).toEqual(1);
      expect(accessory.getService(Service.Lightbulb)!.linkedServices[0].UUID).toEqual(Service.Switch.UUID);
    });
  });

  describe("Controller", () => {
    it("should deserialize controllers and remove/add/replace services correctly", () => {
      accessory.configureController(new TestController());

      const serialized = Accessory.serialize(accessory);

      const restoredAccessory = Accessory.deserialize(serialized);
      restoredAccessory.configureController(new TestController()); // restore Controller;

      expect(restoredAccessory.services).toBeDefined();
      expect(restoredAccessory.services.length).toEqual(3); // accessory information, light sensor, outlet

      expect(restoredAccessory.getService(Service.Lightbulb)).toBeUndefined();
      expect(restoredAccessory.getService(Service.LightSensor)).toBeDefined();
      expect(restoredAccessory.getService(Service.Outlet)).toBeDefined();
      expect(restoredAccessory.getService(Service.Switch)).toBeUndefined();
    });
  });
});

class TestController implements Controller {

  controllerId(): ControllerIdentifier {
    return "test-id";
  }

  constructServices(): ControllerServiceMap {
    const lightService = new Service.Lightbulb("", "");
    const switchService = new Service.Switch("", "");

    return {
      light: lightService,
      switch: switchService,
    };
  }

  initWithServices(serviceMap: ControllerServiceMap): void | ControllerServiceMap {
    // serviceMap will be altered here to test update procedure
    delete serviceMap.switch;
    serviceMap.light = new Service.LightSensor("", "");
    serviceMap.outlet = new Service.Outlet("", "");

    return serviceMap;
  }

  configureServices(): void {
    // do nothing
  }

  handleControllerRemoved(): void {
    // do nothing
  }

}
