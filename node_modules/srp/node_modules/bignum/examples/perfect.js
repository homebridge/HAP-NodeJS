// If 2**n-1 is prime, then (2**n-1) * 2**(n-1) is perfect.
var bignum = require('../');

for (var n = 0; n < 100; n++) {
    var p = bignum.pow(2, n).sub(1);
    if (p.probPrime(50)) {
        var perfect = p.mul(bignum.pow(2, n - 1));
        console.log(perfect.toString());
    }
}
