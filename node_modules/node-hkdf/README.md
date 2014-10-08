# node-hkdf

The HMAC-based Key Derivation Function for node.js.

spec: https://tools.ietf.org/html/rfc5869

## install

    npm install hkdf

## use

    const HKDF = require('hkdf');
    
    var hkdf = new HKDF('sha256', 'salt123', 'initialKeyingMaterial');
    hkdf.derive('info', 42, function(key) {
      // key is a Buffer, that can be serialized however one desires
      console.log(key.toString('hex'));
    });
    
## license

Apache License 2.0
