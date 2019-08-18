import { Accessory } from './Accessory';
import { Service } from './Service';
import { Characteristic, CharacteristicEventTypes } from './Characteristic';
import { generate } from './util/uuid';
import './gen';

describe('Accessory', () => {

  describe('#constructor()', () => {

    it('should identify itself with a valid UUID', () => {
      const accessory = new Accessory('Test', generate('Foo'));

      const VALUE = true;

      accessory.getService(Service.AccessoryInformation)!
        .getCharacteristic(Characteristic.Identify)!
        .on(CharacteristicEventTypes.SET, (value: any, callback: any) => {
          expect(value).toEqual(VALUE);
        });
    });

    it('should fail to load with no display name', () => {
      expect(() => {
        new Accessory('', '');
      }).toThrow('non-empty displayName');
    });

    it('should fail to load with no UUID', () => {
      expect(() => {
        new Accessory('Test', '');
      }).toThrow('valid UUID');
    });

    it('should fail to load with an invalid UUID', () => {
      expect(() => {
        new Accessory('Test', 'test');
      }).toThrow('not a valid UUID');
    });
  });
});
