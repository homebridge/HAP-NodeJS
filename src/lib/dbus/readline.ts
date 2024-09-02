// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import { Buffer } from 'safe-buffer'

export default function readOneLine(stream, cb) {
  const bytes = [];

  function readable() {
    while (1) {
      const buf = stream.read(1);
      if (!buf) return;
      const b = buf[0];
      if (b === 0x0a) {
        try {
          cb(Buffer.from(bytes));
        } catch (error) {
          stream.emit('error', error);
        }
        stream.removeListener('readable', readable);
        return;
      }
      bytes.push(b);
    }
  }
  stream.on('readable', readable);
};
