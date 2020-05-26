import { Advertiser, PairingFeatureFlag, StatusFlag } from './Advertiser';
import { AccessoryInfo } from './model/AccessoryInfo';

describe(Advertiser, () => {
  describe("ff and sf", () => {
    it('should correctly format pairing feature flags', function () {
      expect(Advertiser.ff()).toEqual(0);
      expect(Advertiser.ff(PairingFeatureFlag.SUPPORTS_HARDWARE_AUTHENTICATION)).toEqual(1);
      expect(Advertiser.ff(PairingFeatureFlag.SUPPORTS_SOFTWARE_AUTHENTICATION)).toEqual(2);
      expect(Advertiser.ff(
        PairingFeatureFlag.SUPPORTS_HARDWARE_AUTHENTICATION,
        PairingFeatureFlag.SUPPORTS_SOFTWARE_AUTHENTICATION,
      )).toEqual(3);
    });

    it('should correctly format status flags', function () {
      expect(Advertiser.sf()).toEqual(0);

      expect(Advertiser.sf(StatusFlag.NOT_PAIRED)).toEqual(1);
      expect(Advertiser.sf(StatusFlag.NOT_JOINED_WIFI)).toEqual(2);
      expect(Advertiser.sf(StatusFlag.PROBLEM_DETECTED)).toEqual(4);

      expect(Advertiser.sf(StatusFlag.NOT_PAIRED, StatusFlag.NOT_JOINED_WIFI)).toEqual(3);
      expect(Advertiser.sf(StatusFlag.NOT_PAIRED, StatusFlag.PROBLEM_DETECTED)).toEqual(5);
      expect(Advertiser.sf(StatusFlag.NOT_JOINED_WIFI, StatusFlag.PROBLEM_DETECTED)).toEqual(6);

      expect(Advertiser.sf(StatusFlag.NOT_PAIRED, StatusFlag.NOT_JOINED_WIFI, StatusFlag.PROBLEM_DETECTED)).toEqual(7);
    });
  });
})
