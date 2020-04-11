// here's a fake hardware device that we'll expose to HomeKit
import {
  Accessory,
  AccessoryEventTypes,
  Categories,
  Characteristic,
  CharacteristicEventTypes, CharacteristicSetCallback,
  CharacteristicValue,
  Formats,
  Perms,
  NodeCallback,
  Service,
  uuid,
  VoidCallback,
} from '..';

const FAKE_FAN = {
  powerOn: false,
  rSpeed: 100,
  async setPowerOn(on: boolean) {
    if (on) {
      //put your code here to turn on the fan
      FAKE_FAN.powerOn = on;
    } else {
      //put your code here to turn off the fan
      FAKE_FAN.powerOn = on;
    }
  },
  async setSpeed(value: number) {
    console.log("Setting fan rSpeed to %s", value);
    FAKE_FAN.rSpeed = value;
    //put your code here to set the fan to a specific value
  },
  async identify() {
    //put your code here to identify the fan
    console.log("Fan Identified!");
  }
}

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake fan.
export const accessory = new Accessory('Fan', uuid.generate('hap-nodejs:accessories:Fan'));

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
// @ts-ignore
accessory.username = "1A:2B:3C:4D:5E:FF";
// @ts-ignore
accessory.pincode = "031-45-154";
// @ts-ignore
accessory.category = Categories.FAN;

// set some basic properties (these values are arbitrary and setting them is optional)
accessory
  .getService(Service.AccessoryInformation)!
  .setCharacteristic(Characteristic.Manufacturer, "Philips Lighting")

// listen for the "identify" event for this Accessory
accessory.on(AccessoryEventTypes.IDENTIFY, async (paired: boolean, callback: VoidCallback) => {
  try {
    FAKE_FAN.identify();
    callback(); // success
  } catch (err) {
    callback(err);
  }
});

accessory
  // Add the actual Fan Service and listen for change events from iOS.
  // We can see the complete list of Services and Characteristics in `lib/gen/HomeKit.ts`
  .addService(Service.Fan, "Fan") // services exposed to the user should have "names" like "Fake Light" for us
  .getCharacteristic(Characteristic.On)!
  .setHandler(async (value: CharacteristicValue) => {
    await FAKE_FAN.setPowerOn(value as boolean);
  })

  // We want to intercept requests for our current power state so we can query the hardware itself instead of
  // allowing HAP-NodeJS to return the cached Characteristic.value.
  .getHandler(() => {

    // this event is emitted when you ask Siri directly whether your fan is on or not. you might query
    // the fan hardware itself to find this out, then call the callback. But if you take longer than a
    // few seconds to respond, Siri will give up.

    var err = null; // in case there were any problems
    if (err) throw err;

    if (FAKE_FAN.powerOn) {
      return true;
    } else {
      return false;
    }
  });

// also add an "optional" Characteristic for speed
accessory
  .getService(Service.Fan)!
  .addCharacteristic(Characteristic.RotationSpeed)
  .getHandler(async () => {
    return FAKE_FAN.rSpeed;
  })
  .setHandler(async (value: CharacteristicValue) => {
    await FAKE_FAN.setSpeed(value as number);
  });

/**
 * A custom characteristic that mirrors the fan's power state.
 */
class CustomCharacteristic extends Characteristic {
  static readonly UUID = uuid.generate('hap-nodejs:custom-characteristics:MirrorPowerState');

  constructor(public readonly fan: typeof FAKE_FAN) {
    super('Custom Characteristic', CustomCharacteristic.UUID, {
      format: Formats.BOOL,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
    });
  }

  [Characteristic.GetValueHandler]() {
    return this.fan.powerOn;
  }

  async [Characteristic.SetValueHandler](value: CharacteristicValue) {
    await this.fan.setPowerOn(value as boolean);
  }
}

// @ts-ignore
accessory.getService(Service.Fan)!.addCharacteristic(CustomCharacteristic, FAKE_FAN);
