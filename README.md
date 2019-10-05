# HAP-NodeJS

[![MIT Licensed][icon-license]][link-license]
[![NPM version][icon-npm]][link-npm]

HAP-NodeJS is a Node.js implementation of the HomeKit Accessory Server.

With this project, you should be able to create your own HomeKit Accessory on
a Raspberry Pi, Intel Edison, or any other platform that can run Node.js 😃

The implementation may not 100% follow the HAP MFi Specification since the MFi
program doesn't allow individual developers to join.

## Setting up the project

Run the following commands to clone the project, install all dependencies and
compile the Typescript sources to Javascript.

```bash
git clone https://github.com/KhaosT/HAP-NodeJS
cd HAP-NodeJS
```

Then depending on which package manager you use, run the following:

```bash
yarn
yarn build
```

OR

```bash
npm install && npm install --only=dev
npm run build
```

You can use the following command to start the HAP Server in Bridged mode:

```bash
node dist/BridgedCore.ts
```

Or, if you wish to host each Accessory as an independent HomeKit device:

```bash
node dist/Core.ts
```

The HAP-NodeJS library uses the [`debug`][link-lib-debug] library for log
output. You can print some or all of the logs by setting the `DEBUG` environment
variable. For instance, to see all debug logs while running the server:

```bash
DEBUG=* node dist/BridgedCore.ts
```

For more guidance on developing accessories, please check
[ACCESSORIES.md](ACCESSORIES.md).

For more information about contributing patches, please check
[CONTRIBUTING.md](CONTRIBUTING.md).

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

## Notes

Special thanks to [Alex Skalozub][link-alex-skalozub], who reverse-engineered
the server side HAP. ~~You can find his research [here][link-homekit-research]
.~~ (Sadly, on Nov 4, Apple sent the [DMCA][link-apple-dmca] request to Github
to remove the research.)

[There](http://instagram.com/p/t4cPlcDksQ/) is a video demo running this project
on Intel Edison.

If you are interested in HAP over BTLE, you might want to check [this][link-hap-over-btle].

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

[link-alex-skalozub]: https://twitter.com/pieceofsummer
[link-homekit-research]: https://gist.github.com/pieceofsummer/13272bf76ac1d6b58a30
[link-apple-dmca]: https://github.com/github/dmca/blob/master/2014/2014-11-04-Apple.md
[link-hap-over-btle]: https://gist.github.com/KhaosT/6ff09ba71d306d4c1079
