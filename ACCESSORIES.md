# Developing Accessories

Users can define their own accessories in: `accessories/[name]_accessory.ts`
files, where `[name]` is a short description of the accessory. All defined
accessories get loaded on server start. You can define accessories using an
object literal notation (see [`Fan_accessory.ts`](src/accessories/Fan_accessory.ts)
for an example) or you can use the [API](#API).

## HomeKit Protocol

Hint: the Homekit Application Protocol (HAP) allows that you can pair a Homekit
device with one device. As soon as the Homekit device is paired, its not
possible to pair with another iOS device anymore.

## API

HAP-NodeJS provides a set of classes you can use to construct Accessories
programatically. For an example implementation, see [Lock_accessory.ts](src/accessories/Lock_accessory.ts).

The key classes intended for use by API consumers are:

- [Accessory](src/lib/Accessory.ts): Represents a HomeKit device that can be
published on your local network.

- [Bridge](src/lib/Bridge.ts): A kind of Accessory that can host other
Accessories "behind" it while only publishing a single device.

- [Service](src/lib/Service.ts): Represents a set of grouped values necessary
to provide a logical function. Most of the time, when you think of a
supported HomeKit device like "Thermostat" or "Door Lock", you're actually
thinking of a Service. Accessories can expose multiple services.

- [Characteristic](src/lib/Characteristic.ts): Represents a particular typed
variable assigned to a Service, for instance the `LockMechanism` Service
contains a `CurrentDoorState` Characteristic describing whether the door
is currently locked.

All known built-in Service and Characteristic types that HomeKit supports are
exposed as a separate subclass in [HomeKitTypes](src/lib/gen/HomeKit.ts).

See each of the corresponding classes for more explanation and notes.
