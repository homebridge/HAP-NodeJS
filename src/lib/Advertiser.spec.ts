import { Advertiser } from './Advertiser';
import { AccessoryInfo } from './model/AccessoryInfo';

const createAdvertiser = () => {
  return new Advertiser(AccessoryInfo.create('00:00:00:00:00:00'), {
    multicast: false,
    interface: 'ipv6',
    port: 80,
    ip: '1.1.1.1',
    ttl: 30,
    loopback: true,
    reuseAddr: false,
  });
};

describe("Advertiser", () => {
  it('should test', function () {
    // empty for now
  });
})

/*
describe('Advertiser', () => {
  describe('#constructor()', () => {
    it('should create a setup hash', () => {
      const advertiser = createAdvertiser();

      expect(advertiser._setupHash).toBeTruthy();
    });
  });

  describe('#startAdvertising()', () => {
    it('should start advertising if not currently doing so', () => {
      const advertiser = createAdvertiser();

      expect(advertiser._advertisement).toBeNull();
      advertiser.startAdvertising(80);
      expect(advertiser._bonjourService.publish).toHaveBeenCalledTimes(1);
      expect(advertiser._advertisement).not.toBeNull();
    });

    it('should stop advertising if already doing so', () => {
      const advertiser = createAdvertiser();

      expect(advertiser._advertisement).toBeNull();
      advertiser.startAdvertising(80);
      advertiser.stopAdvertising = jest.fn();
      advertiser.startAdvertising(80);
      expect(advertiser.stopAdvertising).toHaveBeenCalledTimes(1);
      expect(advertiser.isAdvertising()).toBeTruthy();
    });
  });

  describe('#isAdvertising()', () => {
    it('should be true if currently advertising', () => {
      const advertiser = createAdvertiser();
      advertiser.startAdvertising(80);
      expect(advertiser.isAdvertising()).toBeTruthy();
    });

    it('should be false if not currently advertising', () => {
      const advertiser = createAdvertiser();
      expect(advertiser.isAdvertising()).toBeFalsy();
    });
  });

  describe('#updateAdvertisement()', () => {
    it('should send an updated TXT record if currently advertising', () => {
      const advertiser = createAdvertiser();

      expect(advertiser.isAdvertising()).toBeFalsy();
      advertiser.startAdvertising(80);
      expect(advertiser.isAdvertising()).toBeTruthy();

      advertiser.updateAdvertisement();
      expect(advertiser._advertisement!.updateTxt).toHaveBeenCalledTimes(1);
    });
  });

  describe('#stopAdvertising()', () => {
    it('should stop and destroy all services if currently advertising', () => {
      const advertiser = createAdvertiser();

      expect(advertiser.isAdvertising()).toBeFalsy();
      advertiser.startAdvertising(80);
      expect(advertiser.isAdvertising()).toBeTruthy();

      const advertisement = advertiser._advertisement!;
      advertiser.stopAdvertising();
      expect(advertisement.stop).toHaveBeenCalledTimes(1);
      expect(advertisement.destroy).toHaveBeenCalledTimes(1);
      expect(advertiser.isAdvertising()).toBeFalsy();
      expect(advertiser._bonjourService.destroy).toHaveBeenCalledTimes(1);
    });

    it('should destroy only Bonjour service  if not currently advertising', () => {
      const advertiser = createAdvertiser();

      advertiser.stopAdvertising();
      expect(advertiser.isAdvertising()).toBeFalsy();
      expect(advertiser._bonjourService.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
*/
