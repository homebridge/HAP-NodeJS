import { decode, decodeList, decodeWithLists, encode, readVariableUIntLE, writeVariableUIntLE } from "./tlv";

const HELLO_WORLD_BUFFER = Buffer.from("Hello World!");

describe("tlv", () => {
  describe("encode", () => {
    test("encode simple integer", () => {
      const encoded = encode(1, 42);
      expect(encoded.toString("hex"))
        .toEqual("01012a");
    });

    test("encode simple string", () => {
      const encoded = encode(2, "Hello World!");
      expect(encoded.toString("hex"))
        .toEqual("020c" + HELLO_WORLD_BUFFER.toString("hex"));
    });

    test("encode simple string as Buffer", () => {
      const buffer = Buffer.from("Hello World!");
      const encoded = encode(3, buffer);
      expect(encoded.toString("hex"))
        .toEqual("030c" + HELLO_WORLD_BUFFER.toString("hex"));
    });

    test("encode tlv list", () => {
      const encoded = encode(4, [1, 2, 3, 4, 5]);
      expect(encoded.toString("hex"))
        .toEqual(
          "040101" +
          "0000" +
          "040102" +
          "0000" +
          "040103" +
          "0000" +
          "040104" +
          "0000" +
          "040105",
        );
    });

    test("encode single value tlv list", () => {
      const encoded = encode(5, [1]);
      expect(encoded.toString("hex"))
        .toEqual("050101");
    });

    test("encode empty tlv list", () => {
      const encoded = encode(6, []);
      expect(encoded.toString("hex"))
        .toEqual("0600");
    });

    test("ensure too long buffers are split!", () => {
      const fill = Buffer.from([1, 2, 3]);

      const buffer = Buffer.alloc(615, fill);
      const encoded = encode(0x01, buffer);

      expect(encoded.toString("hex"))
        .toEqual(
          "01ff" + Buffer.alloc(255, fill).toString("hex") +
          "01ff" + Buffer.alloc(255, fill).toString("hex") +
          "0169" + Buffer.alloc(105, fill).toString("hex"),
        );
    });

    test("encode via varargs", () => {
      const encoded = encode(0x01, 1, 0x02, 2, 0x03, 3);
      expect(encoded.toString("hex"))
        .toEqual("010101020102030103");
    });
  });

  describe("decode", () => {
    test("decode single element", () => {
      const decoded = decode(Buffer.from("010101", "hex"));
      expect(decoded).toEqual({
        1: Buffer.from("01", "hex"),
      });
    });

    test("decode multiple elements", () => {
      const decoded = decode(Buffer.from("010101020102030103", "hex"));
      expect(decoded).toEqual({
        1: Buffer.from("01", "hex"),
        2: Buffer.from("02", "hex"),
        3: Buffer.from("03", "hex"),
      });
    });

    test("decode concatenation of multiple elements", () => {
      const decoded = decode(Buffer.from("010101010102010103", "hex"));
      expect(decoded).toEqual({
        1: Buffer.from("010203", "hex"),
      });
    });
  });

  describe("decodeWithLists", () => {
    test("decode single element", () => {
      const decoded = decodeWithLists(Buffer.from("010101", "hex"));
      expect(decoded).toEqual({
        1: Buffer.from("01", "hex"),
      });
    });

    test("decode multiple elements", () => {
      const decoded = decodeWithLists(Buffer.from("010101020102030103", "hex"));
      expect(decoded).toEqual({
        1: Buffer.from("01", "hex"),
        2: Buffer.from("02", "hex"),
        3: Buffer.from("03", "hex"),
      });
    });

    test("decode concatenation of multiple elements", () => {
      // tlv entries longer than 255 are split over multiple entries
      // decodeWithList should reassemble them to a single entry!
      const content = Buffer.concat([
        Buffer.from("01ff", "hex"),
        Buffer.alloc(255, "A", "ascii"),
        Buffer.from("0102", "hex"),
        Buffer.alloc(2, "A", "ascii"),
      ]);

      const decoded = decodeWithLists(content);
      expect(decoded).toEqual({
        1: Buffer.alloc(257, "A", "ascii"),
      });
    });

    test("decode list of entries", () => {
      const content = Buffer.from(
        "010101" +
        "0000" +
        "010102" +
        "0000" +
        "010103" +
        "0000" +
        "010104",
        "hex",
      );

      const decoded = decodeWithLists(content);
      expect(decoded).toEqual({
        1: [
          Buffer.from("01", "hex"),
          Buffer.from("02", "hex"),
          Buffer.from("03", "hex"),
          Buffer.from("04", "hex"),
        ],
      });
    });

    test("decode list of entries where some are split due to size limits", () => {
      const content = Buffer.concat([
        Buffer.from("01010b", "hex"),
        Buffer.from("0000", "hex"),
        Buffer.from("01010c", "hex"),
        Buffer.from("0000", "hex"),
        Buffer.from("01ff", "hex"),
        Buffer.alloc(255, "A", "ascii"),
        Buffer.from("0102", "hex"),
        Buffer.alloc(2, "A", "ascii"),
      ]);

      const decoded = decodeWithLists(content);
      expect(decoded).toEqual({
        1: [
          Buffer.from("0b", "hex"),
          Buffer.from("0c", "hex"),
          Buffer.alloc(257, "A", "ascii"),
        ],
      });
    });

    test("reject lists which are not properly separated with zero tlv type", () => {
      expect(() => decodeWithLists(Buffer.from("01010a01010b", "hex")))
        .toThrowError();
    });
  });

  describe("decodeList", () => {
    test("simple concatenated list buffer", () => {
      const decoded = decodeList(Buffer.from("010101010102010103010104", "hex"), 0x01);

      expect(decoded).toEqual([
        { 1: Buffer.from("01", "hex") },
        { 1: Buffer.from("02", "hex") },
        { 1: Buffer.from("03", "hex") },
        { 1: Buffer.from("04", "hex") },
      ]);
    });

    test("list buffer with multiple tlv entries", () => {
      const decoded = decodeList(Buffer.from(
        "01010102010a" +
        "01010202010b",
        "hex",
      ), 0x01);

      expect(decoded).toEqual([
        {
          1: Buffer.from("01", "hex"),
          2: Buffer.from("0a", "hex"),
        },
        {
          1: Buffer.from("02", "hex"),
          2: Buffer.from("0b", "hex"),
        },
      ]);
    });

    test("concatenate multiple entries of same value", () => {
      const decoded = decodeList(Buffer.from("01010102010a02010b", "hex"), 0x01);

      expect(decoded).toEqual([
        {
          1: Buffer.from("01", "hex"),
          2: Buffer.from("0a0b", "hex"),
        },
      ]);
    });

    test("reject ill-formatted tlv list", () => {
      expect(() => decodeList(Buffer.from("020101", "hex"), 0x01))
        .toThrowError();
    });
  });

  describe("buffer", () => {
    test("writeVariableUIntLE", () => {
      // negative numbers are not allowed
      expect(() => writeVariableUIntLE(-1))
        .toThrowError();

      // offset must be zero
      // noinspection JSDeprecatedSymbols
      expect(() => writeVariableUIntLE(1, 1))
        .toThrowError();

      const input8 = 128;
      const buffer8 = writeVariableUIntLE(input8);
      expect(buffer8.length).toBe(1);
      expect(buffer8.readUInt8(0)).toBe(input8);
      expect(readVariableUIntLE(buffer8)).toBe(input8);

      const input16 = 512;
      const buffer16 = writeVariableUIntLE(input16);
      expect(buffer16.length).toBe(2);
      expect(buffer16.readUInt16LE(0)).toBe(input16);
      expect(readVariableUIntLE(buffer16)).toBe(input16);

      const input32 = 70_000;
      const buffer32 = writeVariableUIntLE(input32);
      expect(buffer32.length).toBe(4);
      expect(buffer32.readUInt32LE(0)).toBe(input32);
      expect(readVariableUIntLE(buffer32)).toBe(input32);

      const input64 = 2*0xFFFFFFFF;
      const buffer64 = writeVariableUIntLE(input64); // shifted by one
      expect(buffer64.length).toBe(8);
      // hex is just 32 bit 0xFF shifter by one
      expect(buffer64.toString("hex")).toBe("feffffff01000000");
      expect(readVariableUIntLE(buffer64)).toBe(input64);
    });
  });
});
