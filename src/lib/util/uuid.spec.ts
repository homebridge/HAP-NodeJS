import { toShortForm, toLongForm, unparse, write } from './uuid';

const uuidString = "cf47a128-769a-4563-8203-11f307b1926d";
const uuidBuffer = Buffer.from(uuidString.replace(/-/g, ""), "hex");

describe("uuid", () => {
    describe('toShortForm', () => {
        it('should return short form UUIDs without providing a base UUID', () => {
            const VALUE = '0000003E-0000-1000-8000-0026BB765291';
            expect(toShortForm(VALUE)).toBe('3E');
        });

        it('should return short form UUIDs when provided with a matching base UUID', () => {
            const VALUE = '0000003E-0000-1000-8000-0026BB765291';
            const BASE = '-0000-1000-8000-0026BB765291';
            expect(toShortForm(VALUE, BASE)).toBe('3E');
        });

        it('should return standard UUIDs when provided with a non-matching base UUID', () => {
            const VALUE = '0000003E-0000-1000-8000-0026BB765292';
            const BASE = '-0000-1000-8000-0026BB765291';
            expect(toShortForm(VALUE, BASE)).toBe(VALUE);
        });

        it('should not be case-sensitive when checking if the UUID matches the base UUID', () => {
            const VALUE = '0000003e-0000-1000-8000-0026bb765291';
            const BASE = '-0000-1000-8000-0026BB765291';
            const EXPECTED = '0000003E-0000-1000-8000-0026BB765291';
            expect(toShortForm(VALUE, BASE)).toEqual(EXPECTED);
        });
    });

    describe('toLongForm', () => {
        it('should return standard UUIDs', () => {
            const VALUE = '3E';
            const BASE = '-0000-1000-8000-0026BB765291';
            const EXPECTED = '0000003E-0000-1000-8000-0026BB765291';
            expect(toLongForm(VALUE, BASE)).toBe(EXPECTED);
        });
    });

    it("should read/write uuids from Buffer", () => {
        let uuid = unparse(uuidBuffer);
        expect(uuid).toBe(uuidString);

        let buffer = write(uuid);
        expect(buffer.toString("hex")).toBe(uuidBuffer.toString("hex"));
        expect(unparse(buffer)).toBe(uuid);
    });
})
