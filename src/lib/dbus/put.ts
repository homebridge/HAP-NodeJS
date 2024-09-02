// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import assert from 'node:assert'

export default function put () {
  if (!(this instanceof put)) return new put;

  const words = [];
  let len = 0;

  this.put = function (buf) {
    words.push({ buffer : buf });
    len += buf.length;
    return this;
  };

  this.word8 = function (x) {
    words.push({ bytes : 1, value : x });
    len += 1;
    return this;
  };

  this.floatle = function (x) {
    words.push({ bytes : 'float', endian : 'little', value : x });
    len += 4;
    return this;
  };

  [ 8, 16, 24, 32, 64 ].forEach((function (bits) {
    this['word' + bits + 'be'] = function (x) {
      words.push({ endian : 'big', bytes : bits / 8, value : x });
      len += bits / 8;
      return this;
    };

    this['word' + bits + 'le'] = function (x) {
      words.push({ endian : 'little', bytes : bits / 8, value : x });
      len += bits / 8;
      return this;
    };
  }).bind(this));

  this.pad = function (bytes) {
    assert(Number.isInteger(bytes), "pad(bytes) must be supplied with an integer!");
    words.push({ endian : 'big', bytes : bytes, value : 0 });
    len += bytes;
    return this;
  };

  this.length = function () {
    return len;
  };

  this.buffer = function () {
    const buf = Buffer.alloc(len);
    let offset = 0;
    words.forEach(function (word) {
      if (word.buffer) {
        word.buffer.copy(buf, offset, 0);
        offset += word.buffer.length;
      }
      else if (word.bytes === 'float') {
        // s * f * 2^e
        const v = Math.abs(word.value);
        const s = (word.value >= 0) * 1;
        const e = Math.ceil(Math.log(v) / Math.LN2);
        const f = v / (1 << e);
        console.dir([s,e,f]);

        console.log(word.value);

        // s:1, e:7, f:23
        // [seeeeeee][efffffff][ffffffff][ffffffff]
        buf[offset++] = (s << 7) & ~~(e / 2);
        buf[offset++] = ((e & 1) << 7) & ~~(f / (1 << 16));
        buf[offset++] = 0;
        buf[offset++] = 0;
        offset += 4;
      }
      else {
        const big = word.endian === 'big';
        const ix = big ? [(word.bytes - 1) * 8, -8] : [0, 8];

        for (
          let i = ix[0];
          big ? i >= 0 : i < word.bytes * 8;
          i += ix[1]
        ) {
          if (i >= 32) {
            buf[offset++] = Math.floor(word.value / Math.pow(2, i)) & 0xff;
          }
          else {
            buf[offset++] = (word.value >> i) & 0xff;
          }
        }
      }
    });
    return buf;
  };

  this.write = function (stream) {
    stream.write(this.buffer());
  };
}
