import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HAPStorage } from "./src/lib/model/HAPStorage";

// Redirect the HAPStorage singleton into a fresh temporary directory for every test file,
// so suites which exercise persistence (e.g. through Accessory.publish()) never touch
// a real "persist" directory inside the repository.
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "hap-nodejs-jest-"));
HAPStorage.setCustomStoragePath(storageDir);

afterAll(() => {
  fs.rmSync(storageDir, { recursive: true, force: true });
});
