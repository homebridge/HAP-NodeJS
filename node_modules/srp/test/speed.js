const params = require('../lib/params'),
      srp = require('../lib/srp'),
      s = new Buffer("salty"),
      I = new Buffer("alice"),
      P = new Buffer("password123"),
      N = params[4096].N,
      g = params[4096].g,
      ALG_NAME = 'sha256';
// use "npm install benchmark microtime" to run this
var benchmark = require("benchmark");

var b = new benchmark("getV", function() {
    var v = srp.getv(s, I, P, N, g, ALG_NAME);
});

var res = b.run();

console.log("getV (mean)", res.times.period, "seconds");

// getV: 1.78ms with bigint, 2.35ms with bignum
// (on my mid-2012 Retina MacBookPro, quad-core 2.6GHz Core i7)
