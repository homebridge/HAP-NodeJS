import crypto from "crypto";

export type Binary = Buffer | NodeJS.TypedArray | DataView;
export type BinaryLike = string | Binary;

export const BASE_UUID = "-0000-1000-8000-0026BB765291";

// http://stackoverflow.com/a/25951500/66673
export function generate(data: BinaryLike): string {
  const sha1sum = crypto.createHash("sha1");
  sha1sum.update(data);
  const s = sha1sum.digest("hex");
  let i = -1;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c: string) => {
    i += 1;
    switch (c) {
    case "y":
      return ((parseInt("0x" + s[i], 16) & 0x3) | 0x8).toString(16);
    case "x":
    default:
      return s[i];
    }
  });
}

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValid(UUID: string): boolean {
  return VALID_UUID_REGEX.test(UUID);
}


/**
 * Parses the uuid as a string from the given Buffer.
 * The parser will use the first 8 bytes.
 *
 * @param buf - The buffer to read from.
 */
export function unparse(buf: Buffer): string
/**
 * Parses the uuid as a string from the given Buffer at the specified offset.
 * @param buf - The buffer to read from.
 * @param offset - The offset in the buffer to start reading from.
 */
export function unparse(buf: Buffer, offset: number): string
export function unparse(buf: Buffer | string, offset = 0): string {
  let i = offset;

  return buf.toString("hex", i, (i += 4)) + "-" +
    buf.toString("hex", i, (i += 2)) + "-" +
    buf.toString("hex", i, (i += 2)) + "-" +
    buf.toString("hex", i, (i += 2)) + "-" +
    buf.toString("hex", i, i + 6);
}

export function write(uuid: string): Buffer
export function write(uuid: string, buf: Buffer, offset: number): void
export function write(uuid: string, buf?: Buffer, offset = 0): Buffer {
  const buffer = Buffer.from(uuid.replace(/-/g, ""), "hex");

  if (buf) {
    buffer.copy(buf, offset);
    return buf;
  } else {
    return buffer;
  }
}

const SHORT_FORM_REGEX = /^0*([0-9a-f]{1,8})-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function toShortForm(uuid: string, base: string = BASE_UUID): string {
  if (!isValid(uuid)) {
    throw new TypeError("uuid was not a valid UUID or short form UUID");
  }
  if (base && !isValid("00000000" + base)) {
    throw new TypeError("base was not a valid base UUID");
  }
  if (base && !uuid.endsWith(base)) {
    return uuid.toUpperCase();
  }

  return uuid.replace(SHORT_FORM_REGEX, "$1").toUpperCase();
}

const VALID_SHORT_REGEX = /^[0-9a-f]{1,8}$/i;

export function toLongForm(uuid: string, base: string = BASE_UUID): string {
  if (isValid(uuid)) {
    return uuid.toUpperCase();
  }
  if (!VALID_SHORT_REGEX.test(uuid)) {
    throw new TypeError("uuid was not a valid UUID or short form UUID");
  }
  if (!isValid("00000000" + base)) {
    throw new TypeError("base was not a valid base UUID");
  }

  return (("00000000" + uuid).substr(-8) + base).toUpperCase();
}
