'use strict';
/* chacha20 - 256 bits */

// Written in 2014 by Devi Mandiri. Public domain.
//
// Implementation derived from chacha-ref.c version 20080118
// See for details: http://cr.yp.to/chacha/chacha-20080128.pdf

var bufferShim = require('buffer-shims');

module.exports = {
    Chacha20Ctx: Chacha20Ctx,
    chacha20_keysetup: chacha20_keysetup,
    chacha20_ivsetup: chacha20_ivsetup,
    chacha20_keystream: chacha20_keystream,
    chacha20_update: chacha20_update,
    chacha20_final: chacha20_final,

    Poly1305Ctx: Poly1305Ctx,
    poly1305_init: poly1305_init,
    poly1305_update: poly1305_update,
    poly1305_finish: poly1305_finish,
    poly1305_auth: poly1305_auth,
    poly1305_verify: poly1305_verify
};

var Chacha20KeySize   = 32;
var Chacha20NonceSize =  8;

function Chacha20Ctx() {
    this.input = new Array(16);
    this.leftover = 0;
    this.buffer = bufferShim.alloc(64);
};

function load32(x, i) {
    return x[i] | (x[i+1]<<8) | (x[i+2]<<16) | (x[i+3]<<24);
}

function store32(x, i, u) {
    x[i]   = u & 0xff; u >>>= 8;
    x[i+1] = u & 0xff; u >>>= 8;
    x[i+2] = u & 0xff; u >>>= 8;
    x[i+3] = u & 0xff;
}

function plus(v, w) {
    return (v + w) >>> 0;
}

function rotl32(v, c) {
    return ((v << c) >>> 0) | (v >>> (32 - c));
}

function quarterRound(x, a, b, c, d) {
    x[a] = plus(x[a], x[b]); x[d] = rotl32(x[d] ^ x[a], 16);
    x[c] = plus(x[c], x[d]); x[b] = rotl32(x[b] ^ x[c], 12);
    x[a] = plus(x[a], x[b]); x[d] = rotl32(x[d] ^ x[a],  8);
    x[c] = plus(x[c], x[d]); x[b] = rotl32(x[b] ^ x[c],  7);
}

function chacha20_keysetup(ctx, key) {
    ctx.input[0] = 1634760805;
    ctx.input[1] =  857760878;
    ctx.input[2] = 2036477234;
    ctx.input[3] = 1797285236;
    for (var i = 0; i < 8; i++) {
        ctx.input[i+4] = load32(key, i*4);
    }
}

function chacha20_ivsetup(ctx, iv) {
    ctx.input[12] = 0;
    ctx.input[13] = 0;
    ctx.input[14] = load32(iv, 0);
    ctx.input[15] = load32(iv, 4);
}

function chacha20_encrypt(ctx, dst, src, len) {
    var x = new Array(16);
    var buf = new Array(64);
    var i = 0, dpos = 0, spos = 0;

    while (len > 0 ) {
        for (i = 16; i--;) x[i] = ctx.input[i];
        for (i = 20; i > 0; i -= 2) {
            quarterRound(x, 0, 4, 8,12);
            quarterRound(x, 1, 5, 9,13);
            quarterRound(x, 2, 6,10,14);
            quarterRound(x, 3, 7,11,15);
            quarterRound(x, 0, 5,10,15);
            quarterRound(x, 1, 6,11,12);
            quarterRound(x, 2, 7, 8,13);
            quarterRound(x, 3, 4, 9,14);
        }
        for (i = 16; i--;) x[i] += ctx.input[i];
        for (i = 16; i--;) store32(buf, 4*i, x[i]);

        ctx.input[12] = plus(ctx.input[12], 1);
        if (!ctx.input[12]) {
            ctx.input[13] = plus(ctx.input[13], 1);
        }
        if (len <= 64) {
            for (i = len; i--;) {
                dst[i+dpos] = src[i+spos] ^ buf[i];
            }
            return;
        }
        for (i = 64; i--;) {
            dst[i+dpos] = src[i+spos] ^ buf[i];
        }
        len -= 64;
        spos += 64;
        dpos += 64;
    }
}

function chacha20_decrypt(ctx, dst, src, len) {
    chacha20_encrypt(ctx, dst, src, len);
}

function chacha20_update(ctx, dst, src, inlen) {
    var bytes = 0;
    var out_start = 0;
    var out_inc = 0;

    if ((ctx.leftover + inlen) >= 64) {

        if (ctx.leftover != 0) {
            bytes = 64 - ctx.leftover;

            if (src.length > 0) {
                src.copy(ctx.buffer,ctx.leftover,0,bytes);
                src = src.slice(bytes,src.length);
            }

            chacha20_encrypt(ctx,dst,ctx.buffer,64);
            inlen -= bytes;
            dst = dst.slice(64,dst.length);
            out_inc += 64;
            ctx.leftover = 0;
        }

        bytes = (inlen & (~63));
        if (bytes > 0) {
            chacha20_encrypt(ctx, dst, src, bytes);
            inlen -= bytes;
            src = src.slice(bytes,src.length);
            dst = dst.slice(bytes,dst.length);
            out_inc += bytes;
        }

    }

    if (inlen > 0) {
        if (src.length > 0) {
            src.copy(ctx.buffer,ctx.leftover,0,src.length);
        } else {
            var zeros = bufferShim.alloc(inlen);
            zeros.copy(ctx.buffer,ctx.leftover,0,inlen);
        }
        ctx.leftover += inlen;
    }

    return out_inc - out_start;
}

function chacha20_final(ctx, dst) {
    if (ctx.leftover != 0) {
        chacha20_encrypt(ctx, dst, ctx.buffer, 64);
    }

    return ctx.leftover;
}

function chacha20_keystream(ctx, dst, len) {
    for (var i = 0; i < len; ++i) dst[i] = 0;
    chacha20_encrypt(ctx, dst, dst, len);
}

/* poly1305 */

// Written in 2014 by Devi Mandiri. Public domain.
//
// Implementation derived from poly1305-donna-16.h
// See for details: https://github.com/floodyberry/poly1305-donna

var Poly1305KeySize = 32;
var Poly1305TagSize = 16;

function Poly1305Ctx() {
    this.buffer = new Array(Poly1305TagSize);
    this.leftover = 0;
    this.r = new Array(10);
    this.h = new Array(10);
    this.pad = new Array(8);
    this.finished = 0;
};

function U8TO16(p, pos) {
    return ((p[pos] & 0xff) & 0xffff) | (((p[pos+1] & 0xff) & 0xffff) << 8);
}

function U16TO8(p, pos, v) {
    p[pos]   = (v      ) & 0xff;
    p[pos+1] = (v >>> 8) & 0xff;
}

function poly1305_init(ctx, key) {
    var t = [], i = 0;

    for (i = 8; i--;) t[i] = U8TO16(key, i*2);

    ctx.r[0] =   t[0]                         & 0x1fff;
    ctx.r[1] = ((t[0] >>> 13) | (t[1] <<  3)) & 0x1fff;
    ctx.r[2] = ((t[1] >>> 10) | (t[2] <<  6)) & 0x1f03;
    ctx.r[3] = ((t[2] >>>  7) | (t[3] <<  9)) & 0x1fff;
    ctx.r[4] = ((t[3] >>>  4) | (t[4] << 12)) & 0x00ff;
    ctx.r[5] =  (t[4] >>>  1)                 & 0x1ffe;
    ctx.r[6] = ((t[4] >>> 14) | (t[5] <<  2)) & 0x1fff;
    ctx.r[7] = ((t[5] >>> 11) | (t[6] <<  5)) & 0x1f81;
    ctx.r[8] = ((t[6] >>>  8) | (t[7] <<  8)) & 0x1fff;
    ctx.r[9] =  (t[7] >>>  5)                 & 0x007f;

    for (i = 8; i--;) {
        ctx.h[i]   = 0;
        ctx.pad[i] = U8TO16(key, 16+(2*i));
    }
    ctx.h[8] = 0;
    ctx.h[9] = 0;
    ctx.leftover = 0;
    ctx.finished = 0;
}

function poly1305_blocks(ctx, m, mpos, bytes) {
    var hibit = ctx.finished ? 0 : (1 << 11);
    var t = [], d = [], c = 0, i = 0, j = 0;

    while (bytes >= Poly1305TagSize) {
        for (i = 8; i--;) t[i] = U8TO16(m, i*2+mpos);

        ctx.h[0] +=   t[0]                         & 0x1fff;
        ctx.h[1] += ((t[0] >>> 13) | (t[1] <<  3)) & 0x1fff;
        ctx.h[2] += ((t[1] >>> 10) | (t[2] <<  6)) & 0x1fff;
        ctx.h[3] += ((t[2] >>>  7) | (t[3] <<  9)) & 0x1fff;
        ctx.h[4] += ((t[3] >>>  4) | (t[4] << 12)) & 0x1fff;
        ctx.h[5] +=  (t[4] >>>  1)                 & 0x1fff;
        ctx.h[6] += ((t[4] >>> 14) | (t[5] <<  2)) & 0x1fff;
        ctx.h[7] += ((t[5] >>> 11) | (t[6] <<  5)) & 0x1fff;
        ctx.h[8] += ((t[6] >>>  8) | (t[7] <<  8)) & 0x1fff;
        ctx.h[9] +=  (t[7] >>>  5)                 | hibit;

        for (i = 0, c = 0; i < 10; i++) {
            d[i] = c;
            for (j = 0; j < 10; j++) {
                d[i] += (ctx.h[j] & 0xffffffff) * ((j <= i) ? ctx.r[i-j] : (5 * ctx.r[i+10-j]));
                if (j === 4) {
                    c = (d[i] >>> 13);
                    d[i] &= 0x1fff;
                }
            }
            c += (d[i] >>> 13);
            d[i] &= 0x1fff;
        }
        c = ((c << 2) + c);
        c += d[0];
        d[0] = ((c & 0xffff) & 0x1fff);
        c = (c >>> 13);
        d[1] += c;

        for (i = 10; i--;) ctx.h[i] = d[i] & 0xffff;

        mpos += Poly1305TagSize;
        bytes -= Poly1305TagSize;
    }
}

function poly1305_update(ctx, m, bytes) {
    var want = 0, i = 0, mpos = 0;

    if (ctx.leftover) {
        want = (Poly1305TagSize - ctx.leftover);
        if (want > bytes)
            want = bytes;
        for (i = want; i--;) {
            ctx.buffer[ctx.leftover+i] = m[i+mpos];
        }
        bytes -= want;
        mpos += want;
        ctx.leftover += want;
        if (ctx.leftover < Poly1305TagSize)
            return;
        poly1305_blocks(ctx, ctx.buffer, 0, Poly1305TagSize);
        ctx.leftover = 0;
    }

    if (bytes >= Poly1305TagSize) {
        want = (bytes & ~(Poly1305TagSize - 1));
        poly1305_blocks(ctx, m, mpos, want);
        mpos += want;
        bytes -= want;
    }

    if (bytes) {
        for (i = bytes; i--;) {
            ctx.buffer[ctx.leftover+i] = m[i+mpos];
        }
        ctx.leftover += bytes;
    }
}

function poly1305_finish(ctx, mac) {
    var g = [], c = 0, mask = 0, f = 0, i = 0;

    if (ctx.leftover) {
        i = ctx.leftover;
        ctx.buffer[i++] = 1;
        for (; i < Poly1305TagSize; i++) {
            ctx.buffer[i] = 0;
        }
        ctx.finished = 1;
        poly1305_blocks(ctx, ctx.buffer, 0, Poly1305TagSize);
    }

    c = ctx.h[1] >>> 13;
    ctx.h[1] &= 0x1fff;
    for (i = 2; i < 10; i++) {
        ctx.h[i] += c;
        c = ctx.h[i] >>> 13;
        ctx.h[i] &= 0x1fff;
    }
    ctx.h[0] += (c * 5);
    c = ctx.h[0] >>> 13;
    ctx.h[0] &= 0x1fff;
    ctx.h[1] += c;
    c = ctx.h[1] >>> 13;
    ctx.h[1] &= 0x1fff;
    ctx.h[2] += c;

    g[0] = ctx.h[0] + 5;
    c = g[0] >>> 13;
    g[0] &= 0x1fff;
    for (i = 1; i < 10; i++) {
        g[i] = ctx.h[i] + c;
        c = g[i] >>> 13;
        g[i] &= 0x1fff;
    }
    g[9] -= (1 << 13);
    g[9] &= 0xffff;

    mask = (g[9] >>> 15) - 1;
    for (i = 10; i--;) g[i] &= mask;
    mask = ~mask;
    for (i = 10; i--;) {
        ctx.h[i] = (ctx.h[i] & mask) | g[i];
    }

    ctx.h[0] = ((ctx.h[0]      ) | (ctx.h[1] << 13)) & 0xffff;
    ctx.h[1] = ((ctx.h[1] >>  3) | (ctx.h[2] << 10)) & 0xffff;
    ctx.h[2] = ((ctx.h[2] >>  6) | (ctx.h[3] <<  7)) & 0xffff;
    ctx.h[3] = ((ctx.h[3] >>  9) | (ctx.h[4] <<  4)) & 0xffff;
    ctx.h[4] = ((ctx.h[4] >> 12) | (ctx.h[5] <<  1) | (ctx.h[6] << 14)) & 0xffff;
    ctx.h[5] = ((ctx.h[6] >>  2) | (ctx.h[7] << 11)) & 0xffff;
    ctx.h[6] = ((ctx.h[7] >>  5) | (ctx.h[8] <<  8)) & 0xffff;
    ctx.h[7] = ((ctx.h[8] >>  8) | (ctx.h[9] <<  5)) & 0xffff;

    f = (ctx.h[0] & 0xffffffff) + ctx.pad[0];
    ctx.h[0] = f & 0xffff;
    for (i = 1; i < 8; i++) {
        f = (ctx.h[i] & 0xffffffff) + ctx.pad[i] + (f >>> 16);
        ctx.h[i] = f & 0xffff;
    }

    for (i = 8; i--;) {
        U16TO8(mac, i*2, ctx.h[i]);
        ctx.pad[i] = 0;
    }
    for (i = 10; i--;) {
        ctx.h[i] = 0;
        ctx.r[i] = 0;
    }
}

function poly1305_auth(mac, m, bytes, key) {
    var ctx = new Poly1305Ctx();
    poly1305_init(ctx, key);
    poly1305_update(ctx, m, bytes);
    poly1305_finish(ctx, mac);
}

function poly1305_verify(mac1, mac2) {
    var dif = 0;
    for (var i = 0; i < 16; i++) {
        dif |= (mac1[i] ^ mac2[i]);
    }
    dif = (dif - 1) >>> 31;
    return (dif & 1);
}

/* chacha20poly1305 AEAD */

// Written in 2014 by Devi Mandiri. Public domain.

// Caveat:
// http://tools.ietf.org/html/draft-agl-tls-chacha20poly1305-04#page-9
// specified P_MAX and A_MAX are 2^64 and C_MAX is 2^64+16.
// While according to http://www.ecma-international.org/ecma-262/5.1/#sec-15.4
// I think max input length = 2^32-1 = 4294967295 = ~3.9Gb due to the ToUint32 abstract operation.
// Whatever ;)

function AeadCtx(key) {
    this.key = key;
};

function aead_init(c20ctx, key, nonce) {
    chacha20_keysetup(c20ctx, key);
    chacha20_ivsetup(c20ctx, nonce);

    var subkey = [];
    chacha20_keystream(c20ctx, subkey, 64);

    return subkey.slice(0, 32);
}

function store64(dst, pos, num) {
    var hi = 0, lo = num >>> 0;
    if ((+(Math.abs(num))) >= 1) {
        if (num > 0) {
            hi = ((Math.min((+(Math.floor(num/4294967296))), 4294967295))|0) >>> 0;
        } else {
            hi = (~~((+(Math.ceil((num - +(((~~(num)))>>>0))/4294967296))))) >>> 0;
        }
    }
    dst[pos]   = lo & 0xff; lo >>>= 8;
    dst[pos+1] = lo & 0xff; lo >>>= 8;
    dst[pos+2] = lo & 0xff; lo >>>= 8;
    dst[pos+3] = lo & 0xff;
    dst[pos+4] = hi & 0xff; hi >>>= 8;
    dst[pos+5] = hi & 0xff; hi >>>= 8;
    dst[pos+6] = hi & 0xff; hi >>>= 8;
    dst[pos+7] = hi & 0xff;
}

function aead_mac(key, ciphertext, data) {
    var clen = ciphertext.length;
    var dlen = data.length;
    var m = new Array(clen + dlen + 16);
    var i = dlen;

    for (; i--;) m[i] = data[i];
    store64(m, dlen, dlen);

    for (i = clen; i--;) m[dlen+8+i] = ciphertext[i];
    store64(m, clen+dlen+8, clen);

    var mac = [];
    poly1305_auth(mac, m, m.length, key);

    return mac;
}

function aead_encrypt(ctx, nonce, input, ad) {
    var c = new Chacha20Ctx();
    var key = aead_init(c, ctx.key, nonce);

    var ciphertext = [];
    chacha20_encrypt(c, ciphertext, input, input.length);

    var mac = aead_mac(key, ciphertext, ad);

    var out = [];
    out = out.concat(ciphertext, mac);

    return out;
}

function aead_decrypt(ctx, nonce, ciphertext, ad) {
    var c = new Chacha20Ctx();
    var key = aead_init(c, ctx.key, nonce);
    var clen = ciphertext.length - Poly1305TagSize;
    var digest = ciphertext.slice(clen);
    var mac = aead_mac(key, ciphertext.slice(0, clen), ad);

    if (poly1305_verify(digest, mac) !== 1) return false;

    var out = [];
    chacha20_decrypt(c, out, ciphertext, clen);
    return out;
}
