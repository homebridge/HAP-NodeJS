import { AccessoryInfo } from "./AccessoryInfo";
import { Categories } from "../Accessory";
import { HAPStorage } from "./HAPStorage";
import { AssertionError } from "assert";
import createDebug from "debug";
import { format } from "util";
import { AccessoryJsonObject, CharacteristicJsonObject } from "../../types";
import { Formats, Perms } from "../Characteristic";

describe("AccessoryInfo", () => {
  describe("#load()", () => {
    it("should default category to Categories.OTHER when missing", () => {
      const username = "0E:AE:FC:45:7B:91";
      HAPStorage.storage().setItemSync(AccessoryInfo.persistKey(username), {
        displayName: "Test",
        pincode: "123-45-678",
        signSk: "aa".repeat(64),
        signPk: "bb".repeat(32),
        pairedClients: {},
        // category intentionally omitted
      });

      const info = AccessoryInfo.load(username);
      expect(info).not.toBeNull();
      expect(info!.category).toBe(Categories.OTHER);
      expect(typeof info!.category).toBe("number");
    });
  });

  describe("#checkForCurrentConfigurationNumberIncrement()", () => {
    const characteristic = (iid: number, perms: Perms[], validValues?: number[]): CharacteristicJsonObject => ({
      type: "25",
      iid,
      value: null,
      perms,
      description: "Test",
      format: Formats.UINT8,
      unit: undefined,
      minValue: undefined,
      maxValue: undefined,
      minStep: undefined,
      maxLen: undefined,
      maxDataLen: undefined,
      "valid-values": validValues,
      "valid-values-range": undefined,
    });

    const accessory = (aid: number, characteristics: CharacteristicJsonObject[]): AccessoryJsonObject => ({
      aid,
      services: [{
        type: "49",
        iid: 1,
        characteristics,
        hidden: undefined,
        primary: undefined,
      }],
    });

    let info: AccessoryInfo;

    beforeEach(() => {
      info = AccessoryInfo.create("0E:AE:FC:45:7B:92");
    });

    it("should increment the configuration number when the configuration changes", () => {
      expect(info.checkForCurrentConfigurationNumberIncrement([accessory(1, [characteristic(2, [Perms.PAIRED_READ])])])).toBe(true);
      const version = info.getConfigVersion();

      // same configuration again: no increment
      expect(info.checkForCurrentConfigurationNumberIncrement([accessory(1, [characteristic(2, [Perms.PAIRED_READ])])])).toBe(false);
      expect(info.getConfigVersion()).toBe(version);

      // a real change: increment
      expect(info.checkForCurrentConfigurationNumberIncrement([
        accessory(1, [characteristic(2, [Perms.PAIRED_READ, Perms.NOTIFY])]),
      ])).toBe(true);
      expect(info.getConfigVersion()).toBe(version + 1);
    });

    it("should not increment when only the order of order-independent arrays differs", () => {
      // two accessories, two characteristics, shuffled perms and valid-values: the same configuration,
      // presented in a different order - as plugins are free to do on any restart
      expect(info.checkForCurrentConfigurationNumberIncrement([
        accessory(1, [
          characteristic(2, [Perms.PAIRED_READ, Perms.NOTIFY], [0, 1, 2]),
          characteristic(3, [Perms.PAIRED_WRITE]),
        ]),
        accessory(2, [characteristic(2, [Perms.PAIRED_READ])]),
      ])).toBe(true);
      const version = info.getConfigVersion();

      expect(info.checkForCurrentConfigurationNumberIncrement([
        accessory(2, [characteristic(2, [Perms.PAIRED_READ])]),
        accessory(1, [
          characteristic(3, [Perms.PAIRED_WRITE]),
          characteristic(2, [Perms.NOTIFY, Perms.PAIRED_READ], [2, 0, 1]),
        ]),
      ])).toBe(false);
      expect(info.getConfigVersion()).toBe(version);
    });

    it("should emit a debug line when the configuration number increments", () => {
      const previousNamespaces = createDebug.disable();
      const originalLog = createDebug.log;
      const messages: string[] = [];

      createDebug.enable("HAP-NodeJS:AccessoryInfo");
      createDebug.log = (...args: unknown[]) => {
        messages.push(format(...args));
      };

      try {
        info.checkForCurrentConfigurationNumberIncrement([accessory(1, [characteristic(2, [Perms.PAIRED_READ])])]);
      } finally {
        createDebug.log = originalLog;
        createDebug.enable(previousNamespaces);
      }

      const version = info.getConfigVersion();
      expect(messages.some(message => message.includes(`Configuration number incremented to ${version}`))).toBe(true);
    });
  });

  describe("#assertValidUsername()", () => {
    it("should verify correct device id", () => {
      const VALUE = "0E:AE:FC:45:7B:91";
      expect(() => AccessoryInfo.assertValidUsername(VALUE)).not.toThrow(AssertionError);
    });

    it("should fail to verify too long device id", () => {
      const VALUE = "00:2c:44:f9:30:8f:d1:2e";
      expect(() => AccessoryInfo.assertValidUsername(VALUE)).toThrow(AssertionError);
    });

    it("should fail to verify too short device id", () => {
      const VALUE = "00:2c:d1:2e";
      expect(() => AccessoryInfo.assertValidUsername(VALUE)).toThrow(AssertionError);
    });

    it("should fail to verify device id containing invalid characters", () => {
      const VALUE = "0E:AG:FC:45:7B:91";
      expect(() => AccessoryInfo.assertValidUsername(VALUE)).toThrow(AssertionError);
    });

    it("should fail to verify undefined device id", () => {
      const VALUE = undefined;
      // @ts-expect-error: deliberately test illegal value
      expect(() => AccessoryInfo.assertValidUsername(VALUE)).toThrow(AssertionError);
    });
  });
});
