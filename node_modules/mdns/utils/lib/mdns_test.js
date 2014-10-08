
var path = require('path')
  ;


exports.require = function _require(what) {
  if (process.env.npm_config_coverage || process.env.BUILDTYPE === 'Coverage') {
    return require(path.join('../../build/Coverage/lib/' + what))
  }
  return require('../../lib/' + what)
}

var mdns  = exports.require('mdns');

var legal_chars = "abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

exports.suffixedServiceType = function suffixedServiceType(serviceName, protocol) {
  serviceName += '-';
  while (serviceName.length < 14) {
    serviceName += legal_chars[Math.floor(Math.random() * legal_chars.length)];
  }
  return mdns.makeServiceType.apply(this, arguments)
}

exports.runTestAd = function runTestAd(type, port, uptime, cooltime, cb) {
  if ( ! cb ) {
    cb = cooltime;
    cooltime = uptime;
  }
  if ( ! cb) {
    cb = cooltime;
    uptime = cooltime = 2000;
  }
  var ad = new mdns.createAdvertisement(type, port, function(error, service) {
        if (error) throw error;
        setTimeout(function() { ad.stop(); setTimeout(cb, cooltime); }, uptime);
      });
  ad.start();
  return ad;
}

if (0) {
exports.lifeExpectancy = 5000;

var lifeTimer;

process.nextTick(function() {
  lifeTimer = setTimeout(function() {
    throw new Error("test did not finish within " + (exports.lifeExpectancy / 1000) + " seconds.");
    process.exit(-1);
  }, exports.lifeExpectancy);
});

exports.done = function done() { clearTimeout( lifeTimer ); }
}
