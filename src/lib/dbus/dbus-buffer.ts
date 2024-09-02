import type { Buffer } from 'node:buffer'

import Long from 'long'

import parseSignature from './signature.js'

export default class DBusBuffer {
  buffer: Buffer
  startPos: number
  pos: number
  options: { ayBuffer: boolean, ReturnLongjs: boolean }

  constructor(buffer: Buffer, startPos: number = 0, options: { ayBuffer?: boolean, ReturnLongjs?: boolean } = {}) {
    this.buffer = buffer
    this.startPos = startPos
    this.pos = 0
    this.options = {
      ayBuffer: options.ayBuffer !== undefined ? options.ayBuffer : true,
      ReturnLongjs: options.ReturnLongjs !== undefined ? options.ReturnLongjs : false,
    }
  }

  align(power: number) {
    const allbits = (1 << power) - 1
    const paddedOffset = ((this.pos + this.startPos + allbits) >> power) << power
    this.pos = paddedOffset - this.startPos
  }

  readInt8() {
    this.pos++
    return this.buffer[this.pos - 1]
  }

  readSInt16() {
    this.align(1)
    const res = this.buffer.readInt16LE(this.pos)
    this.pos += 2
    return res
  }

  readInt16() {
    this.align(1)
    const res = this.buffer.readUInt16LE(this.pos)
    this.pos += 2
    return res
  }

  readSInt32() {
    this.align(2)
    const res = this.buffer.readInt32LE(this.pos)
    this.pos += 4
    return res
  }

  readInt32() {
    this.align(2)
    const res = this.buffer.readUInt32LE(this.pos)
    this.pos += 4
    return res
  }

  readDouble() {
    this.align(3)
    const res = this.buffer.readDoubleLE(this.pos)
    this.pos += 8
    return res
  }

  readString(len: number) {
    if (len === 0) {
      this.pos++
      return ''
    }
    const res = this.buffer.toString('utf8', this.pos, this.pos + len)
    this.pos += len + 1 // dbus strings are always zero-terminated ('s' and 'g' types)
    return res
  }

  readTree(tree: any): any {
    switch (tree.type) {
      case '(':
      case '{':
      case 'r':
        this.align(3)
        return this.readStruct(tree.child)
      case 'a': {
        if (!tree.child || tree.child.length !== 1) {
          throw new Error('Incorrect array element signature')
        }
        const arrayBlobLength = this.readInt32()
        return this.readArray(tree.child[0], arrayBlobLength)
      }
      case 'v':
        return this.readVariant()
      default:
        return this.readSimpleType(tree.type)
    }
  }

  read(signature: string) {
    const tree = parseSignature(signature)
    return this.readStruct(tree)
  }

  readVariant() {
    const signature = this.readSimpleType('g')
    const tree = parseSignature(signature)
    return [tree, this.readStruct(tree)]
  }

  readStruct(struct: any[]) {
    const result = []
    for (let i = 0; i < struct.length; ++i) {
      result.push(this.readTree(struct[i]))
    }
    return result
  }

  readArray(eleType: any, arrayBlobSize: number) {
    const start = this.pos

    // special case: treat ay as Buffer
    if (eleType.type === 'y' && this.options.ayBuffer) {
      this.pos += arrayBlobSize
      return this.buffer.slice(start, this.pos)
    }

    // end of array is start of first element + array size
    // we need to add 4 bytes if not on 8-byte boundary
    // and array element needs 8 byte alignment
    if (['x', 't', 'd', '{', '(', 'r'].includes(eleType.type)) {
      this.align(3)
    }
    const end = this.pos + arrayBlobSize
    const result = []
    while (this.pos < end) {
      result.push(this.readTree(eleType))
    }
    return result
  }

  readSimpleType(t: string) {
    let data, len, word0, word1
    switch (t) {
      case 'y':
        return this.readInt8()
      case 'b':
        // TODO: spec says that true is strictly 1 and false is strictly 0
        // should we error (or warn?) when non 01 values?
        return !!this.readInt32()
      case 'n':
        return this.readSInt16()
      case 'q':
        return this.readInt16()
      case 'u':
        return this.readInt32()
      case 'i':
        return this.readSInt32()
      case 'g':
        len = this.readInt8()
        return this.readString(len)
      case 's':
      case 'o':
        len = this.readInt32()
        return this.readString(len)
      // TODO: validate object path here
      // if (t === 'o' && !isValidObjectPath(str))
      //  throw new Error('string is not a valid object path'));
      case 'x':
        // signed
        this.align(3)
        word0 = this.readInt32()
        word1 = this.readInt32()
        data = Long.fromBits(word0, word1, false)
        if (this.options.ReturnLongjs) {
          return data
        }
        return data.toNumber() // convert to number (good up to 53 bits)
      case 't':
        // unsigned
        this.align(3)
        word0 = this.readInt32()
        word1 = this.readInt32()
        data = Long.fromBits(word0, word1, true)
        if (this.options.ReturnLongjs) {
          return data
        }
        return data.toNumber() // convert to number (good up to 53 bits)
      case 'd':
        return this.readDouble()
      default:
        throw new Error(`Unsupported type: ${t}`)
    }
  }
}
