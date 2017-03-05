'use strict';

var ip = require('ip');
const debug = require('debug')('hue');
var ssdp = require('./ssdp');
var once = require('./once').once;

var hueDevices = {};

var hap_that;

module.exports = {
    handleHueApi: handleHueApi
};

function handleHueApi(that, request, response, session, events, requestData) {

    hap_that = that;

    // /api/{username}/lights - returns list of lights
    // /api/{username}/light2/# - returns On/Off status of a light
    // /api/{username}/lights/#/state - sets the status of a light
    // /api/{username}/groups/# - gets groups of lights

    var lightid = request.url.split("/")[4];

    if (lightid != undefined)
        lightid = 'bulb';

    switch (request.url.split("/")[3] + lightid + request.url.split("/")[5]) {
        case "lightsundefinedundefined":
            // returns light of lights
            that.emit('accessories', once(function(err, accessories) {

                if (err) {
                    debug("[%s] Error getting accessories: %s", this.accessoryInfo.username, err.message);
                    response.writeHead(500, "Server Error");
                    response.end();
                    return;
                }

                response.writeHead(200, {
                    "Content-Type": "application/json"
                });
                response.end(JSON.stringify(lights(accessories)));
            }));
            break;
        case "lightsbulbundefined":
            // returns On/Off status of a light
            var data = hueToHK(request.url);

            that.emit('get-characteristics', data, events, once(function(err, characteristics) {

                if (!characteristics && !err)
                    err = new Error("characteristics not supplied by the get-characteristics event callback");

                if (err) {
                    debug("[%s] Error getting characteristics: %s", this.accessoryInfo.username, err.stack);

                    // rewrite characteristics array to include error status for each characteristic requested
                    //TODO: This should return a HUE API Error not this
                    characteristics = [];
                    for (var i in data) {
                        characteristics.push({
                            aid: data[i].aid,
                            iid: data[i].iid,
                            status: HAPServer.Status.SERVICE_COMMUNICATION_FAILURE
                        });
                    }
                }

                // 207 is "multi-status" since HomeKit may be requesting multiple things and any one can fail independently
                response.writeHead(207, {
                    "Content-Type": "application/hap+json"
                });
                response.end(JSON.stringify(light(characteristics)));

            }.bind(that)), false, session.sessionID);
            break;
        case "lightsbulbstate":
            // sets the state of a light

            var data = hueToHKCharacteristic(request.url, JSON.parse(requestData.toString()));

            // call out to listeners to set the device status
            that.emit('set-characteristics', data, events, once(function(err, characteristics) {

                if (err) {
                    debug("[%s] Error setting characteristics: %s", this.accessoryInfo.username, err.message);

                    // rewrite characteristics array to include error status for each characteristic requested
                    characteristics = [];
                    for (var i in data) {
                        characteristics.push({
                            aid: data[i].aid,
                            iid: data[i].iid,
                            status: HAPServer.Status.SERVICE_COMMUNICATION_FAILURE
                        });
                    }
                }

                // 207 is "multi-status" since HomeKit may be setting multiple things and any one can fail independently

                response.writeHead(200, {
                    "Content-Type": "application/json"
                });

                // The response is basically ignored by alexadevices

                response.end(`[
                    {"success":{"/lights/2/state/on":true}}
                    ]`);

            }.bind(that)), false, session.sessionID);

            break;
        case "groupsbulbundefined":
            // returns groups of lights - not implemented by Alexa
            response.writeHead(200, {
                "Content-Type": "application/json"
            });
            response.end(groups());
            break;
        default:
            debug('unhandled API request', request.url.split("/")[3] + request.url.split("/")[5], request.url);
            response.writeHead(500, "Server Error");
            response.end();
    }
}

// Converts HomeKit accessories to Hue list of lights

function lights(accessories) {
    return (_parseHbtoHue(accessories.accessories));
}

function cached(that) {

    that.emit('accessories', once(function(err, accessories) {

        if (err) {
            debug("[%s] Error getting accessories: %s", this.accessoryInfo.username, err.message);
            return;
        }
        lights(accessories);
    }));

    debug('Object.keys(hueDevices).length', Object.keys(hueDevices).length);
    if (Object.keys(hueDevices).length > 0) {
        return (true);
    } else {
        return (false);
    }
}

// convert Hue to HomeKit API

function hueToHK(url) {
    var data = [];

    data.push({
        aid: parseInt(url.split("/")[4]),
        iid: _getOiid(parseInt(url.split("/")[4]))
    });

    return (data);
}




function hueToHKCharacteristic(url, requestData) {

    var aid = _getAid(parseInt(url.split("/")[4]));
    var characteristic = [{
        "aid": 1,
        "iid": 1,
        "value": 0
    }];

    // { bri: 127 } = Dim
    // { on: false }

    switch (Object.getOwnPropertyNames(requestData)[0]) {
        case "on":
            if (requestData.on == false) {
                var value = 0;
            } else {
                var value = 1;
            }

            characteristic = [{
                "aid": _getAid(parseInt(url.split("/")[4])),
                "iid": _getOiid(parseInt(url.split("/")[4])),
                "value": value
            }];
            break;
        case "bri":
            characteristic = [{
                "aid": _getAid(parseInt(url.split("/")[4])),
                "iid": _getBiid(parseInt(url.split("/")[4])),
                "value": parseInt(requestData.bri / 2.55)
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
// not sure what value it brings

function light(characteristics) {

    debug('light', characteristics);

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

function _parseHbtoHue(accessories) {
    hueDevices = {};

    for (var accessory in accessories) {

        var aid = accessories[accessory].aid;
        var device = accessories[accessory];
        var iid, oiid, biid, name, description, model, manufacturer;

        for (var service in device.services) {
            name = "";
            oiid = 0;
            biid = 0;
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
                    var cType = characteristic.type;

                    //                name = characteristic.value;

                    if (cType.startsWith("00000020")) {
                        // Accessory Model
                        manufacturer = characteristic.value;
                    }
                    if (cType.startsWith("00000021")) {
                        // Accessory Model
                        model = characteristic.value;
                    }
                    if (cType.startsWith("00000023")) {
                        // Accessory Name
                        name = characteristic.value;
                        description = characteristic.description;
                    }

                    // On/Off characteristic
                    if (cType.startsWith("00000025")) {
                        oiid = characteristic.iid
                        //    var type = "On/Off light";
                        // The api specifies an on/off device but Alexa doesn't support
                        var type = "Dimmable light";
                        actions.push("turnOn", "turnOff");
                    }

                    // Brightness characteristic
                    if (cType.startsWith("00000008")) {
                        biid = characteristic.iid;
                        var type = "Dimmable light";
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
                        "type": type,
                        "name": name,
                        "modelid": "LWB004",
                        "manufacturername": manufacturer,
                        "uniqueid": _getUniqueid(aid, oiid, biid),
                        "swversion": "66012040"
                    };
                    debug('device response', aid, hueDevices[aid]);
                }
            }
        }

    }

    return hueDevices;
}

function _getUniqueid(aid, oiid, biid) {
    // Homebridge username : AID : On/Off IID - Dim IID
    var mac = ssdp.getHueBridgeMac().toLowerCase().split(':');
    return (_pad(mac[0]) + ':' + _pad(mac[1]) + ':' + _pad(mac[2]) + ':' + _pad(mac[3]) +
        ':' + _pad(mac[4]) + ':' + _pad(mac[5]) + ':' + _pad(aid) + ':' + _pad(oiid) + '-' + _pad(biid));
}

function _pad(value) {
    return (("00" + value).slice(-2));
}

function _getAid(lightid) {
    return (lightid);
}

function _getOiid(lightid) {
    if (!hueDevices[lightid]) {
        debug('hueDevices not cached', hueDevices, lightid);
        getHKAccessories();
    }
    var mac = hueDevices[lightid].uniqueid.split(':');
    var iid = mac[7].split('-');
    return (parseInt(iid[0]));

}

function _getBiid(lightid) {
    if (!hueDevices[lightid]) {
        debug('hueDevices not cached', hueDevices, lightid);
        getHKAccessories();
    }

    var mac = hueDevices[lightid].uniqueid.split(':');
    var iid = mac[7].split('-');
    return (parseInt(iid[1]));

}

function getHKAccessories() {
    hap_that.emit('accessories', once(function(err, accessories) {

        return (lights(accessories));
    }));
}
