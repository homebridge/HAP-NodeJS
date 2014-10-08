#!/usr/bin/env node
var mdns    = require('../lib/mdns')
  , app     = express.createServer()
  ;


try {
  var express = require('express');
} catch (e) {
  console.log('please install express manualy: npm install express');
}
app.get('/', function() { return "Hello World"; });

app.on('listening', function() {
  mdns.createAdvertisement(mdns.tcp('http') , app.address().port ).start();
});

app.listen(4321);
