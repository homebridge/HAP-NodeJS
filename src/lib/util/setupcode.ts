import crypto from "crypto";
import { NodeCallback } from "../../types";

const invalid = [
  "000-00-000",
  "111-11-111",
  "222-22-222",
  "333-33-333",
  "444-44-444",
  "555-55-555",
  "666-66-666",
  "777-77-777",
  "888-88-888",
  "999-99-999",
  "123-45-678",
  "876-54-321",
];

function toString(buffer: Buffer): string {
  return ("000" + buffer.readUInt16LE(0)).substr(-3) + "-" +
    ("00" + buffer.readUInt16LE(2)).substr(-2) + "-" +
    ("000" + buffer.readUInt16LE(4)).substr(-3);
}

export function generateSetupCode(callback: NodeCallback<string>): void
export function generateSetupCode(): Promise<string>
export function generateSetupCode(callback?: NodeCallback<string>): Promise<string> | void {
  if (!callback) {
    return new Promise((rs, rj) => generateSetupCode((err, result) => err ? rj(err) : rs(result!)));
  }

  crypto.randomBytes(6, (err, buffer) => {
    if (err) {
      return callback(err);
    }

    const setupCode = toString(buffer);
    if (!invalid.includes(setupCode)) {
      return callback(null, setupCode);
    }

    generateSetupCode(callback);
  });
}

export function generateSetupCodeSync(): string {
  let setupCode;

  do {
    setupCode = toString(crypto.randomBytes(8));
  } while (invalid.includes(setupCode));

  return setupCode;
}
