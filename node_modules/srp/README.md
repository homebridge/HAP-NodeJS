[![build status](https://secure.travis-ci.org/jedp/node-srp.png)](http://travis-ci.org/jedp/node-srp)

# SRP - Secure Remote Password

Implementation of the [SRP Authentication and Key Exchange
System](http://tools.ietf.org/html/rfc2945) and protocols in [Secure
Remote Password (SRP) Protocol for TLS
Authentication](http://tools.ietf.org/html/rfc5054)

SRP is an interactive protocol which allows a server to confirm that some client knows a password, and to derive a strong shared session key, without revealing what the password is to an eavesdropper. In addition, the server does not hold the actual password: instead it stores a "verifier" created by the client. If the server's private data is revealed (by a server compromise), the verifier cannot be used directly to impersonate the client.

This module provides both client and server implementations of SRP-6a for node.js. They are interoperable with [Mozilla Identity-Attached Services](https://wiki.mozilla.org/Identity/AttachedServices/KeyServerProtocol)

* [Installation](#installation)
* [Running Tests](#running-tests)
* [Usage](#how-to-use-it)
* [API Reference](#api-reference)
* [Resources](#resources)

## Installation

`npm install srp`

or `git clone` this archive and run `npm install` in it.

## Running Tests

Run `npm test`.

Tests include vectors from:
- [RFC 5054, Appendix B](https://tools.ietf.org/html/rfc5054#appendix-B).
- [Mozilla Identity Attached Services](https://wiki.mozilla.org/Identity/AttachedServices/KeyServerProtocol)

## How to use it

First, you must decide on the "parameters". This module provides a variety of pre-packaged parameter sets, at various levels of security (more secure parameters take longer to run). The "2048"-bit parameters are probably fairly secure for the near future. Both client and server must use the same parameters.

    var params = srp.params["2048"];

Each client will have a unique "identity" string. This is typically a username or email address. Clients will also use a unique "salt", which can be randomly generated during account creation. The salt is generally stored on the server, and must be provided to the client each time they try to connect.

Note that all APIs accept and return node.js Buffer objects, not strings.

### Client Setup: Account Creation

The client feeds their identity string, password, and salt, into `computeVerifier`. This returns the Verifier buffer. The Verifier must be delivered to the server, typically during a "create account" process. Note that the Verifier can be used to mount a dictionary attack against the user's password, so it should be treated with care (and delivered securely to the server).

    var verifier = srp.computeVerifier(params, salt, identity, password);
    createAccount(identity, verifier);

The server should store the identity, salt, and verifier in a table, indexed by the identity for later access. The server will provide the salt to anyone who asks, but should never reveal the verifier to anybody.

### Login

Later, when the client wants to connect to the server, it starts by submitting its identity string, and retrieving the salt.

Then the client needs to create a secret random string called `secret1`, using `srp.genKey()`. The protocol uses this to make sure that each instance of the protocol is unique.

Then, create a new `srp.Client` instance with parameters, identity, salt, password, and `secret1`.

The client must then ask this object for the derived `srpA` value, and deliver srpA to the server.

    srp.genKey(function(secret1) {
        var c = new srp.Client(params, salt, identity, password, secret1);
        var srpA = c.computeA();
        sendToServer(srpA);
    });

Meanwhile, the server is doing something similar, except using the Verifier instead of the salt/identity/password, and using its own secret random string.

    srp.genKey(function(secret2) {
        var s = new srp.Server(params, verifier, secret2);
        var srpB = s.computeB();
        sendToClient(srpB);
    });

When the client receives the server's `srpB` value, it stuffs it into the Client instance. This allows it to extract two values: `M1` and `K`.

    c.setB(srpB);
    var M1 = c.computeM1();
    sendToServer(M1);
    var K = c.computeK();

`M1` is a challenge value, created by the client and delivered to the server. After accepting the client's `A` value, the server can check `M1` to determine whether or not the client really knew the password. The server can also obtain its own `K` value.

    s.setA(srpA)
    s.checkM1(M1); // throws error if wrong
    var K = s.computeK();

If the password passed into `srp.Client()` is the same as the one passed into `srp.computeVerifier()`, then the server will accept `M1`, and the `K` on both sides will be the same.

`K` is a strong random string, suitable for use as a session key to encrypt or authenticate subsequent messages.

If the password was different, then `s.checkM1()` will throw an error, and the two `K` values will be unrelated random strings.

The overall conversation looks like this:

    Client:                             Server:
     p = params["2048"]                  p = params["2048"]
     s1 = genKey()                       s2 = genKey()
     c = new Client(p,salt,id,pw,s1)     s = new Server(p,verifier,s2)
     A = c.computeA()            A---->  s.setA(A)
     c.setB(B)                <-----B    B = s.computeB()
     M1 = c.computeM1()         M1---->  s.checkM1(M1) // may throw error
     K = c.computeK()                    K = s.computeK()

### What a "Session" Means

Basic login can be done by simply calling `s.checkM1()`: if it doesn't throw an exception, the client knew the right password. However, by itself, this does not bind knowledge of the password to anything else. If the A/B/M1 values were delivered over an insecure channel, controlled by an attacker, they could simply wait until `M1` was accepted, and then take control of the channel.

Delivering these values over a secure channel, such as an HTTPS connection, is better. If the HTTP client correctly checks the server certificate, and the certificate was correctly issued, then you can exclude a man-in-the-middle attacker.

The safest approach is to *create* a secure channel with the generated session key `K`, using it to encrypt and authenticate all the messages which follow.

## API Reference

Module contents:

- **`params[]`**
 - table of parameter sets. Pass a property from this object into the Client and Server constructors.
- **`genKey(numBytes, callback)`**
 - async function to generate the ephemeral secrets passed into the Client and Server constructors.
- **`computeVerifier(params, salt, identity, password) -> V`**
 - produces a Verifier, which should be given to the server during account creation. The Verifier will be passed into the Server constructor during login.
- **`Client(params, salt, identity, password, secret1) -> c`**
 - constructor for the client-side of SRP. secret1 should come from genKey(). The Client object has the following methods:
- **`Server(params, verifier, secret2) -> s`**
 - constructor for the server-side of SRP. secret2 should come from genKey(). If the Server object must be persisted (e.g. in a database) between protocol phases, simply store secret2 and re-construct the Server with the same values. The Server object has the following methods:

`Client` methods:

- **`computeA() -> A`**
 - produce the A value that will be sent to the server.
- **`setB(B)`**
 - this accepts the B value from the server. M1 and K cannot be accessed until setB() has been called.
- **`computeM1() -> M1`**
 - produce the M1 key-confirmation message. This should be sent to the server, which can check it to make sure the client really knew the correct password. setB must be called before computeM1.
- **`computeK() -> K`**
 - produce the shared key K. If the password and verifier matched, both client and server will get the same value for K. setB must be called before computeK.

`Server` methods:

- **`computeB() -> B`**
 - produce the B value that will be sent to the client.
- **`setA(A)`**
 - this accepts the A value from the client. checkM1 and computeK cannot be called until setA has been called.
- **`checkM1(M1)`**
 - this checks the client's M1 key-confirmation message. If the client's password matched the server's verifier, checkM1() will complete without error. If they do not match, checkM1() will throw an error.
- **`computeK() -> K`**
 - produce the shared key K. setB must be called before computeK.

## Resources

- [The Stanford SRP Homepage](http://srp.stanford.edu/)
- RFC 2945: [The SRP Authentication and Key Exchange System](http://tools.ietf.org/html/rfc2945)
- RFC 5054: [Using the Secure Remote Password (SRP) Protocol for TLS Authentication](http://tools.ietf.org/html/rfc5054)
- Wikipedia: [The Secure Remote Password protocol](http://en.wikipedia.org/wiki/Secure_Remote_Password_protocol)

## License

MIT
