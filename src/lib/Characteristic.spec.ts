import {
  Access,
  Characteristic,
  CharacteristicChange,
  CharacteristicEventTypes,
  CharacteristicProps,
  Formats,
  HAPStatus,
  Perms,
  SerializedCharacteristic,
  Units,
  uuid
} from '..';

function createCharacteristic(type: Formats, customUUID?: string): Characteristic {
  return new Characteristic('Test', customUUID || uuid.generate('Foo'), { format: type, perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE] });
}

function createCharacteristicWithProps(props: CharacteristicProps, customUUID?: string): Characteristic {
  return new Characteristic('Test', customUUID || uuid.generate('Foo'), props);
}

describe('Characteristic', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  })

  describe('#setProps()', () => {
    it('should overwrite existing properties', () => {
      const characteristic = createCharacteristic(Formats.BOOL);

      const NEW_PROPS = {format: Formats.STRING, perms: [Perms.NOTIFY]};
      characteristic.setProps(NEW_PROPS);

      expect(characteristic.props).toEqual(NEW_PROPS);
    });

    it('should fail when setting invalid value range', function () {
      const characteristic = createCharacteristic(Formats.INT);

      const setProps = (min: number, max: number) => characteristic.setProps({
        minValue: min,
        maxValue: max,
      })

      expect(() => setProps(-256, -512)).toThrow(Error);
      expect(() => setProps(0, -3)).toThrow(Error);
      expect(() => setProps(6, 0)).toThrow(Error);
      expect(() => setProps(678, 234)).toThrow(Error);

      // should allow setting equal values
      setProps(0, 0);
      setProps(3, 3);
    });

    it('should reject update to minValue and maxValue when they are out of range for format type', function () {
      const characteristic = createCharacteristicWithProps({
        format: Formats.UINT8,
        perms: [Perms.NOTIFY, Perms.PAIRED_READ],
        minValue: 0,
        maxValue: 255,
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      mock.mockReset();
      characteristic.setProps({
        minValue: 700,
        maxValue: 1000
      })

      expect(characteristic.props.minValue).toEqual(0); // min for UINT8
      expect(characteristic.props.maxValue).toEqual(255); // max for UINT8
      expect(mock).toBeCalledTimes(2);

      mock.mockReset();
      characteristic.setProps({
        minValue: -1000,
        maxValue: -500
      })

      expect(characteristic.props.minValue).toEqual(0); // min for UINT8
      expect(characteristic.props.maxValue).toEqual(255); // max for UINT8
      expect(mock).toBeCalledTimes(2);

      mock.mockReset();
      characteristic.setProps({
        minValue: 10,
        maxValue: 1000
      })

      expect(characteristic.props.minValue).toEqual(10);
      expect(characteristic.props.maxValue).toEqual(255); // max for UINT8
      expect(mock).toBeCalledTimes(1);
    });

    it('should accept update to minValue and maxValue when they are in range for format type', function () {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.NOTIFY, Perms.PAIRED_READ],
        minValue: 0,
        maxValue: 255,
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      mock.mockReset();
      characteristic.setProps({
        minValue: 10,
        maxValue: 240
      })

      expect(characteristic.props.minValue).toEqual(10);
      expect(characteristic.props.maxValue).toEqual(240);
      expect(mock).toBeCalledTimes(0);

      mock.mockReset();
      characteristic.setProps({
        minValue: -2147483648,
        maxValue: 2147483647
      })

      expect(characteristic.props.minValue).toEqual(-2147483648);
      expect(characteristic.props.maxValue).toEqual(2147483647);
      expect(mock).toBeCalledTimes(0);
    });
  });

  describe("validValuesIterator", () => {
    it ("should iterate over min/max value definition", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.PAIRED_READ],
        minValue: 2,
        maxValue: 5,
      });

      const result = Array.from(characteristic.validValuesIterator());
      expect(result).toEqual([2, 3, 4, 5]);
    });

    it ("should iterate over min/max value definition with minStep defined", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.PAIRED_READ],
        minValue: 2,
        maxValue: 10,
        minStep: 2, // can't really test with .x precision as of floating point precision
      });

      const result = Array.from(characteristic.validValuesIterator());
      expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it ("should iterate over validValues array definition", () => {
      const validValues = [1, 3, 4, 5, 8];
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.PAIRED_READ],
        validValues: validValues
      });

      const result = Array.from(characteristic.validValuesIterator());
      expect(result).toEqual(validValues);
    });

    it ("should iterate over validValueRanges definition", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.PAIRED_READ],
        validValueRanges: [2, 5],
      });

      const result = Array.from(characteristic.validValuesIterator());
      expect(result).toEqual([2, 3, 4, 5]);
    });

    it("should iterate over UINT8 definition", () => {
      const characteristic = createCharacteristic(Formats.UINT8);

      const result = Array.from(characteristic.validValuesIterator());
      expect(result).toEqual(Array.from(new Uint8Array(256).map((value, i) => i)))
    });

    // we could do the same for UINT16, UINT32 and UINT64 but i think thats kind of pointless and takes to long
  });

  describe('#subscribe()', () => {
    it('correctly adds a single subscription', () => {
      const characteristic = createCharacteristic(Formats.BOOL);
      const subscribeSpy = jest.fn();
      characteristic.on(CharacteristicEventTypes.SUBSCRIBE, subscribeSpy);
      characteristic.subscribe();

      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(characteristic.subscriptions).toEqual(1);
    });

    it('correctly adds multiple subscriptions', () => {
      const characteristic = createCharacteristic(Formats.BOOL);
      const subscribeSpy = jest.fn();
      characteristic.on(CharacteristicEventTypes.SUBSCRIBE, subscribeSpy);
      characteristic.subscribe();
      characteristic.subscribe();
      characteristic.subscribe();

      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(characteristic.subscriptions).toEqual(3);
    });
  });

  describe('#unsubscribe()', () => {
    it('correctly removes a single subscription', () => {
      const characteristic = createCharacteristic(Formats.BOOL);
      const subscribeSpy = jest.fn();
      const unsubscribeSpy = jest.fn();
      characteristic.on(CharacteristicEventTypes.SUBSCRIBE, subscribeSpy);
      characteristic.on(CharacteristicEventTypes.UNSUBSCRIBE, unsubscribeSpy);
      characteristic.subscribe();
      characteristic.unsubscribe();

      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(characteristic.subscriptions).toEqual(0);
    });

    it('correctly removes multiple subscriptions', () => {
      const characteristic = createCharacteristic(Formats.BOOL);
      const subscribeSpy = jest.fn();
      const unsubscribeSpy = jest.fn();
      characteristic.on(CharacteristicEventTypes.SUBSCRIBE, subscribeSpy);
      characteristic.on(CharacteristicEventTypes.UNSUBSCRIBE, unsubscribeSpy);
      characteristic.subscribe();
      characteristic.subscribe();
      characteristic.subscribe();
      characteristic.unsubscribe();
      characteristic.unsubscribe();
      characteristic.unsubscribe();

      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(characteristic.subscriptions).toEqual(0);
    });
  });

  describe('#handleGetRequest()', () => {
    it('should handle special event only characteristics', (callback) => {
      const characteristic = createCharacteristic(Formats.BOOL, Characteristic.ProgrammableSwitchEvent.UUID);

      characteristic.handleGetRequest().then(() => {
        expect(characteristic.statusCode).toEqual(HAPStatus.SUCCESS);
        expect(characteristic.value).toEqual(null);
        callback();
      });
    });

    it('should return cached values if no listeners are registered', (callback) => {
      const characteristic = createCharacteristic(Formats.BOOL);

      characteristic.handleGetRequest().then(() => {
        expect(characteristic.statusCode).toEqual(HAPStatus.SUCCESS);
        expect(characteristic.value).toEqual(null);
        callback();
      });
    });
  });

  describe('#validateUserInput()', () => {

    it('should validate an integer property', () => {
      const VALUE = 1024;
      const characteristic = createCharacteristic(Formats.INT);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a float property', () => {
      const VALUE = 1.024;
      const characteristic = createCharacteristicWithProps({
        format: Formats.FLOAT,
        minStep: 0.001,
        perms: [Perms.NOTIFY],
      });
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a UINT8 property', () => {
      const VALUE = 10;
      const characteristic = createCharacteristic(Formats.UINT8);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a UINT16 property', () => {
      const VALUE = 10;
      const characteristic = createCharacteristic(Formats.UINT16);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a UINT32 property', () => {
      const VALUE = 10;
      const characteristic = createCharacteristic(Formats.UINT32);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a UINT64 property', () => {
      const VALUE = 10;
      const characteristic = createCharacteristic(Formats.UINT64);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a boolean property', () => {
      const VALUE = true;
      const characteristic = createCharacteristic(Formats.BOOL);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a string property', () => {
      const VALUE = 'Test';
      const characteristic = createCharacteristic(Formats.STRING);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a data property', () => {
      const VALUE = Buffer.from("Hello my good friend. Have a nice day!", "ascii").toString("base64");
      const characteristic = createCharacteristic(Formats.DATA);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a TLV8 property', () => {
      const VALUE = '';
      const characteristic = createCharacteristic(Formats.TLV8);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate a dictionary property', () => {
      const VALUE = {};
      const characteristic = createCharacteristic(Formats.DICTIONARY);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it('should validate an array property', () => {
      const VALUE = ['asd'];
      const characteristic = createCharacteristic(Formats.ARRAY);
      // @ts-expect-error
      expect(characteristic.validateUserInput(VALUE)).toEqual(VALUE);
    });

    it("should validate boolean inputs", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      characteristic.setValue(true);
      expect(characteristic.value).toEqual(true);

      characteristic.setValue(false);
      expect(characteristic.value).toEqual(false);

      characteristic.setValue(1);
      expect(characteristic.value).toEqual(true);

      characteristic.setValue(0);
      expect(characteristic.value).toEqual(false);

      characteristic.setValue("1");
      expect(characteristic.value).toEqual(true);

      characteristic.setValue("true");
      expect(characteristic.value).toEqual(true);

      characteristic.setValue("0");
      expect(characteristic.value).toEqual(false);

      characteristic.setValue("false");
      expect(characteristic.value).toEqual(false);

      characteristic.setValue({ some: 'object' });
      expect(characteristic.value).toEqual(false);
      expect(mock).toBeCalledTimes(1);
    });

    it("should validate boolean inputs when value is undefined", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      characteristic.setValue(undefined as unknown as boolean);
      expect(characteristic.value).toEqual(false);
      expect(mock).toBeCalledTimes(1);
    });

    test.each([Formats.INT, Formats.FLOAT, Formats.UINT8, Formats.UINT16, Formats.UINT32, Formats.UINT64])(
      "should validate %p inputs", (intType) => {
        const characteristic = createCharacteristicWithProps({
          format: intType,
          perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
          minValue: 0,
          maxValue: 100,
        });

        // @ts-ignore - spying on private property
        const mock = jest.spyOn(characteristic, 'characteristicWarning');

        characteristic.setValue(1);
        expect(characteristic.value).toEqual(1);

        // round to nearest valid value, trigger warning
        mock.mockReset();
        characteristic.setValue(-100);
        expect(characteristic.value).toEqual(0);
        expect(mock).toBeCalledTimes(1);

        // round to nearest valid value, trigger warning
        mock.mockReset();
        characteristic.setValue(200);
        expect(characteristic.value).toEqual(100);
        expect(mock).toBeCalledTimes(1);

        // parse string
        mock.mockReset();
        characteristic.setValue('50');
        expect(characteristic.value).toEqual(50);
        expect(mock).toBeCalledTimes(0);

        // handle NaN string, restore last known value, trigger warning
        mock.mockReset();
        characteristic.setValue(50);
        characteristic.setValue('SOME STRING');
        expect(characteristic.value).toEqual(50);
        expect(mock).toBeCalledTimes(1);

        // handle object, restore last known value, trigger warning
        mock.mockReset();
        characteristic.setValue(50);
        characteristic.setValue({ some: 'object' });
        expect(characteristic.value).toEqual(50);
        expect(mock).toBeCalledTimes(1);

        // handle boolean - true -> 1
        mock.mockReset();
        characteristic.setValue(true);
        expect(characteristic.value).toEqual(1);
        expect(mock).toBeCalledTimes(0);

        // handle boolean - false -> 0
        mock.mockReset();
        characteristic.setValue(false);
        expect(characteristic.value).toEqual(0);
        expect(mock).toBeCalledTimes(0);
      }
    );

    test.each([Formats.INT, Formats.FLOAT, Formats.UINT8, Formats.UINT16, Formats.UINT32, Formats.UINT64])(
      "should validate %p inputs when value is undefined", (intType) => {
        const characteristic = createCharacteristicWithProps({
          format: intType,
          perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
          minValue: 0,
          maxValue: 100,
        });

        // @ts-ignore - spying on private property
        const mock = jest.spyOn(characteristic, 'characteristicWarning');

        // undefined values should be set to the minValue if not yet set
        mock.mockReset();
        characteristic.setValue(undefined as unknown as boolean);
        expect(characteristic.value).toEqual(0);
        expect(mock).toBeCalledTimes(1);

        // undefined values should be set to the existing value if set
        mock.mockReset();
        characteristic.setValue(50);
        characteristic.setValue(undefined as unknown as boolean);
        expect(characteristic.value).toEqual(50);
        expect(mock).toBeCalledTimes(1);
      }
    );

    test.each([Formats.INT, Formats.UINT8, Formats.UINT16, Formats.UINT32, Formats.UINT64])(
      "should round when a float is provided for %p inputs", (intType) => {
        const characteristic = createCharacteristicWithProps({
          format: intType,
          perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
          minValue: 0,
          maxValue: 100,
        });

        characteristic.setValue(99.5);
        expect(characteristic.value).toEqual(100);

        characteristic.setValue(0.1);
        expect(characteristic.value).toEqual(0);
      }
    );

    it("should not round floats for Formats.FLOAT", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.FLOAT,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        minValue: 0,
        maxValue: 100,
      });

      characteristic.setValue(99.5);
      expect(characteristic.value).toEqual(99.5);

      characteristic.setValue(0.1);
      expect(characteristic.value).toEqual(0.1);
    });

    it("should validate string inputs", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        maxLen: 15,
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      // valid string
      mock.mockReset();
      characteristic.setValue("ok string");
      expect(characteristic.value).toEqual("ok string");
      expect(mock).toBeCalledTimes(0);

      // number - convert to string - trigger warning
      mock.mockReset();
      characteristic.setValue(12345);
      expect(characteristic.value).toEqual("12345");
      expect(mock).toBeCalledTimes(1);

      // not a string or number, use last known good value and trigger warning
      mock.mockReset();
      characteristic.setValue("ok string");
      characteristic.setValue({ ok: 'an object' });
      expect(characteristic.value).toEqual("ok string");
      expect(mock).toBeCalledTimes(1);

      // max length exceeded
      mock.mockReset();
      characteristic.setValue("this string exceeds the max length allowed");
      expect(characteristic.value).toEqual("this string exc");
      expect(mock).toBeCalledTimes(1);
    });

    it("should validate string inputs when undefined", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        maxLen: 15,
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      // undefined values should be set to "undefined" of no valid value is set yet
      mock.mockReset();
      characteristic.setValue(undefined as unknown as boolean);
      expect(characteristic.value).toEqual("undefined");
      expect(mock).toBeCalledTimes(1);

      // undefined values should revert back to last known good value if set
      mock.mockReset();
      characteristic.setValue("ok string");
      characteristic.setValue(undefined as unknown as boolean);
      expect(characteristic.value).toEqual("ok string");
      expect(mock).toBeCalledTimes(1);
    });

    it("should validate data type intputs", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        maxDataLen: 15,
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      // valid data
      mock.mockReset();
      characteristic.setValue("some data");
      expect(characteristic.value).toEqual("some data");
      expect(mock).toBeCalledTimes(0);

      // not valid data
      mock.mockReset();
      characteristic.setValue({ some: 'data' });
      expect(mock).toBeCalledTimes(1);

      // max length exceeded
      mock.mockReset();
      characteristic.setValue("this string exceeds the max length allowed");
      expect(mock).toBeCalledTimes(1);
    });

    it("should handle null inputs correctly for Apple characteristics", () => {
      const characteristic = new Characteristic('CurrentTemperature', Characteristic.CurrentTemperature.UUID, {
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        format: Formats.FLOAT,
        minValue: 0,
        maxValue: 100,
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      // if the initial value is null, validation should set a valid default
      mock.mockReset();
      characteristic.setValue(null as unknown as boolean);
      expect(characteristic.value).toEqual(0);
      expect(mock).toBeCalledTimes(2);

      // if the value has been previously set, and null is received, the previous value should be returned,
      mock.mockReset();
      characteristic.setValue(50);
      characteristic.setValue(null as unknown as boolean);
      expect(characteristic.value).toEqual(50);
      expect(mock).toBeCalledTimes(1);
    });

    it("should handle null inputs correctly for non-Apple characteristics", () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
      });

      // @ts-ignore - spying on private property
      const mock = jest.spyOn(characteristic, 'characteristicWarning');

      // if the initial value is null, still allow null for non-Apple characteristics
      mock.mockReset();
      characteristic.setValue(null as unknown as boolean);
      expect(characteristic.value).toEqual(null);
      expect(mock).toBeCalledTimes(0);

      // if the value has been previously set, and null is received, still allow null for non-Apple characteristics
      mock.mockReset();
      characteristic.setValue(50);
      characteristic.setValue(null as unknown as boolean);
      expect(characteristic.value).toEqual(null);
      expect(mock).toBeCalledTimes(0);
    });
  });

  describe('#getDefaultValue()', () => {

    it('should get the correct default value for a boolean property', () => {
      const characteristic = createCharacteristic(Formats.BOOL);
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(false);
    });

    it('should get the correct default value for a string property', () => {
      const characteristic = createCharacteristic(Formats.STRING);
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual('');
    });

    it('should get the correct default value for a data property', () => {
      const characteristic = createCharacteristic(Formats.DATA);
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(null);
    });

    it('should get the correct default value for a TLV8 property', () => {
      const characteristic = createCharacteristic(Formats.TLV8);
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(null);
    });

    it('should get the correct default value for a dictionary property', () => {
      const characteristic = createCharacteristic(Formats.DICTIONARY);
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual({});
    });

    it('should get the correct default value for an array property', () => {
      const characteristic = createCharacteristic(Formats.ARRAY);
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual([]);
    });

    it('should get the correct default value a UINT8 property without minValue', () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.UINT8,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
      });
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(0);
      expect(characteristic.value).toEqual(null); // null if never set
    });

    it('should get the correct default value a UINT8 property with minValue', () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.UINT8,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
        minValue: 50,
      });
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(50);
      expect(characteristic.value).toEqual(null); // null if never set
    });

    it('should get the correct default value a INT property without minValue', () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
      });
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(0);
      expect(characteristic.value).toEqual(null); // null if never set
    });

    it('should get the correct default value a INT property with minValue', () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
        minValue: 50,
      });
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(50);
      expect(characteristic.value).toEqual(null); // null if never set
    });

    it('should get the correct default value for the current temperature characteristic', () => {
      const characteristic = new Characteristic.CurrentTemperature();
      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(0);
      expect(characteristic.value).toEqual(0);
    });

    it('should get the default value from the first item in the validValues prop', () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
        validValues: [5, 4, 3, 2]
      });

      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(5);
      expect(characteristic.value).toEqual(null); // null if never set
    });

    it('should get the default value from minValue prop if set', () => {
      const characteristic = createCharacteristicWithProps({
        format: Formats.INT,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
        minValue: 100,
        maxValue: 255,
      });

      // @ts-expect-error
      expect(characteristic.getDefaultValue()).toEqual(100);
      expect(characteristic.value).toEqual(null); // null if never set
    });

  });

  describe('#toHAP()', () => {

  });

  describe(`@${CharacteristicEventTypes.GET}`, () => {

    it('should call any listeners for the event', (callback) => {
      const characteristic = createCharacteristic(Formats.STRING);

      const listenerCallback = jest.fn();

      characteristic.handleGetRequest().then(() => {
        characteristic.on(CharacteristicEventTypes.GET, listenerCallback);
        characteristic.handleGetRequest();
        expect(listenerCallback).toHaveBeenCalledTimes(1);
        callback();
      })
    });
  });

  describe("onGet handler", () => {
    it("should ignore GET event handler when onGet was specified", async () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const listenerCallback = jest.fn().mockImplementation((callback) => {
        callback(undefined, "OddValue");
      });
      const handlerMock = jest.fn();

      characteristic.onGet(() => {
        handlerMock();
        return "CurrentValue";
      });
      characteristic.on(CharacteristicEventTypes.GET, listenerCallback);
      const value = await characteristic.handleGetRequest();

      expect(value).toEqual("CurrentValue");
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(listenerCallback).toHaveBeenCalledTimes(0);
    });
  });

  describe(`@${CharacteristicEventTypes.SET}`, () => {

    it('should call any listeners for the event', () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const VALUE = 'NewValue';
      const listenerCallback = jest.fn();

      characteristic.handleSetRequest(VALUE);
      characteristic.on(CharacteristicEventTypes.SET, listenerCallback);
      characteristic.handleSetRequest(VALUE);

      expect(listenerCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("onSet handler", () => {
    it("should ignore SET event handler when onSet was specified", () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const listenerCallback = jest.fn();
      const handlerMock = jest.fn();

      characteristic.onSet(value => {
        handlerMock(value);
        expect(value).toEqual("NewValue");
        return;
      });
      characteristic.on(CharacteristicEventTypes.SET, listenerCallback);
      characteristic.handleSetRequest("NewValue");

      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(listenerCallback).toHaveBeenCalledTimes(0);
    });
  });

  describe(`@${CharacteristicEventTypes.CHANGE}`, () => {

    it('should call listeners for the event when the characteristic is event-only, and the value is set', (callback) => {
      const characteristic = createCharacteristic(Formats.STRING, Characteristic.ProgrammableSwitchEvent.UUID);

      const VALUE = 'NewValue';
      const listenerCallback = jest.fn();
      const setValueCallback = jest.fn();

      characteristic.setValue(VALUE, () => {
        setValueCallback();

        characteristic.on(CharacteristicEventTypes.CHANGE, listenerCallback);
        characteristic.setValue(VALUE, () => {
          setValueCallback();

          expect(listenerCallback).toHaveBeenCalledTimes(1);
          expect(setValueCallback).toHaveBeenCalledTimes(2);
          callback();
        });
      })
    });

    it('should call any listeners for the event when the characteristic is event-only, and the value is updated', () => {
      const characteristic = createCharacteristic(Formats.STRING);
      // characteristic.eventOnlyCharacteristic = true;

      const VALUE = 'NewValue';
      const listenerCallback = jest.fn();
      const updateValueCallback = jest.fn();

      characteristic.on(CharacteristicEventTypes.CHANGE, listenerCallback);
      // noinspection JSDeprecatedSymbols
      characteristic.updateValue(VALUE, updateValueCallback)

      expect(listenerCallback).toHaveBeenCalledTimes(1);
      expect(updateValueCallback).toHaveBeenCalledTimes(1);
    });

    it("should call the change listener with proper context when supplied as second argument to updateValue", () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const VALUE = "NewValue";
      const CONTEXT = "Context";

      const listener = jest.fn().mockImplementation((change: CharacteristicChange) => {
        expect(change.newValue).toEqual(VALUE);
        expect(change.context).toEqual(CONTEXT);
      });

      characteristic.on(CharacteristicEventTypes.CHANGE, listener);
      characteristic.updateValue(VALUE, CONTEXT);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should call the change listener with proper context when supplied as second argument to setValue", () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const VALUE = "NewValue";
      const CONTEXT = "Context";

      const listener = jest.fn().mockImplementation((change: CharacteristicChange) => {
        expect(change.newValue).toEqual(VALUE);
        expect(change.context).toEqual(CONTEXT);
      });

      characteristic.on(CharacteristicEventTypes.CHANGE, listener);
      characteristic.setValue(VALUE, CONTEXT);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe(`@${CharacteristicEventTypes.SUBSCRIBE}`, () => {

    it('should call any listeners for the event', () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const cb = jest.fn();

      characteristic.on(CharacteristicEventTypes.SUBSCRIBE, cb);
      characteristic.subscribe();

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe(`@${CharacteristicEventTypes.UNSUBSCRIBE}`, () => {

    it('should call any listeners for the event', () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const cb = jest.fn();

      characteristic.subscribe();
      characteristic.on(CharacteristicEventTypes.UNSUBSCRIBE, cb);
      characteristic.unsubscribe();

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('should not call any listeners for the event if none are registered', () => {
      const characteristic = createCharacteristic(Formats.STRING);

      const cb = jest.fn();

      characteristic.on(CharacteristicEventTypes.UNSUBSCRIBE, cb);
      characteristic.unsubscribe();

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('#serialize', () => {
    it('should serialize characteristic', () => {
      const props: CharacteristicProps = {
        format: Formats.INT,
        perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
        unit: Units.LUX,
        maxValue: 1234,
        minValue: 123,
        validValueRanges: [123, 1234],
        adminOnlyAccess: [Access.WRITE],
      };

      const characteristic = createCharacteristicWithProps(props, Characteristic.ProgrammableSwitchEvent.UUID);
      characteristic.value = "TestValue";

      const json = Characteristic.serialize(characteristic);
      expect(json).toEqual({
        displayName: characteristic.displayName,
        UUID: characteristic.UUID,
        props: props,
        value: "TestValue",
        eventOnlyCharacteristic: true,
      })
    });

    it("should serialize characteristic with proper constructor name", () => {
      const characteristic = new Characteristic.Name();
      characteristic.updateValue("New Name!");

      const json = Characteristic.serialize(characteristic);
      expect(json).toEqual({
        displayName: 'Name',
        UUID: '00000023-0000-1000-8000-0026BB765291',
        eventOnlyCharacteristic: false,
        constructorName: 'Name',
        value: 'New Name!',
        props: { format: 'string', perms: [ 'pr' ], maxLen: 64 }
      });
    });
  });

  describe('#deserialize', () => {
    it('should deserialize legacy json from homebridge', () => {
      const json = JSON.parse('{"displayName": "On", "UUID": "00000025-0000-1000-8000-0026BB765291", ' +
          '"props": {"format": "int", "unit": "seconds", "minValue": 4, "maxValue": 6, "minStep": 0.1, "perms": ["pr", "pw", "ev"]}, ' +
          '"value": false, "eventOnlyCharacteristic": false}');
      const characteristic = Characteristic.deserialize(json);

      expect(characteristic.displayName).toEqual(json.displayName);
      expect(characteristic.UUID).toEqual(json.UUID);
      expect(characteristic.props).toEqual(json.props);
      expect(characteristic.value).toEqual(json.value);
    });

    it('should deserialize complete json', () => {
      const json: SerializedCharacteristic = {
        displayName: "MyName",
        UUID: "00000001-0000-1000-8000-0026BB765291",
        props: {
          format: Formats.INT,
          perms: [Perms.TIMED_WRITE, Perms.PAIRED_READ],
          unit: Units.LUX,
          maxValue: 1234,
          minValue: 123,
          validValueRanges: [123, 1234],
          adminOnlyAccess: [Access.NOTIFY, Access.READ],
        },
        value: "testValue",
        eventOnlyCharacteristic: false,
      };

      const characteristic = Characteristic.deserialize(json);

      expect(characteristic.displayName).toEqual(json.displayName);
      expect(characteristic.UUID).toEqual(json.UUID);
      expect(characteristic.props).toEqual(json.props);
      expect(characteristic.value).toEqual(json.value);
    });

    it("should deserialize from json with constructor name", () => {
      const json: SerializedCharacteristic = {
        displayName: 'Name',
        UUID: '00000023-0000-1000-8000-0026BB765291',
        eventOnlyCharacteristic: false,
        constructorName: 'Name',
        value: 'New Name!',
        props: { format: 'string', perms: [ Perms.PAIRED_READ ], maxLen: 64 }
      };

      const characteristic = Characteristic.deserialize(json);

      expect(characteristic instanceof Characteristic.Name).toBeTruthy();
    });

  });

});
