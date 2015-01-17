#include "ed25519.h"
#include <openssl/sha.h>
#include "crypto_verify_32.h"
#include "ge.h"
#include "sc.h"

int crypto_sign_open(
  unsigned char *m,unsigned long long *mlen,
  const unsigned char *sm,unsigned long long smlen,
  const unsigned char *pk
)
{
  unsigned char h[64];
  unsigned char checkr[32];
  ge_p3 A;
  ge_p2 R;
  unsigned long long i;

  *mlen = -1;
  if (smlen < 64) return -1;
  if (sm[63] & 224) return -2;
  if (ge_frombytes_negate_vartime(&A,pk) != 0) return -3;

  for (i = 0;i < smlen;++i) m[i] = sm[i];
  for (i = 0;i < 32;++i) m[32 + i] = pk[i];
  SHA512(m, smlen, h);
  sc_reduce(h);

  ge_double_scalarmult_vartime(&R,h,&A,sm + 32);
  ge_tobytes(checkr,&R);
  if (crypto_verify_32(checkr,sm) != 0) {
    for (i = 0;i < smlen;++i) m[i] = 0;
    return crypto_verify_32(checkr,sm);
  }

  for (i = 0;i < smlen - 64;++i) m[i] = sm[64 + i];
  for (i = smlen - 64;i < smlen;++i) m[i] = 0;
  *mlen = smlen - 64;
  return 0;
}

int crypto_sign_verify(const unsigned char *signature, const unsigned char *message, size_t message_len, const unsigned char *public_key) {
    unsigned char h[64];
    unsigned char checker[32];
    SHA512_CTX hash;
    ge_p3 A;
    ge_p2 R;

    if (signature[63] & 224) {
        return -1;
    }

    if (ge_frombytes_negate_vartime(&A, public_key) != 0) {
        return -2;
    }

    SHA512_Init(&hash);
    SHA512_Update(&hash, signature, 32);
    SHA512_Update(&hash, public_key, 32);
    SHA512_Update(&hash, message, message_len);
    SHA512_Final(h, &hash);

    sc_reduce(h);
    ge_double_scalarmult_vartime(&R, h, &A, signature + 32);
    ge_tobytes(checker, &R);

    if (!(crypto_verify_32(checker, signature) == 0)) {
        return -3;
    }

    return 0;
}
