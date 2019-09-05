HAP-NodeJS
==========

[![NPM version](https://badge.fury.io/js/hap-nodejs.svg)](http://badge.fury.io/js/hap-nodejs)

HAP-NodeJS is a Node.js implementation of the HomeKit Accessory Server.

With this project, you should be able to create your own HomeKit Accessory on a Raspberry Pi, Intel Edison, or any other platform that can run Node.js :)

The implementation may not 100% follow the HAP MFi Specification since the MFi program doesn't allow individual developers to join.

Remember to run `npm install` and `npm install --only=dev` before actually running the server.

Users can define their own accessories in: accessories/[name]_accessory.ts files, where [name] is a short description of the accessory. All defined accessories get loaded on server start. You can define accessories using an object literal notation (see [Fan_accessory.ts](src/accessories/Fan_accessory.ts) for an example) or you can use the API (see below).

You can use the following command to start the HAP Server in Bridged mode:

```sh
ts-node --files src/BridgedCore.ts
```

Or, if you wish to host each Accessory as an independent HomeKit device:

```sh
ts-node --files src/Core.ts
```

The HAP-NodeJS library uses the [debug](https://github.com/visionmedia/debug) library for log output. You can print some or all of the logs by setting the `DEBUG` environment variable. For instance, to see all debug logs while running the server:

```sh
DEBUG=* ts-node --files src/BridgedCore.ts
```

HOMEKIT PROTOCOL
================

Hint: the Homekit Application Protocol (HAP) allows that you can pair a Homekit device with one device. As soon as the Homekit device is paired, its not possible to pair with another iOS device anymore.

API
===

HAP-NodeJS provides a set of classes you can use to construct Accessories programatically. For an example implementation, see [Lock_accessory.ts](src/accessories/Lock_accessory.ts).

The key classes intended for use by API consumers are:

  * [Accessory](src/lib/Accessory.ts): Represents a HomeKit device that can be published on your local network.
  * [Bridge](src/lib/Bridge.ts): A kind of Accessory that can host other Accessories "behind" it while only publishing a single device.
  * [Service](src/lib/Service.ts): Represents a set of grouped values necessary to provide a logical function. Most of the time, when you think of a supported HomeKit device like "Thermostat" or "Door Lock", you're actualy thinking of a Service. Accessories can expose multiple services.
  * [Characteristic](src/lib/Characteristic.ts): Represents a particular typed variable assigned to a Service, for instance the `LockMechanism` Service contains a `CurrentDoorState` Characteristic describing whether the door is currently locked.

All known built-in Service and Characteristic types that HomeKit supports are exposed as a separate subclass in [HomeKitTypes](src/lib/gen/HomeKit.ts).

See each of the corresponding class files for more explanation and notes.

Notes
=====

Special thanks to [Alex Skalozub](https://twitter.com/pieceofsummer), who reverse engineered the server side HAP. ~~You can find his research at [here](https://gist.github.com/pieceofsummer/13272bf76ac1d6b58a30).~~ (Sadly, on Nov 4, Apple sent the [DMCA](https://github.com/github/dmca/blob/master/2014/2014-11-04-Apple.md) request to Github to remove the research.)

[There](http://instagram.com/p/t4cPlcDksQ/) is a video demo running this project on Intel Edison.

If you are interested in HAP over BTLE, you might want to check [this](https://gist.github.com/KhaosT/6ff09ba71d306d4c1079).

Projects based on HAP-NodeJS
============================

* [Homebridge](https://github.com/nfarina/homebridge) - HomeKit support for the impatient - Pluggable HomeKit Bridge. Plugins available for  e.g. Pilight, Telldus TDtool, Savant, Netatmo, Open Pixel Control, HomeWizard, Fritz!Box, LG WebOS TV, Home Assistant, HomeMatic and many many more.
* [OpenHAB-HomeKit-Bridge](https://github.com/htreu/OpenHAB-HomeKit-Bridge) - OpenHAB HomeKit Bridge bridges openHAB items to Apple´s HomeKit Accessory Protocol.
* [homekit2mqtt](https://github.com/hobbyquaker/homekit2mqtt) - HomeKit to MQTT bridge.
* [pimatic-hap](https://github.com/michbeck100/pimatic-hap) - Pimatic homekit bridge.
* [node-red-contrib-homekit](https://github.com/NRCHKB/node-red-contrib-homekit-bridged) - Node-RED nodes to simulate Apple HomeKit devices.
* [ioBroker.homekit](https://github.com/ioBroker/ioBroker.homekit2) - connect ioBroker to HomeKit.
* [AccessoryServer](https://github.com/Appyx/AccessoryServer) - HomeKit integration for IR/RF/IP-devices
