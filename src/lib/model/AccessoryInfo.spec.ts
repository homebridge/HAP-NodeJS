import { AccessoryInfo } from "./AccessoryInfo";
import { Categories } from "../Accessory";
import { HAPStorage } from "./HAPStorage";
import { AssertionError } from "assert";

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
