import { Accessory } from './Accessory';
import { Service } from './Service';
import { Characteristic, CharacteristicEvents } from './Characteristic';

describe('Accessory', () => {

  it('should identify itself', () => {
    const accessory = new Accessory('Test', 'test');

    const VALUE = true;

    accessory.getService(Service.AccessoryInformation)!
      .getCharacteristic(Characteristic.Identify)!
      .on(CharacteristicEvents.SET, (value: any, callback: any) => {
        expect(value).toEqual(VALUE);
      });
  });

});
