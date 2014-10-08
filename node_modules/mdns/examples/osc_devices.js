#!/usr/bin/env node
var mdns    = require('../lib/mdns')
  , listOfOscDevices = { /*name: {adresses: ['192.168.0.24', 'fe80::0:18'], port: 10001}}*/ }
  ;

var mdnsBrowser = mdns.createBrowser(mdns.udp('osc'));

mdnsBrowser.on('serviceUp', function(service) {
  // ignore duplicate ups
  if(listOfOscDevices[service.name]) return;

  listOfOscDevices[service.name] = {'addresses': service.addresses, 'port': service.port};
  var cnt = Object.keys(listOfOscDevices).length;

  console.log('osc device "'+service.name+' up at '+service.addresses[0]+':'+service.port+', now '+cnt+' devices on the net');
});

mdnsBrowser.on('serviceDown', function(service) {
// ignore duplicate downs
  if(!listOfOscDevices[service.name]) return;

  var device = listOfOscDevices[service.name];

  delete listOfOscDevices[service.name];
  var cnt = Object.keys(listOfOscDevices).length;

  console.log('osc device "'+service.name+' up at '+device.addresses[0]+':'+device.port+', now '+cnt+' devices on the net');
});

console.log('listening for osc-compatible devices on the net')
mdnsBrowser.start();
