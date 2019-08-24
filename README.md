# HAP-NodeJS

[![MIT Licensed][icon-license]][link-license]
[![NPM version][icon-npm]][link-npm]

HAP-NodeJS is a Node.js implementation of the HomeKit Accessory Server.

With this project, you should be able to create your own HomeKit Accessory on
a Raspberry Pi, Intel Edison, or any other platform that can run Node.js :)

The implementation may not 100% follow the HAP MFi Specification since the MFi
program doesn't allow individual developers to join.

Remember to run `yarn`/`npm install` before actually running the server.

Users can define their own accessories in: `accessories/[name]_accessory.ts`
files, where `[name]` is a short description of the accessory. All defined
accessories get loaded on server start. You can define accessories using an
object literal notation (see [`Fan_accessory.ts`](src/accessories/Fan_accessory.ts)
for an example) or you can use the API (see below).

You can use the following command to start the HAP Server in Bridged mode:

```sh
ts-node --files src/BridgedCore.ts
```

Or, if you wish to host each Accessory as an independent HomeKit device:

```sh
ts-node --files src/Core.ts
```

The HAP-NodeJS library uses the [`debug`][link-lib-debug] library for log output.
You can print some or all of the logs by setting the `DEBUG` environment
variable. For instance, to see all debug logs while running the server:

```sh
DEBUG=* ts-node --files src/BridgedCore.ts
```

## Projects based on HAP-NodeJS

- [Homebridge][link-proj-homebridge] - HomeKit support for the
  impatient - Pluggable HomeKit Bridge. Plugins available for  e.g. Pilight,
  Telldus TDtool, Savant, Netatmo, Open Pixel Control, HomeWizard, Fritz!Box,
  LG WebOS TV, Home Assistant, HomeMatic and many many more.

- [OpenHAB-HomeKit-Bridge][link-proj-openhab-homekit-bridge] - OpenHAB HomeKit
  Bridge bridges openHAB items to Apple´s HomeKit Accessory Protocol.

- [homekit2mqtt][link-proj-homekit2mqtt] - HomeKit to MQTT bridge.

- [pimatic-hap][link-proj-pimatic-hap] - Pimatic homekit bridge.

- [node-red-contrib-homekit][link-proj-node-red-contrib-homekit] - Node-RED
  nodes to simulate Apple HomeKit devices.

- [ioBroker.homekit][link-proj-ioBroker-homekit] - connect ioBroker to HomeKit.

- [AccessoryServer][link-proj-accessoryserver] - HomeKit integration for
  IR/RF/IP-devices

[icon-license]: https://img.shields.io/github/license/KhaosT/hap-nodejs.svg?longCache=true&style=flat-square
[link-license]: LICENSE
[icon-npm]: https://img.shields.io/npm/v/hap-nodejs.svg?longCache=true&style=flat-square
[link-npm]: https://www.npmjs.com/package/hap-nodejs

[link-lib-debug]: https://github.com/visionmedia/debug
[link-proj-homebridge]: https://github.com/nfarina/homebridge
[link-proj-openhab-homekit-bridge]: https://github.com/htreu/OpenHAB-HomeKit-Bridge
[link-proj-homekit2mqtt]: https://github.com/hobbyquaker/homekit2mqtt
[link-proj-pimatic-hap]: https://github.com/michbeck100/pimatic-hap
[link-proj-node-red-contrib-homekit]: https://github.com/NRCHKB/node-red-contrib-homekit-bridged
[link-proj-ioBroker-homekit]: https://github.com/ioBroker/ioBroker.homekit2
[link-proj-accessoryserver]: https://github.com/Appyx/AccessoryServer
