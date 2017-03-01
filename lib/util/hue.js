'use strict';

var ip = require('ip');
var port = require('./ssdp').getPort;

module.exports = {
    lights: lights,
    groups: groups,
    light: light,
    description: description,
    state: state
};

function lights(accessories) {
    return (parseHbtoHue(accessories.accessories));
}

function state(url,requestData)
{

  console.log(url,requestData);
  var aid = parseInt(url.split("/")[4]);

// { bri: 127 } = Dim

  if ( requestData.on == false )
  {
    var value = 0;
  } else
  {
    var value = 1;
  }

  var characteristic = [{ "aid": aid, "iid": 9, "value": value}];
  return(characteristic);
}

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

function light(characteristics) {

  console.log(characteristics);

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

function description(accessories) {
  let response = `<?xml version="1.0" encoding="UTF-8" ?>
  <root xmlns="urn:schemas-upnp-org:device-1-0">
  <specVersion>
  <major>1</major>
  <minor>0</minor>
  </specVersion>
  <URLBase>http://`+ip.address()+`:`+port()+`/</URLBase>
  <device>
  <deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType>
  <friendlyName>Philips hue (`+ip.address()+`)</friendlyName>
  <manufacturer>Royal Philips Electronics</manufacturer>
  <manufacturerURL>http://www.philips.com</manufacturerURL>
  <modelDescription>Philips hue Personal Wireless Lighting</modelDescription>
  <modelName>Philips hue bridge 2015</modelName>
  <modelNumber>BSB002</modelNumber>
  <modelURL>http://www.meethue.com</modelURL>
  <serialNumber>E0CB4EFFFEE16375</serialNumber>
  <UDN>uuid:2f402f80-da50-11e1-9b23-e0cb4ee16375</UDN>
  <serviceList>
  <service>
  <serviceType>(null)</serviceType>
  <serviceId>(null)</serviceId>
  <controlURL>(null)</controlURL>
  <eventSubURL>(null)</eventSubURL>
  <SCPDURL>(null)</SCPDURL>
  </service>
  </serviceList>
  <presentationURL>index.html</presentationURL>
  <iconList>
  <icon>
  <mimetype>image/png</mimetype>
  <height>48</height>
  <width>48</width>
  <depth>24</depth>
  <url>hue_logo_0.png</url>
  </icon>
  <icon>
  <mimetype>image/png</mimetype>
  <height>120</height>
  <width>120</width>
  <depth>24</depth>
  <url>hue_logo_3.png</url>
  </icon>
  </iconList>
  </device>
  </root>`

  return(response);
}

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
                        // Accessory On/Off
                        //                        log("Accessory ( Switch )= ", aid, iid, name, description);
                        additionalApplianceDetails["TurnOnRequest"] = "{\"aid\":" +
                            parseInt(aid) + ",\"iid\":" + parseInt(iid) + ",\"value\":1}";
                        additionalApplianceDetails["TurnOffRequest"] = "{\"aid\":" +
                            parseInt(aid) + ",\"iid\":" + parseInt(iid) + ",\"value\":0}";
                    var iid = characteristic.iid;
                        actions.push("turnOn", "turnOff");
                    }

                    if (type.startsWith("00000008")) {
                        // Accessory Bright/Dim
                        additionalApplianceDetails["SetPercentageRequest"] = "{\"aid\":" +
                            parseInt(aid) + ",\"iid\":" + parseInt(iid) + ",\"value\":1}";
                    var iid = characteristic.iid;
                        actions.push("setPercentage");
                        //                        log("Accessory ( Dimmer )= ", aid, iid, name, description);
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
                        "uniqueid": aid+":"+iid,
                        "swversion": "66012040"
                    };
                    //                    log("Object: %s", JSON.stringify(alexadevices[aid.toString()], null, 2));
                }
            }
        }

    }

    return hueDevices;
}
