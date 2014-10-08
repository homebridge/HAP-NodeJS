/* Derivation of Ed25519 keypairs from seeds. Compatible with libsodium. */

#include "crypto_hash_sha512.h"
#include "subnacl/sign_ed25519/fe25519.h"
#include "subnacl/sign_ed25519/ge25519.h"
#include "subnacl/sign_ed25519/sc25519.h"

int crypto_sign_keypair_from_raw_sk(unsigned char *pk,
				    unsigned char *sk,
				    unsigned char const *seed)
{
  sc25519 scsk;
  ge25519 gepk;

  crypto_hash_sha512(sk, seed, 32);
  sk[0] &= 248;
  sk[31] &= 63;
  sk[31] |= 64;

  sc25519_from32bytes(&scsk, sk);
  ge25519_scalarmult_base(&gepk, &scsk);
  ge25519_pack(pk, &gepk);

  {
    int i;
    for (i = 0; i < 32; i++) sk[i] = seed[i];
    for (i = 0; i < 32; i++) sk[i + 32] = pk[i];
  }
  return 0;
}

/*
 * This little subroutine is needed to let emscripten know that it
 * should link in dlmalloc() rather than using the stub, leaky,
 * allocate-only, free-is-a-no-op malloc implementation it has as a
 * placeholder.
 */
#include <malloc.h>
void *nacl_emscripten_dummy_force_malloc_inclusion(void) {
  return malloc(10);
}
