// Generate two primes p and q to the Digital Signature Standard (DSS)
// http://www.itl.nist.gov/fipspubs/fip186.htm appendix 2.2

var bignum = require('../');
var assert = require('assert');

var q = bignum(2).pow(159).add(1).rand(bignum(2).pow(160)).nextPrime();
var L = 512 + 64 * Math.floor(Math.random() * 8);

do {
    var X = bignum(2).pow(L-1).add(1).rand(bignum(2).pow(L));
    var c = X.mod(q.mul(2));
    var p = X.sub(c.sub(1)); // p is congruent to 1 % 2q somehow!
} while (p.lt(bignum.pow(2, L - 1)) || p.probPrime(50) === false)

assert.ok(q.gt(bignum.pow(2,159)), 'q > 2**159');
assert.ok(q.lt(bignum.pow(2,160)), 'q < 2**160');
assert.ok(p.gt(bignum.pow(2,L-1)), 'p > 2**(L-1)');
assert.ok(q.lt(bignum.pow(2,L)), 'p < 2**L');
assert.ok(q.mul(p.sub(1).div(q)).add(1).eq(p), 'q divides p - 1');

assert.ok(p.probPrime(50), 'p is not prime!');
assert.ok(q.probPrime(50), 'q is not prime!');

console.dir({ p : p, q : q });
