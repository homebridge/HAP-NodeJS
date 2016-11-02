var crypto = require("crypto");

module.exports = {
  HKDF: HKDF
};

function HKDF(hashAlg, salt, ikm, info, size) {
  // create the hash alg to see if it exists and get its length
  var hash = crypto.createHash(hashAlg);
  var hashLength = hash.digest().length;

  // now we compute the PRK
  var hmac = crypto.createHmac(hashAlg, salt);
  hmac.update(ikm);
  var prk = hmac.digest();

  var prev = Buffer.alloc(0);
  var output;
  var buffers = [];
  var num_blocks = Math.ceil(size / hashLength);
  info = Buffer.from(info);

  for (var i=0; i<num_blocks; i++) {
    var hmac = crypto.createHmac(hashAlg, prk);

    var input = Buffer.concat([
      prev,
      info,
      Buffer.from(String.fromCharCode(i + 1))
    ]);
    hmac.update(input);
    prev = hmac.digest();
    buffers.push(prev);
  }
  output = Buffer.concat(buffers, size);
  return output.slice(0,size);
}
