var nacl = require("./lib/nacl_factory.js").instantiate();

function examine_string(x) {
    for (var i = 0; i < x.length; i++) {
	console.log(i + " = " + x.charCodeAt(i));
    }

    console.log(x);
    console.log(nacl.encode_utf8(x));
    console.log(nacl.to_hex(nacl.encode_utf8(x)));
}

examine_string("dsf;ijef щлоауцжадо 日本語");
// python: 6473663b696a656620d189d0bbd0bed0b0d183d186d0b6d0b0d0b4d0be20e697a5e69cace8aa9e
// node:   6473663b696a656620d189d0bbd0bed0b0d183d186d0b6d0b0d0b4d0be20e697a5e69cace8aa9e

examine_string("𝄞");
// python: f09d849e
// node:   f09d849e
