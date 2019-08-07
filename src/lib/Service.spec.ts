import { Service, ServiceEventTypes } from './Service';
import { generate } from './util/uuid';
import './gen';
import { Characteristic } from './Characteristic';

const createService = () => {
  return new Service('Test', generate('Foo'), 'subtype');
}

describe('Service', () => {

  describe('#constructor()', () => {
    it('should set the name characteristic to the display name', () => {
      const service = createService();
      expect(service.getCharacteristic(Characteristic.Name)!.value).toEqual('Test');
    });

    it('should fail to load with no UUID', () => {
      expect(() => {
        new Service('Test', '', 'subtype');
      }).toThrow('valid UUID');
    });
  });

  describe('#addCharacteristic()', () => {

  });

  describe('#setHiddenService()', () => {

  });

  describe('#addLinkedService()', () => {

  });

  describe('#removeLinkedService()', () => {

  });

  describe('#removeCharacteristic()', () => {

  });

  describe('#getCharacteristic()', () => {

  });

  describe('#testCharacteristic()', () => {

  });

  describe('#setCharacteristic()', () => {

  });

  describe('#updateCharacteristic()', () => {

  });

  describe('#addOptionalCharacteristic()', () => {

  });

  describe('#getCharacteristicByIID()', () => {

  });

  describe('#toHAP()', () => {

  });

  describe(`@${ServiceEventTypes.CHARACTERISTIC_CHANGE}`, () => {

  });

  describe(`@${ServiceEventTypes.SERVICE_CONFIGURATION_CHANGE}`, () => {

  });
});
