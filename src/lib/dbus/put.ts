import assert from 'node:assert'
import { Buffer } from 'node:buffer'

export default class Put {
  private words: any[]
  private len: number
  public _offset: number = 0

  constructor() {
    this.words = []
    this.len = 0;

    [8, 16, 24, 32, 64].forEach((bits) => {
      // @ts-expect-error - dynamic property
      this[`word${bits}be`] = (x: number) => {
        this.words.push({ endian: 'big', bytes: bits / 8, value: x })
        this.len += bits / 8
        return this
      }

      // @ts-expect-error - dynamic property
      this[`word${bits}le`] = (x: number) => {
        this.words.push({ endian: 'little', bytes: bits / 8, value: x })
        this.len += bits / 8
        return this
      }
    })
  }

  put(buf: Buffer) {
    this.words.push({ buffer: buf })
    this.len += buf.length
    return this
  }

  word8(x: number) {
    this.words.push({ bytes: 1, value: x })
    this.len += 1
    return this
  }

  floatle(x: number) {
    this.words.push({ bytes: 'float', endian: 'little', value: x })
    this.len += 4
    return this
  }

  word16be(x: number) {
    this.words.push({ endian: 'big', bytes: 2, value: x })
    this.len += 2
    return this
  }

  word16le(x: number) {
    this.words.push({ endian: 'little', bytes: 2, value: x })
    this.len += 2
    return this
  }

  word32be(x: number) {
    this.words.push({ endian: 'big', bytes: 4, value: x })
    this.len += 4
    return this
  }

  word32le(x: number) {
    this.words.push({ endian: 'little', bytes: 4, value: x })
    this.len += 4
    return this
  }

  word64be(x: number) {
    this.words.push({ endian: 'big', bytes: 8, value: x })
    this.len += 8
    return this
  }

  word64le(x: number) {
    this.words.push({ endian: 'little', bytes: 8, value: x })
    this.len += 8
    return this
  }

  pad(bytes: number) {
    assert(Number.isInteger(bytes), 'pad(bytes) must be supplied with an integer!')
    this.words.push({ endian: 'big', bytes, value: 0 })
    this.len += bytes
    return this
  }

  length() {
    return this.len
  }

  buffer() {
    const buf = Buffer.alloc(this.len)
    let offset = 0
    this.words.forEach((word) => {
      if (word.buffer) {
        word.buffer.copy(buf, offset, 0)
        offset += word.buffer.length
      } else if (word.bytes === 'float') {
        // s * f * 2^e
        const v = Math.abs(word.value)
        const s = (word.value as number) >= 0 ? 1 : 0
        const e = Math.ceil(Math.log(v) / Math.LN2)
        const f = v / (1 << e)

        // s:1, e:7, f:23
        // [seeeeeee][efffffff][ffffffff][ffffffff]
        buf[offset++] = (s << 7) & ~~(e / 2)
        buf[offset++] = ((e & 1) << 7) & ~~(f / (1 << 16))
        buf[offset++] = 0
        buf[offset++] = 0
        offset += 4
      } else {
        const big = word.endian === 'big'
        const ix = big ? [(word.bytes - 1) * 8, -8] : [0, 8]

        for (let i = ix[0]; big ? i >= 0 : i < word.bytes * 8; i += ix[1]) {
          if (i >= 32) {
            buf[offset++] = Math.floor(word.value / 2 ** i) & 0xFF
          } else {
            buf[offset++] = (word.value >> i) & 0xFF
          }
        }
      }
    })
    return buf
  }

  write(stream: any) {
    stream.write(this.buffer())
  }
}
