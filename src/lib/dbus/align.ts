import { Buffer } from 'safe-buffer';

export default function align(ps: any, n: number) {
  const pad = n - (ps._offset % n);
  if (pad === 0 || pad === n) return;
  // TODO: write8(0) in a loop (3 to 7 times here) could be more efficient
  const padBuff = Buffer.alloc(pad);
  ps.put(Buffer.from(padBuff));
  ps._offset += pad;
}
