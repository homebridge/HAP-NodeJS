import crypto from "crypto";
import {
  AccessoriesResponse,
  CharacteristicJsonObject,
  CharacteristicReadData,
  CharacteristicsReadRequest,
  CharacteristicsReadResponse,
  CharacteristicsWriteRequest,
  CharacteristicsWriteResponse,
  CharacteristicValue,
  CharacteristicWriteData,
  InterfaceName,
  IPAddress,
  ResourceRequest,
  ResourceRequestType,
} from "../types";
import { Accessory, AccessoryEventTypes, Categories, CharacteristicWarningType, MDNSAdvertiser, PublishInfo } from "./Accessory";
import { BonjourHAPAdvertiser } from "./Advertiser";
import { Bridge } from "./Bridge";
import {
  Access,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  Formats,
  Perms,
  Units,
} from "./Characteristic";
import { CameraController, Controller, ControllerIdentifier, ControllerServiceMap } from "./controller";
import { createCameraControllerOptions, MOCK_IMAGE, MockLegacyCameraSource } from "./controller/CameraController.spec";
import { HAPHTTPCode, HAPStatus, IdentifyCallback, TLVErrorCode } from "./HAPServer";
import { AccessoryInfo, PairingInformation, PermissionTypes } from "./model/AccessoryInfo";
import { IdentifierCache } from "./model/IdentifierCache";
import { Service } from "./Service";
import { EventedHTTPServer, HAPConnection } from "./util/eventedhttp";
import { HapStatusError } from "./util/hapStatusError";
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

  let accessoryInfoUnpaired: AccessoryInfo;
  let accessoryInfoPaired: AccessoryInfo;
  const saveMock: Mock = jest.fn();

  let callback: Mock;
  // a void promise to wait for the above callback to be called!
  let callbackPromise: Promise<void>;

  beforeEach(() => {
    clientPublicKey0 = crypto.randomBytes(32);
    clientPublicKey1 = crypto.randomBytes(32);

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

  describe("handling services", () => {
    test("addService", () => {
      const existingCount = 1; // accessoryInformation service; protocolInformation is only added on publish

      const instance = new Service.Switch("Switch");
      expect(accessory.services.length).toEqual(existingCount);

      const switchService = accessory.addService(instance);
      expect(accessory.services.length).toEqual(existingCount + 1);
      expect(accessory.services.includes(instance)).toBeTruthy();
      expect(switchService).toBe(instance);

      const outletService = accessory.addService(Service.Outlet, "Outlet");
      expect(outletService.displayName).toEqual("Outlet");
      expect(accessory.services.length).toEqual(existingCount + 2);
      expect(accessory.services.includes(outletService)).toBeTruthy();

      // CHECKING DUPLICATES
      const instance0 = new Service.Switch("Switch1");
      expect(() => accessory.addService(instance0)).toThrow();

      const instance1 = accessory.addService(Service.Switch, "Switch2", "subtype");
      expect(instance1.displayName).toEqual("Switch2");
      expect(() => accessory.addService(Service.Switch, "Switch3", "subtype")).toThrow();

      expect(accessory.getService(Service.Switch))
        .toBe(instance);
      expect(accessory.getService("Switch"))
        .toBe(instance);

      expect(accessory.getServiceById(Service.Switch, "subtype"))
        .toBe(instance1);
      expect(accessory.getServiceById("Switch2", "subtype"))
        .toBe(instance1);
      expect(accessory.getServiceById("Switch3", "subtype"))
        .toBeUndefined();
    });

    test("removeService", () => {
      const existingCount = 1; // accessoryInformation service; protocolInformation is only added on publish

      const instance = new Service.Switch("Switch");
      instance.setPrimaryService();
      expect(accessory.services.length).toEqual(existingCount);


      accessory.addService(instance);
      expect(accessory.services.length).toEqual(existingCount + 1);

      const outlet = accessory.addService(Service.Outlet);
      outlet.addLinkedService(instance);
      expect(accessory.services.length).toEqual(existingCount + 2);

      accessory.removeService(instance);
      expect(accessory.services.length).toEqual(existingCount + 1);
      expect(accessory.services.includes(instance)).toBeFalsy();

      // HANDLING PRIMARY AND LINKED SERVICES
      // @ts-expect-error: private access
      expect(accessory.primaryService).toBe(undefined);
      expect(instance.isPrimaryService).toBeTruthy();
      expect(outlet.linkedServices.length).toEqual(0);
    });

    test("primary service handling", () => {
      const instance = new Service.Switch("Switch");
      instance.setPrimaryService();
      accessory.addService(instance);

      // @ts-expect-error: private access
      expect(accessory.primaryService).toBe(instance);

      const outlet = new Service.Outlet("Outlet");
      // noinspection JSDeprecatedSymbols
      accessory.setPrimaryService(outlet);
      accessory.addService(outlet);

      // @ts-expect-error: private access
      expect(accessory.primaryService).toBe(outlet);
      expect(instance.isPrimaryService).toBeFalsy();
      expect(outlet.isPrimaryService).toBeTruthy();

      instance.setPrimaryService();
      // @ts-expect-error: private access
      expect(accessory.primaryService).toBe(instance);
      expect(instance.isPrimaryService).toBeTruthy();
      expect(outlet.isPrimaryService).toBeFalsy();

      instance.setPrimaryService(false);
      // @ts-expect-error: private access
      expect(accessory.primaryService).toBe(undefined);
      expect(instance.isPrimaryService).toBeFalsy();
      expect(outlet.isPrimaryService).toBeFalsy();
    });
  });

  describe("bridged accessories", () => {
    test("addBridgedAccessory", () => {
      const bridge = new Bridge("TestBridge", uuid.generate("bridge test"));

      bridge.addBridgedAccessories([ accessory ]);
      expect(bridge.bridged).toBeFalsy();
      expect(bridge.bridge).toBeUndefined();
      expect(accessory.bridged).toBeTruthy();
      expect(accessory.bridge).toBe(bridge);

      expect(bridge.getPrimaryAccessory()).toBe(bridge);
      expect(accessory.getPrimaryAccessory()).toBe(bridge);

      expect(bridge.bridgedAccessories.includes(accessory)).toBeTruthy();

      expect(() => bridge.addBridgedAccessory(accessory)).toThrow();
      expect(() => bridge.addBridgedAccessory(new Bridge("asdf", uuid.generate("asdf"))))
        .toThrow();
    });

    test("removeBridgedAccessory", () => {
      const bridge = new Bridge("TestBridge", uuid.generate("bridge test"));

      const validate = () => {
        expect(bridge.bridged).toBeFalsy();
        expect(bridge.bridge).toBeUndefined();
        expect(accessory.bridged).toBeFalsy();
        expect(accessory.bridge).toBeUndefined();

        expect(bridge.getPrimaryAccessory()).toBe(bridge);
        expect(accessory.getPrimaryAccessory()).toBe(accessory);

        expect(bridge.bridgedAccessories.includes(accessory)).toBeFalsy();
      };

      bridge.addBridgedAccessories([ accessory ]);
      bridge.removeBridgedAccessory(accessory);
      validate();

      bridge.addBridgedAccessories([ accessory ]);
      bridge.removeBridgedAccessories([ accessory ]);
      validate();

      bridge.addBridgedAccessories([ accessory ]);
      bridge.removeAllBridgedAccessories();
      validate();

      expect(() => bridge.removeBridgedAccessory(accessory)).toThrow();
    });

    test("getAccessoryByAID", () => {
      const bridge = new Bridge("TestBridge", uuid.generate("bridge test"));
      bridge.addBridgedAccessory(accessory);

      bridge._identifierCache = new IdentifierCache(serverUsername);
      bridge._assignIDs(bridge._identifierCache);

      // @ts-expect-error: private access
      expect(bridge.getAccessoryByAID(1)).toBe(bridge);
      // @ts-expect-error: private access
      expect(bridge.getAccessoryByAID(2)).toBe(accessory);
      // @ts-expect-error: private access
      expect(accessory.getAccessoryByAID(2)).toBe(accessory);
    });
  });

  describe("accessory controllers", () => {
    test("configureController deserialize controllers and remove/add/replace services correctly", () => {
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

    test("legacy configure camera source", async () => {
      const microphone = new Service.Microphone();
      const source = new MockLegacyCameraSource(2);
      source.services.push(microphone);

      const expectedOptions = source.streamControllers[0].options;

      // noinspection JSDeprecatedSymbols
      accessory.configureCameraSource(source);

      expect(accessory.getServiceById(Service.CameraRTPStreamManagement, "0")).toBeDefined();
      expect(accessory.getServiceById(Service.CameraRTPStreamManagement, "1")).toBeDefined();
      expect(accessory.getService(Service.Microphone)).toBe(microphone);

      // @ts-expect-error: private access
      const cameraController = accessory.activeCameraController!;
      expect(cameraController).toBeDefined();

      // @ts-expect-error: private access
      expect(cameraController.streamCount).toEqual(2);
      // @ts-expect-error: private access
      expect(cameraController.streamingOptions).toEqual(expectedOptions);

      // @ts-expect-error: private access
      accessory.handleResource({
        "resource-type": ResourceRequestType.IMAGE,
        "image-width": 200,
        "image-height": 200,
      }, callback);

      await callbackPromise;

      expect(callback).toHaveBeenCalledWith(undefined, MOCK_IMAGE);
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
        accessory.handleAddPairing(connection, clientUsername1, crypto.randomBytes(32), PermissionTypes.ADMIN, callback);
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
    let onCharacteristic: Characteristic;

    const aid = 1;
    const iids = {
      accessoryInformation: 1,
      identify: 2,
      manufacturer: 3,
      model: 4,
      accessoryName: 5,
      serialNumber: 6,
      firmwareRevision: 7,

      switch: 8,
      switchName: 9,
      on: 10,

      protocolInformation: 11,
      version: 12,
    };

    beforeEach(() => {
      const loadBackup = AccessoryInfo.load;
      AccessoryInfo.load = jest.fn(() => {
        // inject our mocked accessoryInfo object
        return accessoryInfoPaired;
      });

      const publishInfo: PublishInfo = {
        username: serverUsername,
        pincode: "123-45-678",
        category: Categories.SWITCH,
      };

      switchService = new Service.Switch("Switch");
      accessory.addService(switchService);

      onCharacteristic = switchService.getCharacteristic(Characteristic.On);

      accessory.publish(publishInfo);

      AccessoryInfo.load = loadBackup;

      // saveMock may be called in `publish`
      saveMock.mockReset();

      expect(aid).toEqual(accessory.aid);
    });

    test("purgeUnusedIDs", () => {
      expect(accessory.shouldPurgeUnusedIDs).toBeTruthy();
      accessory.purgeUnusedIDs();
      expect(accessory.shouldPurgeUnusedIDs).toBeTruthy();

      accessory.disableUnusedIDPurge();

      expect(accessory.shouldPurgeUnusedIDs).toBeFalsy();
      accessory.purgeUnusedIDs();
      expect(accessory.shouldPurgeUnusedIDs).toBeFalsy();

      accessory.enableUnusedIDPurge();
      expect(accessory.shouldPurgeUnusedIDs).toBeTruthy();
    });

    test("setupURI", () => {
      let setupURI = accessory.setupURI();

      const originalSetupURI = setupURI;

      expect(setupURI.startsWith("X-HM://")).toBeTruthy();
      setupURI = setupURI.substring(7);

      const encodedPayload = setupURI.substring(0, 9);
      const setupId = setupURI.substring(9);

      expect(setupId).toEqual(accessory._setupID);

      const payload = parseInt(encodedPayload, 36);
      const low = payload & 0xFFFFFFFF;
      const high = (payload - low) / 0x100000000;

      const setupCode = low & 0x7FFFFFF;
      const pairedWithController = (low >> 27) & 0x01;
      const supportsIP = (low >> 28) & 0x01;
      const supportsBLE = (low >> 29) & 0x01;
      const supportsWAC = (low >> 30) & 0x01;
      const category = ((low >> 31) & 0x01) + ((high & 0x7F) << 1);
      const reserved = (high >> 8) & 0xF;
      const version = (high >> 12) & 0x7;

      expect(setupCode).toEqual(parseInt(accessory._accessoryInfo!.pincode.replace(/-/g, ""), 10));
      expect(pairedWithController).toEqual(0);
      expect(supportsIP).toEqual(1);
      expect(supportsBLE).toEqual(0);
      expect(supportsWAC).toEqual(0);
      expect(category).toEqual(Categories.SWITCH);
      expect(reserved).toEqual(0);
      expect(version).toEqual(0);

      expect(accessory.setupURI()).toEqual(originalSetupURI);
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

        // TODO test Service.toHAP and Characteristic.toHAP separately!
        const expected: AccessoriesResponse = {
          accessories: [{
            aid: aid,
            services: [
              {
                iid: iids.accessoryInformation,
                type: toShortForm(Service.AccessoryInformation.UUID),
                hidden: undefined,
                primary: undefined,
                characteristics: [
                  await characteristicHAPInfo(Characteristic.Identify, iids.identify),
                  await characteristicHAPInfo(Characteristic.Manufacturer, iids.manufacturer),
                  await characteristicHAPInfo(Characteristic.Model, iids.model),
                  await characteristicHAPInfo(Characteristic.Name, iids.accessoryName, accessory.displayName),
                  await characteristicHAPInfo(Characteristic.SerialNumber, iids.serialNumber),
                  await characteristicHAPInfo(Characteristic.FirmwareRevision, iids.firmwareRevision),
                ],
              },
              {
                iid: iids.switch,
                type: toShortForm(Service.Switch.UUID),
                hidden: undefined,
                primary: undefined,
                characteristics: [
                  await characteristicHAPInfo(Characteristic.Name, iids.switchName, "Switch"),
                  await characteristicHAPInfo(Characteristic.On, iids.on, false),
                ],
              },
              {
                iid: iids.protocolInformation,
                type: toShortForm(Service.ProtocolInformation.UUID),
                hidden: undefined,
                primary: undefined,
                characteristics: [
                  await characteristicHAPInfo(Characteristic.Version, iids.version, "1.1.0"),
                ],
              },
            ],
          }],
        };
        expect(callback).toBeCalledTimes(1);
        expect(callback).toBeCalledWith(undefined, expected);
      });
    });

    describe("handleGetCharacteristic", () => {
      const testRequestResponse = async (
        request: Partial<CharacteristicsReadRequest>,
        ...expectedReadData: CharacteristicReadData[]
      ): Promise<void> => {
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
          ids: [{ aid: aid, iid: iids.on }],
        }, {
          aid: aid,
          iid: iids.on,
          value: 0,
        });

        // testing that errors are forwarded properly!
        onCharacteristic.onGet(() => {
          throw new HapStatusError(HAPStatus.OUT_OF_RESOURCE);
        });

        await testRequestResponse({
          ids: [{ aid: aid, iid: iids.on }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.OUT_OF_RESOURCE,
        });
      });

      test("read non-existent characteristic", async () => {
        await testRequestResponse({
          ids: [{ aid: 2, iid: iids.on }],
        }, {
          aid: 2,
          iid: iids.on,
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
          ids: [{ aid: aid, iid: iids.identify }],
        }, {
          aid: aid,
          iid: iids.identify,
          status: HAPStatus.WRITE_ONLY_CHARACTERISTIC,
        });
      });

      test("read includeMeta, includePerms, includeType, includeEvent", async () => {
        const ids = [{ aid: aid, iid: iids.on }];
        const partialExpectedResponse = {
          aid: aid,
          iid: iids.on,
          value: 0,
        };

        const customCharacteristic = new Characteristic("Custom", uuid.generate("custom"), {
          format: Formats.UINT64,
          perms: [Perms.PAIRED_READ],
          unit: Units.SECONDS,
          minValue: 10,
          maxValue: 100,
          minStep: 2,
        });
        customCharacteristic.value = 20;
        switchService.addCharacteristic(customCharacteristic);
        accessory._assignIDs(accessory._identifierCache!);

        await testRequestResponse({
          ids: ids,
          includeMeta: true,
        }, {
          ...partialExpectedResponse,
          format: Formats.BOOL,
        });

        await testRequestResponse({
          ids: [{ aid: aid, iid: customCharacteristic.iid! }],
          includeMeta: true,
        }, {
          aid: aid,
          iid: customCharacteristic.iid!,
          value: 20,
          format: Formats.UINT64,
          unit: Units.SECONDS,
          minValue: 10,
          maxValue: 100,
          minStep: 2,
        });

        await testRequestResponse({
          ids: [{ aid: aid, iid: iids.serialNumber }],
          includeMeta: true,
        }, {
          aid: aid,
          iid: 6,
          value: "Default-SerialNumber",
          format: Formats.STRING,
          maxLen: 64,
        });

        await testRequestResponse({
          ids: ids,
          includePerms: true,
        }, {
          ...partialExpectedResponse,
          perms: [Perms.NOTIFY, Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        });

        await testRequestResponse({
          ids: ids,
          includeType: true,
        }, {
          ...partialExpectedResponse,
          type: toShortForm(Characteristic.On.UUID),
        });


        const hasEventNotificationsMock: Mock<boolean, [number, number]> = jest.fn();
        connection.hasEventNotifications = hasEventNotificationsMock;

        hasEventNotificationsMock.mockImplementationOnce(() => true);
        await testRequestResponse({
          ids: ids,
          includeEvent: true,
        }, {
          ...partialExpectedResponse,
          ev: true,
        });
        expect(hasEventNotificationsMock).toHaveBeenCalledWith(aid, iids.on);
        hasEventNotificationsMock.mockReset();

        hasEventNotificationsMock.mockImplementationOnce(() => false);
        await testRequestResponse({
          ids: ids,
          includeEvent: true,
        }, {
          ...partialExpectedResponse,
          ev: false,
        });
        expect(hasEventNotificationsMock).toHaveBeenCalledWith(aid, iids.on);
      });

      test("reading adminOnly", async () => {
        onCharacteristic.setProps({
          adminOnlyAccess: [Access.READ],
        });

        await testRequestResponse({
          ids: [{ aid: aid, iid: iids.on }],
        }, {
          aid: aid,
          iid: iids.on,
          value: 0,
        });

        connection.username = clientUsername1;
        await testRequestResponse({
          ids: [{ aid: aid, iid: iids.on }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });

        connection.username = undefined;
        accessory._accessoryInfo = undefined;

        await testRequestResponse({
          ids: [{ aid: aid, iid: iids.on }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });
      });
    });

    describe("handleSetCharacteristic", () => {
      const testRequestResponse = async (
        request: Partial<CharacteristicsWriteRequest>,
        ...expectedReadData: CharacteristicWriteData[]
      ): Promise<void> => {
        // @ts-expect-error: private access
        accessory.handleSetCharacteristics(connection, {
          characteristics: [],
          ...request,
        }, callback);

        await callbackPromise;

        const expectedResponse: CharacteristicsWriteResponse = {
          characteristics: expectedReadData,
        };

        expect(callback).toBeCalledTimes(1);
        expect(callback).toBeCalledWith(undefined, expectedResponse);

        callback.mockReset();
      };

      test("write Switch.On characteristic", async () => {
        await testRequestResponse({
          characteristics: [{
            aid: aid,
            iid: iids.on,
            value: true,
          }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });

        expect(onCharacteristic.value).toEqual(true);

        // testing that errors are forwarder properly
        onCharacteristic.onSet(() => {
          throw new HapStatusError(HAPStatus.RESOURCE_BUSY);
        });

        await testRequestResponse({
          characteristics: [{
            aid: aid,
            iid: iids.on,
            value: true,
          }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.RESOURCE_BUSY,
        });
      });

      test.each([true, false])(
        "write-response characteristic with requesting r: %s", async rValue => {
          onCharacteristic.props.perms.push(Perms.WRITE_RESPONSE);

          onCharacteristic.on(CharacteristicEventTypes.SET, (value, callback) => {
            expect(value).toEqual(false);
            callback(undefined, true);
          });

          await testRequestResponse({
            characteristics: [{ aid: aid, iid: iids.on, value: false, r: rValue }],
          }, {
            aid: aid,
            iid: iids.on,
            status: HAPStatus.SUCCESS,
            value: rValue ? 1 : undefined,
          });
        });

      test("requesting write-response on non-write-response characteristic", async () => {
        onCharacteristic.onSet(() => {
          return true; // write response
        });

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: false, r: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
      });

      test("write non-existent characteristic", async () => {
        await testRequestResponse({
          characteristics: [{ aid: 2, iid: iids.on, value: true }],
        }, {
          aid: 2,
          iid: iids.on,
          status: HAPStatus.INVALID_VALUE_IN_REQUEST,
        });

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: 15, value: true }],
        }, {
          aid: aid,
          iid: 15,
          status: HAPStatus.INVALID_VALUE_IN_REQUEST,
        });
      });

      test("writing read-only characteristic", async () => {
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.model, value: "New Model" }],
        }, {
          aid: aid,
          iid: iids.model,
          status: HAPStatus.READ_ONLY_CHARACTERISTIC,
        });
      });

      test("writing adminOnly", async () => {
        onCharacteristic.setProps({
          adminOnlyAccess: [Access.WRITE],
        });

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });

        connection.username = clientUsername1; // changing to non-adming username
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });

        connection.username = undefined;
        accessory._accessoryInfo = undefined;

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });
      });

      test("enabling and disabling event notifications", async () => {
        const hasEventNotificationsMock: Mock<boolean, [number, number]> = jest.fn();
        connection.hasEventNotifications = hasEventNotificationsMock;
        connection.enableEventNotifications = jest.fn();
        connection.disableEventNotifications = jest.fn();

        hasEventNotificationsMock.mockImplementationOnce(() => false);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: false }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(connection.enableEventNotifications).not.toBeCalled();
        expect(connection.disableEventNotifications).not.toBeCalled();
        // @ts-expect-error: private access
        expect(onCharacteristic.subscriptions).toEqual(0);

        hasEventNotificationsMock.mockImplementationOnce(() => false);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(connection.enableEventNotifications).toHaveBeenCalledWith(aid, iids.on);
        // @ts-expect-error: private access
        expect(onCharacteristic.subscriptions).toEqual(1);

        hasEventNotificationsMock.mockImplementationOnce(() => true);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(connection.enableEventNotifications).toBeCalledTimes(1); // >stays< at 1 invocation
        expect(connection.disableEventNotifications).not.toBeCalled();
        // @ts-expect-error: private access
        expect(onCharacteristic.subscriptions).toEqual(1);

        hasEventNotificationsMock.mockImplementationOnce(() => true);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: false }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(connection.disableEventNotifications).toHaveBeenCalledWith(aid, iids.on);
        // @ts-expect-error: private access
        expect(onCharacteristic.subscriptions).toEqual(0);
      });

      test("unsupported event notifications", async () => {
        connection.hasEventNotifications = jest.fn(() => false);

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.model, ev: true }],
        }, {
          aid: aid,
          iid: iids.model,
          status: HAPStatus.NOTIFICATION_NOT_SUPPORTED,
        });

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.model, ev: false }],
        }, {
          aid: aid,
          iid: iids.model,
          status: HAPStatus.NOTIFICATION_NOT_SUPPORTED,
        });
      });

      test("clearing event notifications on disconnect", async () => {
        const hasEventNotificationsMock: Mock<boolean, [number, number]> = jest.fn();
        connection.hasEventNotifications = hasEventNotificationsMock;
        connection.enableEventNotifications = jest.fn();

        hasEventNotificationsMock.mockImplementationOnce(() => false);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(connection.enableEventNotifications).toBeCalled();
        // @ts-expect-error: private access
        expect(onCharacteristic.subscriptions).toEqual(1);

        connection.getRegisteredEvents = jest.fn(() => {
          return new Set([aid + "." + iids.on]);
        });
        connection.clearRegisteredEvents = jest.fn();

        // @ts-expect-error: private access
        const originalImplementation = accessory.findCharacteristic.bind(accessory);
        // @ts-expect-error: private access
        accessory.findCharacteristic = jest.fn((aid, iid) => {
          return originalImplementation(aid, iid);
        });

        // @ts-expect-error: private access
        accessory.handleHAPConnectionClosed(connection);

        expect(connection.clearRegisteredEvents).toBeCalled();
        // @ts-expect-error: private access
        expect(accessory.findCharacteristic).toHaveBeenCalledWith(aid, iids.on);
        // @ts-expect-error: private access
        expect(onCharacteristic.subscriptions).toEqual(0);
      });

      test("adminOnly notifications", async () => {
        connection.hasEventNotifications = jest.fn(() => false);
        connection.enableEventNotifications = jest.fn();
        connection.disableEventNotifications = jest.fn();

        onCharacteristic.setProps({
          adminOnlyAccess: [Access.NOTIFY],
        });

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(connection.enableEventNotifications).toHaveBeenCalledTimes(1);

        connection.username = clientUsername1; // changing to non-admin username
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });


        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: false }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });

        connection.username = undefined;
        accessory._accessoryInfo = undefined;

        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, ev: true }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_PRIVILEGES,
        });
      });

      test("write with additional authorization", async () => {
        const handler: Mock<boolean, (string | undefined)[]> = jest.fn();

        // write with no handler
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true, authData: "xyz" }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });

        onCharacteristic.setupAdditionalAuthorization(handler);

        // allowed to write
        handler.mockImplementationOnce(() => true);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true, authData: "xyz" }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.SUCCESS,
        });
        expect(handler).toHaveBeenCalledWith("xyz");

        // rejected write
        handler.mockImplementationOnce(() => false);
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true, authData: "xyz" }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_AUTHORIZATION,
        });
        expect(handler).toHaveBeenCalledWith("xyz");

        // exception
        handler.mockImplementationOnce(() => {
          throw new Error("EXPECTED TEST ERROR");
        });
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on, value: true, authData: "xyz" }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INSUFFICIENT_AUTHORIZATION,
        });
        expect(handler).toHaveBeenCalledWith("xyz");
      });

      test.each([false, true])(
        "timed write with timed write being required: %s", async timedWriteRequired => {
          if (timedWriteRequired) {
            onCharacteristic.props.perms.push(Perms.TIMED_WRITE);

            await testRequestResponse({
              characteristics: [{ aid: aid, iid: iids.on, value: true }],
            }, {
              aid: aid,
              iid: iids.on,
              status: HAPStatus.INVALID_VALUE_IN_REQUEST,
            });
          }

          await testRequestResponse({
            characteristics: [{ aid: aid, iid: iids.on, value: true }],
            pid: 1337, // pid already expired
          }, {
            aid: aid,
            iid: iids.on,
            status: HAPStatus.INVALID_VALUE_IN_REQUEST,
          });

          connection.timedWritePid = 1337;
          connection.timedWriteTimeout = setTimeout(() => {
            fail(new Error("timed-write timeout was never cleared"));
          }, 1000);

          await testRequestResponse({
            characteristics: [{ aid: aid, iid: iids.on, value: true }],
            pid: 1336, // invalid pid
          }, {
            aid: aid,
            iid: iids.on,
            status: HAPStatus.INVALID_VALUE_IN_REQUEST,
          });

          await testRequestResponse({
            characteristics: [{ aid: aid, iid: iids.on, value: true }],
            pid: 1337, // correct pid
          }, {
            aid: aid,
            iid: iids.on,
            status: HAPStatus.SUCCESS,
          });

          await testRequestResponse({
            characteristics: [{ aid: aid, iid: iids.on, value: true }],
            pid: 1337, // can't reuse pid
          }, {
            aid: aid,
            iid: iids.on,
            status: HAPStatus.INVALID_VALUE_IN_REQUEST,
          });
        });

      test("empty write", async () => {
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.on }],
        }, {
          aid: aid,
          iid: iids.on,
          status: HAPStatus.INVALID_VALUE_IN_REQUEST,
        });
      });

      test("Identify Write", async () => {
        // PAIRED IDENTIFY
        await testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.identify, value: true }],
        }, {
          aid: aid,
          iid: iids.identify,
          status: HAPStatus.SUCCESS,
        });

        const eventPromise: Promise<[boolean, IdentifyCallback]> = awaitEventOnce(accessory, AccessoryEventTypes.IDENTIFY);
        const response = testRequestResponse({
          characteristics: [{ aid: aid, iid: iids.identify, value: true }],
        }, {
          aid: aid,
          iid: iids.identify,
          status: HAPStatus.SUCCESS,
        });

        const eventResult = await eventPromise;
        expect(eventResult[0]).toEqual(true);
        eventResult[1]();

        await response;
      });
    });

    describe("handleResource", () => {
      let cameraController: CameraController;
      beforeEach(() => {
        cameraController = new CameraController(createCameraControllerOptions());
        accessory.configureController(cameraController);
      });

      const testRequestResponse = async (partial: Partial<ResourceRequest> = {}) => {
        // @ts-expect-error: private access
        accessory.handleResource({
          "resource-type": ResourceRequestType.IMAGE,
          "image-width": 200,
          "image-height": 200,
          ...partial,
        }, callback);

        await callbackPromise;

      };

      test("unknown resource type", () => {
        // @ts-expect-error: private access
        accessory.handleResource({ "resource-type": "unknown" }, callback);

        expect(callback).toHaveBeenCalledWith({
          httpCode: HAPHTTPCode.NOT_FOUND,
          status: HAPStatus.RESOURCE_DOES_NOT_EXIST,
        });
      });

      test("missing camera controller", () => {
        accessory.removeController(cameraController);

        // @ts-expect-error: private access
        accessory.handleResource({
          "resource-type": ResourceRequestType.IMAGE,
          "image-width": 200,
          "image-height": 200,
        }, callback);

        expect(callback).toHaveBeenCalledWith({
          httpCode: HAPHTTPCode.NOT_FOUND,
          status: HAPStatus.RESOURCE_DOES_NOT_EXIST,
        });
      });

      test("retrieve image resource", async () => {
        await testRequestResponse();
        expect(callback).toHaveBeenCalledWith(undefined, MOCK_IMAGE);

        await testRequestResponse({ aid: 1 });
        expect(callback).toHaveBeenCalledWith(undefined, MOCK_IMAGE);
      });

      test("retrieve image resource on bridge", async () => {
        accessory.addBridgedAccessory(new Accessory("Bridged accessory", uuid.generate("bridged")));
        accessory._assignIDs(accessory._identifierCache!);

        await testRequestResponse();
        expect(callback).toHaveBeenCalledWith(undefined, MOCK_IMAGE);

        await testRequestResponse({ aid: 1 });
        expect(callback).toHaveBeenCalledWith(undefined, MOCK_IMAGE);
      });

      test("retrieve image resource on bridged accessory", async () => {
        accessory.removeController(cameraController);

        const bridged = new Accessory("Bridged accessory", uuid.generate("bridged"));
        bridged.configureController(cameraController);

        accessory.addBridgedAccessory(bridged);
        accessory._assignIDs(accessory._identifierCache!);
        expect(bridged.aid).toBeDefined();

        await testRequestResponse();
        expect(callback).toHaveBeenCalledWith({
          httpCode: HAPHTTPCode.NOT_FOUND,
          status: HAPStatus.RESOURCE_DOES_NOT_EXIST,
        });

        await testRequestResponse({ aid: 1 });
        expect(callback).toHaveBeenCalledWith({
          httpCode: HAPHTTPCode.NOT_FOUND,
          status: HAPStatus.RESOURCE_DOES_NOT_EXIST,
        });

        await testRequestResponse({ aid: bridged.aid! });
        expect(callback).toHaveBeenCalledWith(undefined, MOCK_IMAGE);
      });

      test("properly forward erroneous conditions", async () => {
        cameraController.recordingManagement!.operatingModeService
          .getCharacteristic(Characteristic.HomeKitCameraActive)
          .value = false;

        await testRequestResponse();
        expect(callback).toHaveBeenCalledWith({ httpCode: HAPHTTPCode.MULTI_STATUS, status: HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE });
      });
    });

    describe("characteristic read/write characteristicWarning", () => {
      // @ts-expect-error: private access
      const originalWarning = Accessory.TIMEOUT_WARNING;
      // @ts-expect-error: private access
      const originalTimeoutAfterWarning = Accessory.TIMEOUT_AFTER_WARNING;

      let characteristicWarningHandler: Mock<void, [Characteristic, CharacteristicWarningType, string]>;

      const adjustTimeouts = (warning: number, timeout: number) => {
        // @ts-expect-error: private access
        Accessory.TIMEOUT_WARNING = warning;
        // @ts-expect-error: private access
        Accessory.TIMEOUT_AFTER_WARNING = timeout;
      };

      beforeEach(() => {
        characteristicWarningHandler = jest.fn();
        // @ts-expect-error: private access
        accessory.sendCharacteristicWarning = characteristicWarningHandler;
      });

      afterEach(() => {
        adjustTimeouts(originalWarning, originalTimeoutAfterWarning);
      });

      test("slow read notification", async () => {
        adjustTimeouts(60, 10000);

        const getEvent: Promise<[CharacteristicGetCallback]> = awaitEventOnce(onCharacteristic, CharacteristicEventTypes.GET);

        // @ts-expect-error: private access
        accessory.handleGetCharacteristics(connection, {
          ids: [{ aid: aid, iid: iids.on }],
          includeMeta: false,
          includeEvent: false,
          includeType: false,
          includePerms: false,
        }, callback);

        await PromiseTimeout(2);
        expect(callback).not.toHaveBeenCalled();

        await PromiseTimeout(70);
        expect(characteristicWarningHandler)
          .toHaveBeenCalledWith(onCharacteristic, CharacteristicWarningType.SLOW_READ, expect.anything());

        const eventResult = await getEvent;
        eventResult[0](undefined, true);

        await callbackPromise;
        expect(callback).toHaveBeenCalledWith(undefined, {
          characteristics: [{
            aid: aid,
            iid: iids.on,
            value: 1,
          }],
        });
      });

      test("timeout read notification", async () => {
        adjustTimeouts(10, 50);

        const getEvent: Promise<[CharacteristicGetCallback]> = awaitEventOnce(onCharacteristic, CharacteristicEventTypes.GET);

        // @ts-expect-error: private access
        accessory.handleGetCharacteristics(connection, {
          ids: [{ aid: aid, iid: iids.on }],
          includeMeta: false,
          includeEvent: false,
          includeType: false,
          includePerms: false,
        }, callback);

        await PromiseTimeout(2);
        expect(callback).not.toHaveBeenCalled();

        await PromiseTimeout(70);
        expect(characteristicWarningHandler)
          .toHaveBeenCalledWith(onCharacteristic, CharacteristicWarningType.SLOW_READ, expect.anything());
        expect(characteristicWarningHandler)
          .toHaveBeenCalledWith(onCharacteristic, CharacteristicWarningType.TIMEOUT_READ, expect.anything());

        const eventResult = await getEvent;
        eventResult[0](undefined, true);

        await callbackPromise;
        expect(callback).toHaveBeenCalledWith(undefined, {
          characteristics: [{
            aid: aid,
            iid: iids.on,
            status: HAPStatus.OPERATION_TIMED_OUT,
          }],
        });
      });

      test("slow write notification", async () => {
        adjustTimeouts(60, 10000);

        const setEvent: Promise<[CharacteristicValue, CharacteristicSetCallback]> = awaitEventOnce(onCharacteristic, CharacteristicEventTypes.SET);

        // @ts-expect-error: private access
        accessory.handleSetCharacteristics(connection, {
          characteristics: [{ aid: aid, iid: iids.on, value: true }],
        }, callback);

        await PromiseTimeout(2);
        expect(callback).not.toHaveBeenCalled();

        await PromiseTimeout(70);
        expect(characteristicWarningHandler)
          .toHaveBeenCalledWith(onCharacteristic, CharacteristicWarningType.SLOW_WRITE, expect.anything());

        const eventResult = await setEvent;
        expect(eventResult[0]).toBe(true);
        eventResult[1]();

        await callbackPromise;
        expect(callback).toHaveBeenCalledWith(undefined, {
          characteristics: [{
            aid: aid,
            iid: iids.on,
            status: HAPStatus.SUCCESS,
          }],
        });
      });

      test("timeout read notification", async () => {
        adjustTimeouts(10, 50);

        const setEvent: Promise<[CharacteristicValue, CharacteristicSetCallback]> = awaitEventOnce(onCharacteristic, CharacteristicEventTypes.SET);

        // @ts-expect-error: private access
        accessory.handleSetCharacteristics(connection, {
          characteristics: [{ aid: aid, iid: iids.on, value: true }],
        }, callback);

        await PromiseTimeout(2);
        expect(callback).not.toHaveBeenCalled();

        await PromiseTimeout(70);
        expect(characteristicWarningHandler)
          .toHaveBeenCalledWith(onCharacteristic, CharacteristicWarningType.SLOW_WRITE, expect.anything());
        expect(characteristicWarningHandler)
          .toHaveBeenCalledWith(onCharacteristic, CharacteristicWarningType.TIMEOUT_WRITE, expect.anything());

        const eventResult = await setEvent;
        expect(eventResult[0]).toBe(true);
        eventResult[1]();

        await callbackPromise;
        expect(callback).toHaveBeenCalledWith(undefined, {
          characteristics: [{
            aid: aid,
            iid: iids.on,
            status: HAPStatus.OPERATION_TIMED_OUT,
          }],
        });
      });
    });
  });

  describe("characteristicWarning", () => {
    test("emit characteristic warning", () => {
      accessory.on(AccessoryEventTypes.CHARACTERISTIC_WARNING, callback);

      const service = accessory.addService(Service.Lightbulb, "Light");
      const on = service.getCharacteristic(Characteristic.On);

      on.updateValue({});
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("forward characteristic on bridged accessory", () => {
      const bridge = new Bridge("Test bridge", uuid.generate("bridge test"));

      bridge.addBridgedAccessory(accessory);

      bridge.on(AccessoryEventTypes.CHARACTERISTIC_WARNING, callback);
      accessory.on(AccessoryEventTypes.CHARACTERISTIC_WARNING, callback);

      const service = accessory.addService(Service.Lightbulb, "Light");
      const on = service.getCharacteristic(Characteristic.On);

      on.updateValue({});
      expect(callback).toHaveBeenCalledTimes(2);
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

  describe("parseBindOption", () => {
    const basePublishInfo: PublishInfo = {
      username: serverUsername,
      pincode: "000-00-000",
      category: Categories.SWITCH,
    };

    const callParseBindOption = (bind: (InterfaceName | IPAddress) | (InterfaceName | IPAddress)[]): {
      advertiserAddress?: string[],
      serviceRestrictedAddress?: string[],
      serviceDisableIpv6?: boolean,
      serverAddress?: string,
    } => {
      const info: PublishInfo = {
        ...basePublishInfo,
        bind: bind,
      };

      // @ts-expect-error: private access
      return Accessory.parseBindOption(info);
    };

    test("parse unspecified ipv6 address", () => {
      expect(callParseBindOption("::")).toEqual({
        serverAddress: "::",
      });
    });

    test("parse unspecified ipv4 address", () => {
      expect(callParseBindOption("0.0.0.0")).toEqual({
        serverAddress: "0.0.0.0",
        serviceDisableIpv6: true,
      });
    });

    test("parse interface names", () => {
      expect(callParseBindOption(["en0", "lo0"])).toEqual({
        serverAddress: "::",
        advertiserAddress: ["en0", "lo0"],
        serviceRestrictedAddress: ["en0", "lo0"],
      });
    });

    test("parse interface names with explicit ipv6 support", () => {
      expect(callParseBindOption(["en0", "lo0", "::"])).toEqual({
        serverAddress: "::",
        advertiserAddress: ["en0", "lo0"],
        serviceRestrictedAddress: ["en0", "lo0"],
      });
    });

    test("parse interface names ipv4 only", () => {
      expect(callParseBindOption(["en0", "lo0", "0.0.0.0"])).toEqual({
        serverAddress: "0.0.0.0",
        advertiserAddress: ["en0", "lo0"],
        serviceRestrictedAddress: ["en0", "lo0"],
        serviceDisableIpv6: true,
      });
    });

    test("parse ipv4 address", () => {
      expect(callParseBindOption("169.254.104.90")).toEqual({
        serverAddress: "0.0.0.0",
        advertiserAddress: ["169.254.104.90"],
        serviceRestrictedAddress: ["169.254.104.90"],
      });

      expect(callParseBindOption(["169.254.104.90", "192.168.1.4"])).toEqual({
        serverAddress: "0.0.0.0",
        advertiserAddress: ["169.254.104.90", "192.168.1.4"],
        serviceRestrictedAddress: ["169.254.104.90", "192.168.1.4"],
      });
    });

    test("parse ipv6 address", () => {
      expect(callParseBindOption("2001:db8::")).toEqual({
        serverAddress: "::",
        advertiserAddress: ["2001:db8::"],
        serviceRestrictedAddress: ["2001:db8::"],
      });

      expect(callParseBindOption(["2001:db8::", "2001:db8::1"])).toEqual({
        serverAddress: "::",
        advertiserAddress: ["2001:db8::", "2001:db8::1"],
        serviceRestrictedAddress: ["2001:db8::", "2001:db8::1"],
      });
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
