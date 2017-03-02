'use strict';

const _ = require('lodash');
const dgram = require('dgram');
const async = require('async');
const debug = require('debug')('ssdp');
const q = require('q');
var ip = require('ip');
var config;

module.exports = {
    startSsdpServer: startSsdpServer,
    description: description
};

let udpServer;

function getDiscoveryResponses() {

    let responseString = `HTTP/1.1 200 OK
HOST: 239.255.255.250:` + config.ssdp +`
CACHE-CONTROL: max-age=100
EXT:
LOCATION: http://` + ip.address() + `:` + config.port + `/description.xml
SERVER: Linux/3.14.0 UPnP/1.0 IpBridge/1.15.0
hue-bridgeid: E0CB4EFFFEE16375
ST: urn:schemas-upnp-org:device:basic:1
USN: uuid:2f402f80-da50-11e1-9b23-e0cb4ee16375\r\n\r\n`;

    return responseString;
}

function stopDiscoveryServer() {
    if (!udpServer) {
        debug('not running');
        return q();
    }

    const deferred = q.defer();
    debug('try to stop udpServer');
    try {
        udpServer.close(() => {
            debug('udp server stopped');
            deferred.resolve();
        });
    } catch (err) {
        debug('failed to close udp server: %s', err.message);
        //ignore this error
        deferred.resolve();
    }
    return deferred.promise;
}

function startSsdpServer(_config) {

    if ( !_config.ssdp )
      {
        debug("Not starting SSDP Server");
        return;
      }

    config = _config;

    const deferred = q.defer();
    stopDiscoveryServer()
        .then(() => {
            udpServer = dgram.createSocket('udp4');

            udpServer.on('error', (err) => {
                debug(`server error:\n${err.stack}`);
                throw err;
            });

            udpServer.on('message', (msg, rinfo) => {
                //                debug(`<< server got: ${msg} from ${rinfo.address}:${rinfo.port}`);

                if (msg.indexOf('ssdp:discover') > 0 && msg.indexOf('urn:schemas-upnp-org:device:basic') > 0) {
                    debug(`<< server got Hue: ${msg} from ${rinfo.address}:${rinfo.port}`);
                    var response = getDiscoveryResponses();
                    udpServer.send(response, rinfo.port, rinfo.address, () => {
                        debug('>> sent response ssdp discovery response', response);

                    });

                }
            });

            udpServer.on('listening', () => {
                try {
                    const address = udpServer.address();
                    debug(`server listening ${address.address}:${address.port}`);
                    udpServer.addMembership('239.255.255.250');
                    deferred.resolve();
                } catch (err) {
                    debug('udp server error: %s', err.message);
                    deferred.reject(err);
                }
            });

            debug('binding to port %s for ssdp discovery',config.ssdp);
            try {
                udpServer.bind(config.ssdp);
            } catch (err) {
                debug('error binding udp server: %s', err.message);
                deferred.reject(err);
            }
        });

    return deferred.promise;
};

module.exports.stopDiscoveryServer = stopDiscoveryServer;

function description(accessories) {
  let response = `<?xml version="1.0" encoding="UTF-8" ?>
  <root xmlns="urn:schemas-upnp-org:device-1-0">
  <specVersion>
  <major>1</major>
  <minor>0</minor>
  </specVersion>
  <URLBase>http://`+ip.address()+`:`+config.port+`/</URLBase>
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
