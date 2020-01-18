import { Accessory, Categories } from './Accessory';
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

  describe('#serialize', () => {
    it('should serialize accessory', () => {
      const accessory = new Accessory("TestAccessory", generate("foo"));
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

  describe('#deserialize', () => {
    it('should deserialize legacy json from homebridge', () => {
      const json = JSON.parse('{"plugin":"homebridge-samplePlatform","platform":"SamplePlatform",' +
          '"displayName":"2020-01-17T18:45:41.049Z","UUID":"dc3951d8-662e-46f7-b6fe-d1b5b5e1a995","category":1,' +
          '"context":{},"linkedServices":{"0000003E-0000-1000-8000-0026BB765291":[],"00000043-0000-1000-8000-0026BB765291":[]},' +
          '"services":[{"UUID":"0000003E-0000-1000-8000-0026BB765291","characteristics":[' +
          '{"displayName":"Identify","UUID":"00000014-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"bool","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pw"]},' +
          '"value":false,"eventOnlyCharacteristic":false},{"displayName":"Manufacturer","UUID":"00000020-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"Default-Manufacturer","eventOnlyCharacteristic":false},{"displayName":"Model",' +
          '"UUID":"00000021-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr"]},"value":"Default-Model","eventOnlyCharacteristic":false},' +
          '{"displayName":"Name","UUID":"00000023-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,' +
          '"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},"value":"2020-01-17T18:45:41.049Z",' +
          '"eventOnlyCharacteristic":false},{"displayName":"Serial Number","UUID":"00000030-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"Default-SerialNumber","eventOnlyCharacteristic":false},{"displayName":"Firmware Revision",' +
          '"UUID":"00000052-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr"]},"value":"","eventOnlyCharacteristic":false},' +
          '{"displayName":"Product Data","UUID":"00000220-0000-1000-8000-0026BB765291","props":{"format":"data",' +
          '"unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},"value":null,' +
          '"eventOnlyCharacteristic":false}]},{"displayName":"Test Light","UUID":"00000043-0000-1000-8000-0026BB765291",' +
          '"characteristics":[{"displayName":"Name","UUID":"00000023-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"Test Light","eventOnlyCharacteristic":false},{"displayName":"On",' +
          '"UUID":"00000025-0000-1000-8000-0026BB765291","props":{"format":"bool","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr","pw","ev"]},"value":false,"eventOnlyCharacteristic":false}]}]}');

      const accessory = Accessory.deserialize(json);

      expect(accessory.displayName).toEqual(json.displayName);
      expect(accessory.UUID).toEqual(json.UUID);
      expect(accessory.category).toEqual(json.category);

      expect(accessory.services).toBeDefined();
      expect(accessory.services.length).toEqual(2);
    });

    it('should deserialize complete json', () => {
      // json for a light accessory
      const json = JSON.parse('{"displayName":"TestAccessory","UUID":"0beec7b5-ea3f-40fd-bc95-d0dd47f3c5bc",' +
          '"category":5,"services":[{"UUID":"0000003E-0000-1000-8000-0026BB765291","hiddenService":false,' +
          '"primaryService":false,"characteristics":[{"displayName":"Identify","UUID":"00000014-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"bool","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pw"]},' +
          '"value":false,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Manufacturer","UUID":"00000020-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"Default-Manufacturer","accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Model","UUID":"00000021-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"Default-Model","accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Name","UUID":"00000023-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"TestAccessory","accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Serial Number","UUID":"00000030-0000-1000-8000-0026BB765291","props":{"format":"string",' +
          '"unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},"value":"Default-SerialNumber",' +
          '"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},{"displayName":"Firmware Revision",' +
          '"UUID":"00000052-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr"]},"value":"1.0","accessRestrictedToAdmins":[],' +
          '"eventOnlyCharacteristic":false},{"displayName":"Product Data",' +
          '"UUID":"00000220-0000-1000-8000-0026BB765291","props":{"format":"data","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr"]},"value":null,"accessRestrictedToAdmins":[],' +
          '"eventOnlyCharacteristic":false}],"optionalCharacteristics":[{"displayName":"Hardware Revision",' +
          '"UUID":"00000053-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr"]},"value":"","accessRestrictedToAdmins":[],' +
          '"eventOnlyCharacteristic":false},{"displayName":"Accessory Flags","UUID":"000000A6-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"uint32","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr","ev"]},' +
          '"value":0,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false}]},' +
          '{"displayName":"TestLight","UUID":"00000043-0000-1000-8000-0026BB765291",' +
          '"subtype":"subtype","hiddenService":false,"primaryService":false,' +
          '"characteristics":[{"displayName":"Name","UUID":"00000023-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"TestLight","accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"On","UUID":"00000025-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"bool","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr","pw","ev"]},' +
          '"value":false,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false}],' +
          '"optionalCharacteristics":[{"displayName":"Brightness","UUID":"00000008-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"int","unit":"percentage","minValue":0,"maxValue":100,"minStep":1,' +
          '"perms":["pr","pw","ev"]},"value":0,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Hue","UUID":"00000013-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"float","unit":"arcdegrees","minValue":0,"maxValue":360,"minStep":1,"perms":["pr","pw","ev"]},' +
          '"value":0,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Saturation","UUID":"0000002F-0000-1000-8000-0026BB765291","props":{"format":"float",' +
          '"unit":"percentage","minValue":0,"maxValue":100,"minStep":1,"perms":["pr","pw","ev"]},"value":0,' +
          '"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},{"displayName":"Name",' +
          '"UUID":"00000023-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,' +
          '"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},"value":"",' +
          '"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false},' +
          '{"displayName":"Color Temperature","UUID":"000000CE-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"uint32","unit":null,"minValue":140,"maxValue":500,"minStep":1,"perms":["pr","pw","ev"]},' +
          '"value":140,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false}]},' +
          '{"displayName":"TestSwitch","UUID":"00000049-0000-1000-8000-0026BB765291","subtype":"subtype",' +
          '"hiddenService":false,"primaryService":false,"characteristics":[{"displayName":"Name",' +
          '"UUID":"00000023-0000-1000-8000-0026BB765291","props":{"format":"string","unit":null,"minValue":null,' +
          '"maxValue":null,"minStep":null,"perms":["pr"]},"value":"TestSwitch","accessRestrictedToAdmins":[],' +
          '"eventOnlyCharacteristic":false},{"displayName":"On","UUID":"00000025-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"bool","unit":null,"minValue":null,"maxValue":null,"minStep":null,' +
          '"perms":["pr","pw","ev"]},"value":false,"accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false}],' +
          '"optionalCharacteristics":[{"displayName":"Name","UUID":"00000023-0000-1000-8000-0026BB765291",' +
          '"props":{"format":"string","unit":null,"minValue":null,"maxValue":null,"minStep":null,"perms":["pr"]},' +
          '"value":"","accessRestrictedToAdmins":[],"eventOnlyCharacteristic":false}]}],' +
          '"linkedServices":{"00000043-0000-1000-8000-0026BB765291subtype":["00000049-0000-1000-8000-0026BB765291subtype"]}}');

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
});
