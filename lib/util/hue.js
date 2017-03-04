'use strict';

var ip = require('ip');
const debug = require('debug')('hue');
var ssdp = require('./ssdp');

module.exports = {
    lights: lights,
    groups: groups,
    light: light,
    state: state
};

function lights(accessories) {
    return (parseHbtoHue(accessories.accessories));
}

// convert Hue to HomeKit API

function state(url, requestData) {

    var aid = parseInt(url.split("/")[4]);
    var characteristic = [{
        "aid": 1,
        "iid": 1,
        "value": 0
    }];

    // { bri: 127 } = Dim
    // { on: false }

    //TODO: Hardcoded IID 9 as on/off and IID 10 as Brightness

    switch (Object.getOwnPropertyNames(requestData)[0]) {
        case "on":
            if (requestData.on == false) {
                var value = 0;
            } else {
                var value = 1;
            }

            characteristic = [{
                "aid": aid,
                "iid": 9,
                "value": value
            }];
            break;
        case "bri":
            characteristic = [{
                "aid": aid,
                "iid": 10,
                "value": parseInt(requestData.bri/2.55)
            }];
            break;
        default:
            debug("Unknown operation", requestData);
    }
    return (characteristic);
}

// This is not supported by homebridge or alexa as far as I'm aware

function groups(accessories) {

    return (`{
      "action": {
          "on": false,
          "bri": 0,
          "hue": 0,
          "sat": 0,
          "effect": "none",
          "ct": 0,
          "alert": "none",
          "reachable": true
      },
      "lights": ["11"],
      "name": "Lightset 0",
      "type": "LightGroup"
  }`);
}

// This is used as the response for a status command, but as Alexa can't tell status
// not sure what good it is

function light(characteristics) {

    debug(characteristics);

    var value = "true";

    return ({
        "state": {
            "on": value,
            "bri": 0,
            "hue": 0,
            "sat": 0,
            "effect": "none",
            "ct": 0,
            "alert": "none",
            "reachable": true
        },
        "type": "Family room outlet",
        "name": "Garden Path",
        "modelid": "LWB004",
        "manufacturername": "Frank",
        "uniqueid": "garbage",
        "swversion": "66012040"
    });
}

// Parse HomeBridge accessories object into Hue API for consumption by Alexa

function parseHbtoHue(accessories) {
    var hueDevices = {};

    for (var accessory in accessories) {

        var aid = accessories[accessory].aid;
        var device = accessories[accessory];
        var iid, name, description, model, manufacturer;

        for (var service in device.services) {
            name = "";
            var serviceType = device.services[service].type;
            var additionalApplianceDetails = {};
            var actions = [];
            //            log("Service=", aid, serviceType);
            //            log("Object: %s", JSON.stringify(device.services[service], null, 2));
            // Switch or Outlet
            if (serviceType.startsWith("00000043") || serviceType.startsWith("00000047") ||
                serviceType.startsWith("00000049") || serviceType.startsWith("0000003E")) {
                for (var id in device.services[service].characteristics) {
                    //      log("ID=",id);
                    var characteristic = device.services[service].characteristics[id];
                    var type = characteristic.type;

                    //                name = characteristic.value;

                    if (type.startsWith("00000020")) {
                        // Accessory Model
                        manufacturer = characteristic.value;
                    }
                    if (type.startsWith("00000021")) {
                        // Accessory Model
                        model = characteristic.value;
                    }
                    if (type.startsWith("00000023")) {
                        // Accessory Name
                        name = characteristic.value;
                        description = characteristic.description;
                    }

                    if (type.startsWith("00000025")) {
                        var iid = characteristic.iid;
                        actions.push("turnOn", "turnOff");
                    }

                    if (type.startsWith("00000008")) {
                        var iid = characteristic.iid;
                        actions.push("turnOn", "turnOff");

                    }

                }

                if (actions.length > 0) {
                    hueDevices[aid] = {
                        "state": {
                            "on": false,
                            "bri": 0,
                            "hue": 0,
                            "sat": 0,
                            "effect": "none",
                            "ct": 0,
                            "alert": "none",
                            "reachable": true
                        },
                        "type": "Dimmable light",
                        "name": name,
                        "modelid": "LWB004",
                        "manufacturername": manufacturer,
                        "uniqueid": getUniqueid(aid,iid),
                        "swversion": "66012040"
                    };
                    debug('Device',hueDevices[aid]);
                }
            }
        }

    }

    return hueDevices;
}

function getUniqueid(aid,iid) {
  var mac = ssdp.getHueBridgeMac().toLowerCase().split(':');
  return(pad(mac[0])+':'+pad(mac[1])+':'+pad(mac[2])+':'+pad(mac[3])+':'+pad(mac[4])+':'+pad(mac[5])+':'+pad(aid)+':'+pad(iid)+'-'+pad(iid));
}

function pad(value) {
  return(("00"+value).slice(-2));
}
