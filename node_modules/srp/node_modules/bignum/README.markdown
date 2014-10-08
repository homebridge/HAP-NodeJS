bignum
======

Arbitrary precision integral arithmetic for Node.js using
OpenSSL.

This library is based on
[node-bigint](https://github.com/substack/node-bigint) by
[substack](https://github.com/substack), but instead of using libgmp,
it uses the builtin bignum functionality provided by OpenSSL. The
advantage is that OpenSSL is already part of Node.js, so this
library does not add any external dependency whatsoever.

differences
===========

When switching from node-bigint to node-bignum, please be aware of
these differences:

- Bignum rounds towards zero for integer divisions, e.g. `10 / -3 = -3`, whereas bigint
  rounds towards negative infinity, e.g. `10 / -3 = -4`.
- Bitwise operations (and, or, xor) are implemented for positive numbers only.
- nextPrime() is not supported.
- sqrt() and root() are not supported.

(Patches for the missing functionality are welcome.)

example
=======

simple.js
---------

    var bignum = require('bignum');

    var b = bignum('782910138827292261791972728324982')
        .sub('182373273283402171237474774728373')
        .div(8)
    ;
    console.log(b);

***
    $ node simple.js
    <Bignum 75067108192986261319312244199576>

perfect.js
----------

Generate the perfect numbers:

    // If 2**n-1 is prime, then (2**n-1) * 2**(n-1) is perfect.
    var bignum = require('bignum');

    for (var n = 0; n < 100; n++) {
        var p = bignum.pow(2, n).sub(1);
        if (p.probPrime(50)) {
            var perfect = p.mul(bignum.pow(2, n - 1));
            console.log(perfect.toString());
        }
    }

***

    6
    28
    496
    8128
    33550336
    8589869056
    137438691328
    2305843008139952128
    2658455991569831744654692615953842176
    191561942608236107294793378084303638130997321548169216

methods[0]
==========

bignum(n, base=10)
------------------

Create a new `bignum` from `n` and a base. `n` can be a string, integer, or
another `bignum`.

If you pass in a string you can set the base that string is encoded in.

.toString(base=10)
------------------

Print out the `bignum` instance in the requested base as a string.

bignum.fromBuffer(buf, opts)
----------------------------

Create a new `bignum` from a `Buffer`.

The default options are:

    {
        endian : 'big',
        size : 1, // number of bytes in each word
    }

Note that endian doesn't matter when size = 1. If you wish to reverse the entire buffer byte by byte, pass size: 'auto'.

bignum.prime(bits, safe=true)
-----------------------------

Generate a probable prime of length `bits`. If `safe` is true, it will be a "safe" prime of the form p=2p'+1 where p' is also prime.

methods[1]
==========

For all of the instance methods below you can write either

    bignum.method(x, y, z)

or if x is a `bignum` instance``

    x.method(y, z)

.toNumber()
-----------

Turn a `bignum` into a `Number`. If the `bignum` is too big you'll lose
precision or you'll get ±`Infinity`.

.toBuffer(opts)
-------------

Return a new `Buffer` with the data from the `bignum`.

The default options are:

    {
        endian : 'big',
        size : 1, // number of bytes in each word
    }

Note that endian doesn't matter when size = 1. If you wish to reverse the entire buffer byte by byte, pass size: 'auto'.

.add(n)
-------

Return a new `bignum` containing the instance value plus `n`.

.sub(n)
-------

Return a new `bignum` containing the instance value minus `n`.

.mul(n)
-------

Return a new `bignum` containing the instance value multiplied by `n`.

.div(n)
-------

Return a new `bignum` containing the instance value integrally divided by `n`.

.abs()
------

Return a new `bignum` with the absolute value of the instance.

.neg()
------

Return a new `bignum` with the negative of the instance value.

.cmp(n)
-------

Compare the instance value to `n`. Return a positive integer if `> n`, a
negative integer if `< n`, and 0 if `== n`.

.gt(n)
------

Return a boolean: whether the instance value is greater than n (`> n`).

.ge(n)
------

Return a boolean: whether the instance value is greater than or equal to n
(`>= n`).

.eq(n)
------

Return a boolean: whether the instance value is equal to n (`== n`).

.lt(n)
------

Return a boolean: whether the instance value is less than n (`< n`).

.le(n)
------

Return a boolean: whether the instance value is less than or equal to n
(`<= n`).

.and(n)
-------

Return a new `bignum` with the instance value bitwise AND (&)-ed with `n`.

.or(n)
------

Return a new `bignum` with the instance value bitwise inclusive-OR (|)-ed with
`n`.

.xor(n)
-------

Return a new `bignum` with the instance value bitwise exclusive-OR (^)-ed with
`n`.

.mod(n)
-------

Return a new `bignum` with the instance value modulo `n`.

`m`.
.pow(n)
-------

Return a new `bignum` with the instance value raised to the `n`th power.

.powm(n, m)
-----------

Return a new `bignum` with the instance value raised to the `n`th power modulo
`m`.

.invertm(m)
-----------

Compute the multiplicative inverse modulo `m`.

.rand()
-------
.rand(upperBound)
-----------------

If `upperBound` is supplied, return a random `bignum` between the instance value
and `upperBound - 1`, inclusive.

Otherwise, return a random `bignum` between 0 and the instance value - 1,
inclusive.

.probPrime()
------------

Return whether the bignum is:

* certainly prime (true)
* probably prime ('maybe')
* certainly composite (false)

using [BN_is_prime_ex](http://www.openssl.org/docs/crypto/BN_generate_prime.html).

.sqrt()
-------

Return a new `bignum` that is the square root. This truncates.

.root(n)
-------

Return a new `bignum` that is the `nth` root. This truncates.

.shiftLeft(n)
-------------

Return a new `bignum` that is the `2^n` multiple. Equivalent of the `<<`
operator.

.shiftRight(n)
--------------

Return a new `bignum` of the value integer divided by
`2^n`. Equivalent of the `>>` operator.

.gcd(n)
-------

Return the greatest common divisor of the current `bignum` with `n` as a new
`bignum`.

.jacobi(n)
-------

Return the Jacobi symbol (or Legendre symbol if `n` is prime) of the current
`bignum` (= a) over `n`. Note that `n` must be odd and >= 3. 0 <= a < n.

Returns -1 or 1 as an int (NOT a bignum). Throws an error on failure.

.bitLength()
------------

Return the number of bits used to represent the current `bignum`.

install
=======

To compile the package, your system needs to be set up for building Node.js
modules.

You can install node-bignum with [npm](http://npmjs.org):

    npm install bignum

develop
=======

You can clone the git repo and compile with

    git clone git://github.com/justmoon/node-bignum.git
    cd node-bignum
    npm install

Run the tests with

    npm test
