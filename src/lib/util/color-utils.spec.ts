import { ColorUtils } from "./color-utils";

describe("colorUtils", () => {
  describe("#colorTemperatureToHueAndSaturation()", () => {
    it("should return unrounded values after a rounded lookup of the same temperature", () => {
      expect(ColorUtils.colorTemperatureToHueAndSaturation(153)).toEqual({ saturation: 3, hue: 276 });
      expect(ColorUtils.colorTemperatureToHueAndSaturation(153, false)).toEqual({ saturation: 3, hue: 276.4 });
    });

    it("should clamp temperatures outside the lookup table", () => {
      expect(ColorUtils.colorTemperatureToHueAndSaturation(50, false)).toEqual({ saturation: 19, hue: 222.1 });
      expect(ColorUtils.colorTemperatureToHueAndSaturation(600, false)).toEqual({ saturation: 64.1, hue: 28.3 });
    });

    it("should fail with a clear message for a temperature which is not a number", () => {
      expect(() => ColorUtils.colorTemperatureToHueAndSaturation(Number.NaN)).toThrow("lookup for temperature NaN did not yield any results");
    });
  });
});
