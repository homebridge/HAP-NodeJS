import { DataStreamParser, DataStreamReader, DataStreamWriter, Float64 } from "./DataStreamParser";

describe("DataStreamParser", () => {
  describe("writeNumber Int32 range check", () => {
    test("should encode numbers in Int32 range as Int32, not Int64", () => {
      const writer = new DataStreamWriter();
      // 100000 is within Int32 range but was previously encoded as Int64
      writer.writeNumber(100000);
      const data = writer.getData();
      const reader = new DataStreamReader(data);

      // Tag byte (1) + 4 bytes for Int32 = 5 bytes total
      // If incorrectly encoded as Int64, it would be 1 + 8 = 9 bytes
      expect(data.length).toBe(5);

      // Verify it decodes back correctly
      const decoded = DataStreamParser.decode(reader);
      expect(decoded).toBe(100000);
    });

    test("should encode max Int32 value as Int32", () => {
      const writer = new DataStreamWriter();
      writer.writeNumber(2147483647);
      const data = writer.getData();

      // 1 tag byte + 4 data bytes = 5
      expect(data.length).toBe(5);

      const reader = new DataStreamReader(data);
      expect(DataStreamParser.decode(reader)).toBe(2147483647);
    });

    test("should encode min Int32 value as Int32", () => {
      const writer = new DataStreamWriter();
      writer.writeNumber(-2147483648);
      const data = writer.getData();

      // 1 tag byte + 4 data bytes = 5
      expect(data.length).toBe(5);

      const reader = new DataStreamReader(data);
      expect(DataStreamParser.decode(reader)).toBe(-2147483648);
    });

    test("should encode numbers beyond Int32 range as Int64", () => {
      const writer = new DataStreamWriter();
      writer.writeNumber(2147483648); // one above Int32 max
      const data = writer.getData();

      // 1 tag byte + 8 data bytes = 9
      expect(data.length).toBe(9);

      const reader = new DataStreamReader(data);
      expect(DataStreamParser.decode(reader)).toBe(2147483648);
    });
  });

  describe("readFloat64LE reader index advance", () => {
    test("should advance reader index after reading Float64", () => {
      const writer = new DataStreamWriter();
      writer.writeFloat64LE(new Float64(3.14));
      writer.writeFloat64LE(new Float64(2.71));
      const data = writer.getData();

      const reader = new DataStreamReader(data);
      const first = DataStreamParser.decode(reader);
      const second = DataStreamParser.decode(reader);

      expect(first).toBeCloseTo(3.14);
      expect(second).toBeCloseTo(2.71);
      // If the reader index wasn't advancing, both would be 3.14
      expect(second).not.toBeCloseTo(3.14);
    });
  });

  describe("UTF-8 tag byte length", () => {
    test("should correctly encode multi-byte UTF-8 strings", () => {
      const writer = new DataStreamWriter();
      // "é" is 2 bytes in UTF-8 but 1 character in JS
      const testString = "é";
      writer.writeUTF8(testString);
      const data = writer.getData();

      const reader = new DataStreamReader(data);
      const decoded = DataStreamParser.decode(reader);
      expect(decoded).toBe(testString);
    });

    test("should round-trip short strings with multi-byte characters", () => {
      const writer = new DataStreamWriter();
      // Mix of ASCII and multi-byte: 5 chars, 7 bytes in UTF-8
      const testString = "hëllo";
      writer.writeUTF8(testString);
      const data = writer.getData();

      const reader = new DataStreamReader(data);
      const decoded = DataStreamParser.decode(reader);
      expect(decoded).toBe(testString);
    });
  });
});
