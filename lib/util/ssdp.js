'use strict';

const _ = require('lodash');
const dgram = require('dgram');
const async = require('async');
const debug = require('debug')('ssdp');
const q = require('q');
var ip = require('ip');
var port;

let udpServer;

function getDiscoveryResponses() {

    let responseString = `HTTP/1.1 200 OK
HOST: 239.255.255.250:1900
CACHE-CONTROL: max-age=100
EXT:
LOCATION: http://` + ip.address() + `:` + port + `/description.xml
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

module.exports.getPort = function() {
  return(port);
}


module.exports.startSsdpServer = function(_port) {

    port = _port;

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

            debug('binding to port 1900 for ssdp discovery');
            try {
                udpServer.bind(1900);
            } catch (err) {
                debug('error binding udp server: %s', err.message);
                deferred.reject(err);
            }
        });

    return deferred.promise;
};

module.exports.stopDiscoveryServer = stopDiscoveryServer;
