import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import { HAPEncryption } from './eventedhttp.js'
import {
  chacha20_poly1305_decryptAndVerify,
  chacha20_poly1305_encryptAndSeal,
  HKDF,
  layerDecrypt,
  layerEncrypt,
} from './hapCrypto.js'

function fromHex(hex: string): Buffer {
  return Buffer.from(hex.trim().replace(/ /g, ''), 'hex')
}

/*
 * This test is not to there to test the underlying node crypto / openssl implementation (this is tested well enough)
 * but rather to give some easy validation for future modifications somebody might be doing.
 */

describe('hapCrypto', () => {
  describe('chacha20-poly1305', () => {
    const key = fromHex('09b29329 4514f14e e8437501 674e268f 7d85b193 85d38b54 8f5be259 c678fb52')
    const input = fromHex(
      '48545450 2f312e31 20323030 204f4b0d 0a436f6e 74656e74 2d547970 653a2061 70706c69 636174696f6e2f68 61702b6a'
      + '736f6e0d 0a446174 653a2053 756e2c20 31392041 70722032 30323020 31363a32 323a3238 20474d54 0d0a436f 6e6e6563'
      + '74696f6e 3a206b65 65702d61 6c697665 0d0a5472 616e7366 65722d45 6e636f64 696e673a 20636875 6e6b6564 0d0a0d0a'
      + '33350d0a 7b226368 61726163 74657269 73746963 73223a5b 7b226169 64223a31 2c226969 64223a39 2c227661 6c756522'
      + '3a66616c 73657d5d 7d0d0a30 0d0a0d0a',
    )
    const nonce = fromHex('08000000 00000000')
    const aad = fromHex('d000')
    const tag = fromHex('8e4c1272 16827838 8a155757 d34a851a')
    const output = fromHex(
      '6e62d95a 0811739b f21f4135 00da6a77 a5eb013f d9fe70ce 1c7a4c95 c06eee64 7ffe2dd6 ab58bce8 6d911959 4a11defa'
      + 'e4162a4e 9d3240ca 36956854 e6150377 b54e4ac9 f98d7607 4331ac06 54e0abaa 76006d43 aecb3638 60952e58 3708ca26'
      + '959bccf9 4bb255de 31286989 faf82ec6 99cf7abe dc4c3544 210b1e35 4d323a72 ed197d1b e584a1d6 42931ced e20376d8'
      + '31bb3eea 7d3b307c 432d5b10 9b30b1cf 3e0bba23 712695a6 9e6e66b9 7db4ac45 3c49c6de 2c5b3139 ca5c9fef 07bf805d'
      + '8cc99047 ad94b0cf 33eac227 b1211074',
    )

    it('should encrypt chacha20-poly1305 correctly', () => {
      const encrypted = chacha20_poly1305_encryptAndSeal(key, nonce, aad, input)
      expect(encrypted.ciphertext.toString('hex')).toBe(output.toString('hex'))
      expect(encrypted.authTag.toString('hex')).toBe(tag.toString('hex'))
    })

    it('should decrypt chacha20-poly1305 correctly', () => {
      const plaintext = chacha20_poly1305_decryptAndVerify(key, nonce, aad, output, tag)
      expect(plaintext.toString('hex')).toBe(input.toString('hex'))
    })

    it('should fail verification on manipulated data', () => {
      const manipulated = Buffer.alloc(output.length)
      output.copy(manipulated)
      manipulated[3] = 5

      expect(() => chacha20_poly1305_decryptAndVerify(key, nonce, aad, manipulated, tag)).toThrow()
    })
  })

  describe('hKDF', () => {
    it('should calculate test vector correctly', () => {
      const ikm = fromHex('0b0b0b0b 0b0b0b0b 0b0b0b0b 0b0b0b0b 0b0b0b0b 0b0b')
      const salt = fromHex('00010203 04050607 08090a0b 0c')
      const info = Buffer.alloc(0)

      const result = fromHex('f81b8748 1a18b664 936daeb2 22f58cba 0ebc55f5 c85996b9 f1cb396c 327b70bb')

      const hkdf = HKDF('sha512', salt, ikm, info, 32)
      expect(hkdf.toString('hex')).toBe(result.toString('hex'))
    })
  })

  describe('layer encryption', () => {
    let serverEncryption: HAPEncryption
    let clientEncryption: HAPEncryption

    const message0 = Buffer.from('Hello World')
    const message1 = Buffer.from('Hello Mars')
    const message2 = Buffer.from('Foo')
    const message3 = Buffer.from('Bar')

    beforeEach(() => {
      const salt = Buffer.from('Test-Salt')
      const readInfo = Buffer.from('Control-Read-Encryption-Key')
      const writeInfo = Buffer.from('Control-Write-Encryption-Key')

      const sharedSecret = randomBytes(32)

      const accessoryToControllerKey = HKDF('sha512', salt, sharedSecret, readInfo, 32)
      const controllerToAccessoryKey = HKDF('sha512', salt, sharedSecret, writeInfo, 32)

      const empty = Buffer.alloc(0)
      serverEncryption = new HAPEncryption(empty, empty, empty, sharedSecret, empty)
      clientEncryption = new HAPEncryption(empty, empty, empty, sharedSecret, empty)

      serverEncryption.accessoryToControllerKey = accessoryToControllerKey
      serverEncryption.controllerToAccessoryKey = controllerToAccessoryKey

      clientEncryption.accessoryToControllerKey = controllerToAccessoryKey
      clientEncryption.controllerToAccessoryKey = accessoryToControllerKey
    })

    it('simple encryption and decryption', () => {
      const encrypted = layerEncrypt(message0, serverEncryption)

      const decrypted = layerDecrypt(encrypted, clientEncryption)
      expect(decrypted).toEqual(message0)
    })

    it('multiple frames encryption and decryption', () => {
      const encrypted0 = layerEncrypt(message0, serverEncryption)
      const encrypted1 = layerEncrypt(message1, serverEncryption)
      const encrypted2 = layerEncrypt(message2, serverEncryption)

      const decrypted = layerDecrypt(Buffer.concat([encrypted0, encrypted1, encrypted2]), clientEncryption)
      expect(decrypted).toEqual(Buffer.concat([message0, message1, message2]))
    })

    it('multiple frames encryption and decryption intertwined', () => {
      const S_encrypted0 = layerEncrypt(message0, serverEncryption)
      const S_encrypted1 = layerEncrypt(message1, serverEncryption)
      const S_encrypted2 = layerEncrypt(message2, serverEncryption)

      const C_encrypted0 = layerEncrypt(message1, clientEncryption)
      const C_encrypted1 = layerEncrypt(message3, clientEncryption)

      const S_decrypted = layerDecrypt(Buffer.concat([S_encrypted0, S_encrypted1, S_encrypted2]), clientEncryption)
      expect(S_decrypted).toEqual(Buffer.concat([message0, message1, message2]))

      const C_decrypted = layerDecrypt(Buffer.concat([C_encrypted0, C_encrypted1]), serverEncryption)
      expect(C_decrypted).toEqual(Buffer.concat([message1, message3]))
    })

    it('incomplete frames decryption; first', () => {
      const S_encrypted0 = layerEncrypt(message0, serverEncryption)
      const S_encrypted1 = layerEncrypt(message1, serverEncryption)
      const S_encrypted2 = layerEncrypt(message2, serverEncryption)

      const C_encrypted0 = layerEncrypt(message2, clientEncryption)
      const C_encrypted1 = layerEncrypt(message3, clientEncryption)

      expect(layerDecrypt(C_encrypted0.subarray(0, 5), serverEncryption)).toEqual(Buffer.alloc(0))

      const S_decrypted0 = layerDecrypt(
        Buffer.concat([S_encrypted0, S_encrypted1.subarray(0, 5)]),
        clientEncryption,
      )
      expect(S_decrypted0).toEqual(message0)

      const C_decrypted = layerDecrypt(
        Buffer.concat([C_encrypted0.subarray(5), C_encrypted1]),
        serverEncryption,
      )
      expect(C_decrypted).toEqual(Buffer.concat([message2, message3]))

      const S_decrypted1 = layerDecrypt(
        Buffer.concat([S_encrypted1.subarray(5), S_encrypted2]),
        clientEncryption,
      )
      expect(S_decrypted1).toEqual(Buffer.concat([message1, message2]))
    })
  })
})
