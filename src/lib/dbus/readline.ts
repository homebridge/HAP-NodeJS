import { Buffer } from 'safe-buffer'

export default function readOneLine(stream: any, cb: any) {
  const bytes: any[] = []

  function readable() {
    while (1) {
      const buf = stream.read(1)
      if (!buf) {
        return
      }
      const b = buf[0]
      if (b === 0x0A) {
        try {
          cb(Buffer.from(bytes))
        } catch (error) {
          stream.emit('error', error)
        }
        stream.removeListener('readable', readable)
        return
      }
      bytes.push(b)
    }
  }
  stream.on('readable', readable)
};
