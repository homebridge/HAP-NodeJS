import crypto from 'crypto';
import bufferShim from 'buffer-shims';
import { BinaryLike } from './uuid';

export function HKDF(hashAlg: string, salt: BinaryLike, ikm: BinaryLike, info: Buffer, size: number) {
  // create the hash alg to see if it exists and get its length
  const hash = crypto.createHash(hashAlg);
  const hashLength = hash.digest().length;

  // now we compute the PRK
  const hmac = crypto.createHmac(hashAlg, salt);
  hmac.update(ikm);
  const prk = hmac.digest();

  const buffers = [];
  const num_blocks = Math.ceil(size / hashLength);
  let prev = bufferShim.alloc(0);
  let output;

  info = bufferShim.from(info);

  for (var i=0; i<num_blocks; i++) {
    var blockHmac = crypto.createHmac(hashAlg, prk);

    var input = Buffer.concat([
      prev,
      info,
      bufferShim.from(String.fromCharCode(i + 1))
    ]);
    blockHmac.update(input);
    prev = blockHmac.digest();
    buffers.push(prev);
  }
  output = Buffer.concat(buffers, size);
  return output.slice(0,size);
}
