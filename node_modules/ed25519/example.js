var crypto = require('crypto');
var ed25519 = require('./');

/*
	First lets make some keypairs.
*/

// Alice likes to be random, and remembers that the MakeKeypair function takes a 32 byte buffer
var aliceSeed = crypto.randomBytes(32);
var aliceKeypair = ed25519.MakeKeypair(aliceSeed);

// Bob thinks the nsa has their fingers in the random number generator so decides to use a password.
// Charlie told Bob that sha256 rocks. So he decides to use the MakeKeypair but uses a hash instead of just random bytes
var bobsPassword = 'I like the cute monkeys!';
var hash = crypto.createHash('sha256').update(bobsPassword).digest(); //returns a buffer
var bobKeypair = ed25519.MakeKeypair(hash);


/*
	Now some messages
*/
var message = 'Hi Bob, How are your pet monkeys doing? What were their names again? -Alice';
var signature = ed25519.Sign(new Buffer(message, 'utf8'), aliceKeypair); //Using Sign(Buffer, Keypair object)
// or
var signature2 = ed25519.Sign(new Buffer(message, 'utf8'), aliceKeypair.privateKey); //Using Sign(Buffer, Keypair object)
// or
var signature3 = ed25519.Sign(new Buffer(message, 'utf8'), aliceSeed); //Using Sign(Buffer, Buffer)

// Alice sends her message and signature over to bob.

// Bob being a paranoid fellow and a good friend of alice has her public key and checks the signature.
if (ed25519.Verify(new Buffer(message, 'utf8'), signature, aliceKeypair.publicKey)) {
	// Bob trusts the message because the Verify function returned true.
	console.log('Signature valid');
} else {
	// Bob doesn't trust the message becuase the Verify function returned false.
	console.log('Signature NOT valid');
}
// check the other signatures
if (ed25519.Verify(new Buffer(message, 'utf8'), signature2, aliceKeypair.publicKey)) {
	console.log('Signature2 valid');
} else {
	console.log('Signature2 NOT valid');
}
if (ed25519.Verify(new Buffer(message, 'utf8'), signature3, aliceKeypair.publicKey)) {
	console.log('Signature3 valid');
} else {
	console.log('Signature3 NOT valid');
}

// Alice is a very courious gal and notices that there is also a key_exchange.c in the public domain code
// that Dave used from https://github.com/nightcracker/ed25519 and wonders if Dave will add a key exchange
// function to this module.

// Dave replys "Maybe, someday. But for now I just needed an implementation of ED25519 to use for a test
// site I'm working on for testing out SQRL(https://www.grc.com/sqrl/sqrl.htm)."

