This is a binding to the curve25519-donna library for node. Usage:

    var curve = require('curve25519');

Methods
=======
`curve.makeSecretKey(secret)`
-----------------------------
Provide it with a 32-bytes-long `Buffer` and it will be modified in-place in order to be a usable secret key. Doesn't return anything.

`curve.derivePublicKey(secret)`
-------------------------------
Provide it with your secret key as a 32-bytes-long `Buffer` and get a `Buffer` containing your public key as the result.

`curve.deriveSharedSecret(mysecret, hispublic)`
-----------------------------------------------
Derive your shared secret with someone else by giving this function two 32-bytes-long buffers containing your secret key and the other persons public key. Returns a `Buffer`.

Installing
==========
Not yet on npm, I will only put it there when it's stable. Just work with `git clone` and `npm link`.
