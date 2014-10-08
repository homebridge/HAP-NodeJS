var binding = require("./build/Release/curve");

var basepoint = (function() {
  var buf = new Buffer(32);
  buf[0] = 9;
  for (var i=1; i<32; i++) {
    buf[i] = 0;
  }
  return buf;
})();

exports.makeSecretKey = function(mysecret) {
  if (!mysecret instanceof Buffer)
    throw 'mysecret must be a Buffer';
  if (mysecret.length != 32)
    throw 'mysecret must be 32 bytes long';
  mysecret[0] &= 248;
  mysecret[31] &= 127;
  mysecret[31] |= 64;
  return mysecret;
}

exports.derivePublicKey = function (mysecret) {
  var mypublic = new Buffer(32);
  binding.curve(mypublic, mysecret, basepoint);
  return mypublic;
}

exports.deriveSharedSecret = function (mysecret, hispublic) {
  var sharedSecret = new Buffer(32);
  binding.curve(sharedSecret, mysecret, hispublic);
  return sharedSecret;
}
