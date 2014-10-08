/* Copyright 2008, Google Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * curve25519-donna: Curve25519 elliptic curve, public key function
 *
 * http://code.google.com/p/curve25519-donna/
 *
 * Adam Langley <agl@imperialviolet.org>
 *
 * Derived from public domain C code by Daniel J. Bernstein <djb@cr.yp.to>
 *
 * More information about curve25519 can be found here
 *   http://cr.yp.to/ecdh.html
 *
 * djb's sample implementation of curve25519 is written in a special assembly
 * language called qhasm and uses the floating point registers.
 *
 * This is, almost, a clean room reimplementation from the curve25519 paper. It
 * uses many of the tricks described therein. Only the crecip function is taken
 * from the sample implementation.
 */

#include <string.h>
#include <stdint.h>

typedef uint8_t u8;
typedef int64_t felem;

/* Sum two numbers: output += in */
static void fsum(felem *output, const felem *in) {
  unsigned i;
  for (i = 0; i < 10; i += 2) {
    output[0+i] = (output[0+i] + in[0+i]);
    output[1+i] = (output[1+i] + in[1+i]);
  }
}

/* Find the difference of two numbers: output = in - output
 * (note the order of the arguments!)
 */
static void fdifference(felem *output, const felem *in) {
  unsigned i;
  for (i = 0; i < 10; ++i) {
    output[i] = (in[i] - output[i]);
  }
}

/* Multiply a number my a scalar: output = in * scalar */
static void fscalar_product(felem *output, const felem *in, const felem scalar) {
  unsigned i;
  for (i = 0; i < 10; ++i) {
    output[i] = in[i] * scalar;
  }
}

/* Multiply two numbers: output = in2 * in
 *
 * output must be distinct to both inputs. The inputs are reduced coefficient
 * form, the output is not.
 */
static void fproduct(felem *output, const felem *in2, const felem *in) {
  output[0] =      in2[0] * in[0];
  output[1] =      in2[0] * in[1] +
                   in2[1] * in[0];
  output[2] =  2 * in2[1] * in[1] +
                   in2[0] * in[2] +
                   in2[2] * in[0];
  output[3] =      in2[1] * in[2] +
                   in2[2] * in[1] +
                   in2[0] * in[3] +
                   in2[3] * in[0];
  output[4] =      in2[2] * in[2] +
               2 * (in2[1] * in[3] +
                    in2[3] * in[1]) +
                   in2[0] * in[4] +
                   in2[4] * in[0];
  output[5] =      in2[2] * in[3] +
                   in2[3] * in[2] +
                   in2[1] * in[4] +
                   in2[4] * in[1] +
                   in2[0] * in[5] +
                   in2[5] * in[0];
  output[6] =  2 * (in2[3] * in[3] +
                    in2[1] * in[5] +
                    in2[5] * in[1]) +
                   in2[2] * in[4] +
                   in2[4] * in[2] +
                   in2[0] * in[6] +
                   in2[6] * in[0];
  output[7] =      in2[3] * in[4] +
                   in2[4] * in[3] +
                   in2[2] * in[5] +
                   in2[5] * in[2] +
                   in2[1] * in[6] +
                   in2[6] * in[1] +
                   in2[0] * in[7] +
                   in2[7] * in[0];
  output[8] =      in2[4] * in[4] +
               2 * (in2[3] * in[5] +
                    in2[5] * in[3] +
                    in2[1] * in[7] +
                    in2[7] * in[1]) +
                   in2[2] * in[6] +
                   in2[6] * in[2] +
                   in2[0] * in[8] +
                   in2[8] * in[0];
  output[9] =      in2[4] * in[5] +
                   in2[5] * in[4] +
                   in2[3] * in[6] +
                   in2[6] * in[3] +
                   in2[2] * in[7] +
                   in2[7] * in[2] +
                   in2[1] * in[8] +
                   in2[8] * in[1] +
                   in2[0] * in[9] +
                   in2[9] * in[0];
  output[10] = 2 * (in2[5] * in[5] +
                    in2[3] * in[7] +
                    in2[7] * in[3] +
                    in2[1] * in[9] +
                    in2[9] * in[1]) +
                   in2[4] * in[6] +
                   in2[6] * in[4] +
                   in2[2] * in[8] +
                   in2[8] * in[2];
  output[11] =     in2[5] * in[6] +
                   in2[6] * in[5] +
                   in2[4] * in[7] +
                   in2[7] * in[4] +
                   in2[3] * in[8] +
                   in2[8] * in[3] +
                   in2[2] * in[9] +
                   in2[9] * in[2];
  output[12] =     in2[6] * in[6] +
               2 * (in2[5] * in[7] +
                    in2[7] * in[5] +
                    in2[3] * in[9] +
                    in2[9] * in[3]) +
                   in2[4] * in[8] +
                   in2[8] * in[4];
  output[13] =     in2[6] * in[7] +
                   in2[7] * in[6] +
                   in2[5] * in[8] +
                   in2[8] * in[5] +
                   in2[4] * in[9] +
                   in2[9] * in[4];
  output[14] = 2 * (in2[7] * in[7] +
                    in2[5] * in[9] +
                    in2[9] * in[5]) +
                   in2[6] * in[8] +
                   in2[8] * in[6];
  output[15] =     in2[7] * in[8] +
                   in2[8] * in[7] +
                   in2[6] * in[9] +
                   in2[9] * in[6];
  output[16] =     in2[8] * in[8] +
               2 * (in2[7] * in[9] +
                    in2[9] * in[7]);
  output[17] =     in2[8] * in[9] +
                   in2[9] * in[8];
  output[18] = 2 * in2[9] * in[9];
}

/* Reduce a long form to a short form by taking the input mod 2^255 - 19. */
static void freduce_degree(felem *output) {
  output[8] += 19 * output[18];
  output[7] += 19 * output[17];
  output[6] += 19 * output[16];
  output[5] += 19 * output[15];
  output[4] += 19 * output[14];
  output[3] += 19 * output[13];
  output[2] += 19 * output[12];
  output[1] += 19 * output[11];
  output[0] += 19 * output[10];
}

/* Reduce all coefficients of the short form input to be -2**25 <= x <= 2**25
 */
static void freduce_coefficients(felem *output) {
  unsigned i;
  do {
    output[10] = 0;

    for (i = 0; i < 10; i += 2) {
      felem over = output[i] / 0x2000000l;
      const felem over2 = (over + ((over >> 63) * 2) + 1) / 2;
      output[i+1] += over2;
      output[i] -= over2 * 0x4000000l;

      over = output[i+1] / 0x2000000;
      output[i+2] += over;
      output[i+1] -= over * 0x2000000;
    }
    output[0] += 19 * output[10];
  } while (output[10]);
}

/* A helpful wrapper around fproduct: output = in * in2.
 *
 * output must be distinct to both inputs. The output is reduced degree and
 * reduced coefficient.
 */
static void
fmul(felem *output, const felem *in, const felem *in2) {
  felem t[19];
  fproduct(t, in, in2);
  freduce_degree(t);
  freduce_coefficients(t);
  memcpy(output, t, sizeof(felem) * 10);
}

static void fsquare_inner(felem *output, const felem *in) {
  output[0] =      in[0] * in[0];
  output[1] =  2 * in[0] * in[1];
  output[2] =  2 * (in[1] * in[1] +
                    in[0] * in[2]);
  output[3] =  2 * (in[1] * in[2] +
                    in[0] * in[3]);
  output[4] =      in[2] * in[2] +
               4 * in[1] * in[3] +
               2 * in[0] * in[4];
  output[5] =  2 * (in[2] * in[3] +
                    in[1] * in[4] +
                    in[0] * in[5]);
  output[6] =  2 * (in[3] * in[3] +
                    in[2] * in[4] +
                    in[0] * in[6] +
                2 * in[1] * in[5]);
  output[7] =  2 * (in[3] * in[4] +
                    in[2] * in[5] +
                    in[1] * in[6] +
                    in[0] * in[7]);
  output[8] =      in[4] * in[4] +
               2 * (in[2] * in[6] +
                    in[0] * in[8] +
                2 * (in[1] * in[7] +
                     in[3] * in[5]));
  output[9] =  2 * (in[4] * in[5] +
                    in[3] * in[6] +
                    in[2] * in[7] +
                    in[1] * in[8] +
                    in[0] * in[9]);
  output[10] = 2 * (in[5] * in[5] +
                   in[4] * in[6] +
                   in[2] * in[8] +
                2 * (in[3] * in[7] +
                     in[1] * in[9]));
  output[11] = 2 * (in[5] * in[6] +
                    in[4] * in[7] +
                    in[3] * in[8] +
                    in[2] * in[9]);
  output[12] =     in[6] * in[6] +
               2 * (in[4] * in[8] +
                2 * (in[5] * in[7] +
                     in[3] * in[9]));
  output[13] = 2 * (in[6] * in[7] +
                    in[5] * in[8] +
                    in[4] * in[9]);
  output[14] = 2 * (in[7] * in[7] +
                    in[6] * in[8] +
                2 * in[5] * in[9]);
  output[15] = 2 * (in[7] * in[8] +
                    in[6] * in[9]);
  output[16] =     in[8] * in[8] +
               4 * in[7] * in[9];
  output[17] = 2 * in[8] * in[9];
  output[18] = 2 * in[9] * in[9];
}

static void
fsquare(felem *output, const felem *in) {
  felem t[19];
  fsquare_inner(t, in);
  freduce_degree(t);
  freduce_coefficients(t);
  memcpy(output, t, sizeof(felem) * 10);
}

/* Take a little-endian, 32-byte number and expand it into polynomial form */
static void
fexpand(felem *output, const u8 *input) {
#define F(n,start,shift,mask) \
  output[n] = ((((felem) input[start + 0]) | \
                ((felem) input[start + 1]) << 8 | \
                ((felem) input[start + 2]) << 16 | \
                ((felem) input[start + 3]) << 24) >> shift) & mask;
  F(0, 0, 0, 0x3ffffff);
  F(1, 3, 2, 0x1ffffff);
  F(2, 6, 3, 0x3ffffff);
  F(3, 9, 5, 0x1ffffff);
  F(4, 12, 6, 0x3ffffff);
  F(5, 16, 0, 0x1ffffff);
  F(6, 19, 1, 0x3ffffff);
  F(7, 22, 3, 0x1ffffff);
  F(8, 25, 4, 0x3ffffff);
  F(9, 28, 6, 0x1ffffff);
#undef F
}

/* Take a fully reduced polynomial form number and contract it into a
 * little-endian, 32-byte array
 */
static void
fcontract(u8 *output, felem *input) {
  int i;

  do {
    for (i = 0; i < 9; ++i) {
      if ((i & 1) == 1) {
        while (input[i] < 0) {
          input[i] += 0x2000000;
          input[i + 1]--;
        }
      } else {
        while (input[i] < 0) {
          input[i] += 0x4000000;
          input[i + 1]--;
        }
      }
    }
    while (input[9] < 0) {
      input[9] += 0x2000000;
      input[0] -= 19;
    }
  } while (input[0] < 0);

  input[1] <<= 2;
  input[2] <<= 3;
  input[3] <<= 5;
  input[4] <<= 6;
  input[6] <<= 1;
  input[7] <<= 3;
  input[8] <<= 4;
  input[9] <<= 6;
#define F(i, s) \
  output[s+0] |=  input[i] & 0xff; \
  output[s+1]  = (input[i] >> 8) & 0xff; \
  output[s+2]  = (input[i] >> 16) & 0xff; \
  output[s+3]  = (input[i] >> 24) & 0xff;
  output[0] = 0;
  output[16] = 0;
  F(0,0);
  F(1,3);
  F(2,6);
  F(3,9);
  F(4,12);
  F(5,16);
  F(6,19);
  F(7,22);
  F(8,25);
  F(9,28);
#undef F
}

/* Input: Q, Q', Q-Q'
 * Output: 2Q, Q+Q'
 *
 *   x2 z3: long form
 *   x3 z3: long form
 *   x z: short form, destroyed
 *   xprime zprime: short form, destroyed
 *   qmqp: short form, preserved
 */
static void fmonty(felem *x2, felem *z2,  /* output 2Q */
                   felem *x3, felem *z3,  /* output Q + Q' */
                   felem *x, felem *z,    /* input Q */
                   felem *xprime, felem *zprime,  /* input Q' */
                   const felem *qmqp /* input Q - Q' */) {
  felem origx[10], origxprime[10], zzz[19], xx[19], zz[19], xxprime[19],
        zzprime[19], zzzprime[19], xxxprime[19];

  memcpy(origx, x, 10 * sizeof(felem));
  fsum(x, z);
  fdifference(z, origx);  // does x - z

  memcpy(origxprime, xprime, sizeof(felem) * 10);
  fsum(xprime, zprime);
  fdifference(zprime, origxprime);
  fproduct(xxprime, xprime, z);
  fproduct(zzprime, x, zprime);
  freduce_degree(xxprime);
  freduce_coefficients(xxprime);
  freduce_degree(zzprime);
  freduce_coefficients(zzprime);
  memcpy(origxprime, xxprime, sizeof(felem) * 10);
  fsum(xxprime, zzprime);
  fdifference(zzprime, origxprime);
  fsquare(xxxprime, xxprime);
  fsquare(zzzprime, zzprime);
  fproduct(zzprime, zzzprime, qmqp);
  freduce_degree(zzprime);
  freduce_coefficients(zzprime);
  memcpy(x3, xxxprime, sizeof(felem) * 10);
  memcpy(z3, zzprime, sizeof(felem) * 10);

  fsquare(xx, x);
  fsquare(zz, z);
  fproduct(x2, xx, zz);
  freduce_degree(x2);
  freduce_coefficients(x2);
  fdifference(zz, xx);  // does zz = xx - zz
  memset(zzz + 10, 0, sizeof(felem) * 9);
  fscalar_product(zzz, zz, 121665);
  freduce_degree(zzz);
  freduce_coefficients(zzz);
  fsum(zzz, xx);
  fproduct(z2, zz, zzz);
  freduce_degree(z2);
  freduce_coefficients(z2);
}

/* Calculates nQ where Q is the x-coordinate of a point on the curve
 *
 *   resultx/resultz: the x coordinate of the resulting curve point (short form)
 *   n: a little endian, 32-byte number
 *   q: a point of the curve (short form)
 */
static void
cmult(felem *resultx, felem *resultz, const u8 *n, const felem *q) {
  felem a[19] = {0}, b[19] = {1}, c[19] = {1}, d[19] = {0};
  felem *nqpqx = a, *nqpqz = b, *nqx = c, *nqz = d, *t;
  felem e[19] = {0}, f[19] = {1}, g[19] = {0}, h[19] = {1};
  felem *nqpqx2 = e, *nqpqz2 = f, *nqx2 = g, *nqz2 = h;

  unsigned i, j;

  memcpy(nqpqx, q, sizeof(felem) * 10);

  for (i = 0; i < 32; ++i) {
    u8 byte = n[31 - i];
    for (j = 0; j < 8; ++j) {
      if (byte & 0x80) {
        fmonty(nqpqx2, nqpqz2,
               nqx2, nqz2,
               nqpqx, nqpqz,
               nqx, nqz,
               q);
      } else {
        fmonty(nqx2, nqz2,
               nqpqx2, nqpqz2,
               nqx, nqz,
               nqpqx, nqpqz,
               q);
      }

      t = nqx;
      nqx = nqx2;
      nqx2 = t;
      t = nqz;
      nqz = nqz2;
      nqz2 = t;
      t = nqpqx;
      nqpqx = nqpqx2;
      nqpqx2 = t;
      t = nqpqz;
      nqpqz = nqpqz2;
      nqpqz2 = t;

      byte <<= 1;
    }
  }

  memcpy(resultx, nqx, sizeof(felem) * 10);
  memcpy(resultz, nqz, sizeof(felem) * 10);
}

// -----------------------------------------------------------------------------
// Shamelessly copied from djb's code
// -----------------------------------------------------------------------------
static void
crecip(felem *out, const felem *z) {
  felem z2[10];
  felem z9[10];
  felem z11[10];
  felem z2_5_0[10];
  felem z2_10_0[10];
  felem z2_20_0[10];
  felem z2_50_0[10];
  felem z2_100_0[10];
  felem t0[10];
  felem t1[10];
  int i;

  /* 2 */ fsquare(z2,z);
  /* 4 */ fsquare(t1,z2);
  /* 8 */ fsquare(t0,t1);
  /* 9 */ fmul(z9,t0,z);
  /* 11 */ fmul(z11,z9,z2);
  /* 22 */ fsquare(t0,z11);
  /* 2^5 - 2^0 = 31 */ fmul(z2_5_0,t0,z9);

  /* 2^6 - 2^1 */ fsquare(t0,z2_5_0);
  /* 2^7 - 2^2 */ fsquare(t1,t0);
  /* 2^8 - 2^3 */ fsquare(t0,t1);
  /* 2^9 - 2^4 */ fsquare(t1,t0);
  /* 2^10 - 2^5 */ fsquare(t0,t1);
  /* 2^10 - 2^0 */ fmul(z2_10_0,t0,z2_5_0);

  /* 2^11 - 2^1 */ fsquare(t0,z2_10_0);
  /* 2^12 - 2^2 */ fsquare(t1,t0);
  /* 2^20 - 2^10 */ for (i = 2;i < 10;i += 2) { fsquare(t0,t1); fsquare(t1,t0); }
  /* 2^20 - 2^0 */ fmul(z2_20_0,t1,z2_10_0);

  /* 2^21 - 2^1 */ fsquare(t0,z2_20_0);
  /* 2^22 - 2^2 */ fsquare(t1,t0);
  /* 2^40 - 2^20 */ for (i = 2;i < 20;i += 2) { fsquare(t0,t1); fsquare(t1,t0); }
  /* 2^40 - 2^0 */ fmul(t0,t1,z2_20_0);

  /* 2^41 - 2^1 */ fsquare(t1,t0);
  /* 2^42 - 2^2 */ fsquare(t0,t1);
  /* 2^50 - 2^10 */ for (i = 2;i < 10;i += 2) { fsquare(t1,t0); fsquare(t0,t1); }
  /* 2^50 - 2^0 */ fmul(z2_50_0,t0,z2_10_0);

  /* 2^51 - 2^1 */ fsquare(t0,z2_50_0);
  /* 2^52 - 2^2 */ fsquare(t1,t0);
  /* 2^100 - 2^50 */ for (i = 2;i < 50;i += 2) { fsquare(t0,t1); fsquare(t1,t0); }
  /* 2^100 - 2^0 */ fmul(z2_100_0,t1,z2_50_0);

  /* 2^101 - 2^1 */ fsquare(t1,z2_100_0);
  /* 2^102 - 2^2 */ fsquare(t0,t1);
  /* 2^200 - 2^100 */ for (i = 2;i < 100;i += 2) { fsquare(t1,t0); fsquare(t0,t1); }
  /* 2^200 - 2^0 */ fmul(t1,t0,z2_100_0);

  /* 2^201 - 2^1 */ fsquare(t0,t1);
  /* 2^202 - 2^2 */ fsquare(t1,t0);
  /* 2^250 - 2^50 */ for (i = 2;i < 50;i += 2) { fsquare(t0,t1); fsquare(t1,t0); }
  /* 2^250 - 2^0 */ fmul(t0,t1,z2_50_0);

  /* 2^251 - 2^1 */ fsquare(t1,t0);
  /* 2^252 - 2^2 */ fsquare(t0,t1);
  /* 2^253 - 2^3 */ fsquare(t1,t0);
  /* 2^254 - 2^4 */ fsquare(t0,t1);
  /* 2^255 - 2^5 */ fsquare(t1,t0);
  /* 2^255 - 21 */ fmul(out,t1,z11);
}

void
curve25519_donna(u8 *mypublic, const u8 *secret, const u8 *basepoint) {
  felem bp[10], x[10], z[10], zmone[10];
  fexpand(bp, basepoint);
  cmult(x, z, secret, bp);
  crecip(zmone, z);
  fmul(z, x, zmone);
  fcontract(mypublic, z);
}
