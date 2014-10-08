    var randomBytes;
    if (typeof module !== 'undefined' && module.exports) {
	// add node.js implementations
	var crypto = require('crypto');
	randomBytes = crypto.randomBytes;
    } else if (window && window.crypto && window.crypto.getRandomValues) {
	// add in-browser implementation
	randomBytes = function (count) {
	    var bs = new Uint8Array(count);
	    window.crypto.getRandomValues(bs);
	    return bs;
	};
    } else {
	randomBytes = function (count) {
	    throw { name: "No cryptographic random number generator",
		    message: "Your browser does not support cryptographic random number generation." };
	};
    }

    nacl_raw.RandomBytes.crypto = { "randomBytes": randomBytes };
    nacl.random_bytes = randomBytes;
    nacl.nacl_raw = nacl_raw;
    return nacl;
   })((typeof window !== 'undefined') ? window : null, (typeof document !== 'undefined') ? document : null);
  }
};

// export common.js module to allow one js file for browser and node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = nacl_factory;
}
