import crypto from "crypto";
import { Accessory, AccessoryEventTypes, Categories, MDNSAdvertiser, PublishInfo } from "./Accessory";
import { BonjourHAPAdvertiser } from "./Advertiser";
import { Bridge } from "./Bridge";
import { Characteristic, CharacteristicEventTypes } from "./Characteristic";
import { Controller, ControllerIdentifier, ControllerServiceMap } from "./controller";
import { AccessoryInfo, PermissionTypes } from "./model/AccessoryInfo";
import { Service } from "./Service";
import { awaitEventOnce, PromiseTimeout } from "./util/promise-utils";
import * as uuid from "./util/uuid";
import Mock = jest.Mock;

const TEST_USERNAME = "AB:CD:EF:00:11:22";
const TEST_DISPLAY_NAME = "Test Accessory";
const TEST_UUID = uuid.generate("HAP-NODEJS-TEST-ACCESSORY!");

describe("Accessory", () => {
  let accessory: Accessory;

  let accessoryInfoUnpaired: AccessoryInfo;
  const saveMock: Mock = jest.fn();

  beforeEach(() => {
    accessoryInfoUnpaired = AccessoryInfo.create(TEST_USERNAME);
    // @ts-expect-error: private access
    accessoryInfoUnpaired.setupID = Accessory._generateSetupID();
    accessoryInfoUnpaired.displayName = "Outlet";
    accessoryInfoUnpaired.category = 7;
    accessoryInfoUnpaired.pincode = " 031-45-154";
    accessoryInfoUnpaired.save = saveMock;

    // ensure we start with a clean Accessory for every test
    Accessory.cleanupAccessoryData(TEST_USERNAME);
    accessory = new Accessory(TEST_DISPLAY_NAME, TEST_UUID);

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
        username: TEST_USERNAME,
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
        username: TEST_USERNAME,
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
    test("finish setup-pair", async () => {
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
      accessory.handleInitialPairSetupFinished(TEST_USERNAME, publicKey, callback);

      expect(accessoryInfoUnpaired.addPairedClient).toBeCalledTimes(1);
      expect(accessoryInfoUnpaired.addPairedClient).toBeCalledWith(TEST_USERNAME, publicKey, PermissionTypes.ADMIN);

      expect(saveMock).toBeCalledTimes(1);

      expect(advertiser.updateAdvertisement).toBeCalledTimes(1);

      await advertiser.destroy();
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
