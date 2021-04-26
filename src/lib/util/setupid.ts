import * as crypto from "crypto";
import { Categories } from "../Accessory";

export function generateSetupId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const max = chars.length;
  let setupID = "";

  for (let i = 0; i < 4; i++) {
    const index = Math.floor(Math.random() * max);
    setupID += chars.charAt(index);
  }

  return setupID;
}

export function generateSetupHash(deviceId: string, setupId: string): string {
  if (!setupId.match(/^[0-9A-Z]{4}$/)) {
    throw new Error("Invalid setup ID");
  }

  return crypto.createHash("sha512")
    .update(setupId + deviceId)
    .digest()
    .slice(0, 4)
    .toString("base64");
}

export function generateSetupUri(setupCode: string | number, setupId: string, category = Categories.OTHER): string {
  if (typeof setupCode === "string") {
    setupCode = parseInt(setupCode.replace(/-/g, ""), 10);
  }
  const buffer = Buffer.alloc(8);

  let value_low = setupCode;
  const value_high = category >> 1;

  value_low |= 1 << 28; // Supports IP;

  buffer.writeUInt32BE(value_low, 4);

  if (category & 1) {
    buffer[4] = buffer[4] | 1 << 7;
  }

  buffer.writeUInt32BE(value_high!, 0);

  let encodedPayload = (buffer.readUInt32BE(4) + (buffer.readUInt32BE(0) * Math.pow(2, 32)))
    .toString(36).toUpperCase();

  if (encodedPayload.length !== 9) {
    for (let i = 0; i <= 9 - encodedPayload.length; i++) {
      encodedPayload = "0" + encodedPayload;
    }
  }

  return "X-HM://" + encodedPayload + setupId;
}
