import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HAPFileStorage } from "./HAPFileStorage";
import { HAPStorage } from "./HAPStorage";

describe(HAPStorage, () => {
  let storagePath: string;

  beforeEach(() => {
    storagePath = fs.mkdtempSync(path.join(os.tmpdir(), "hap-nodejs-storage-test-"));
  });

  afterEach(() => {
    fs.rmSync(storagePath, { recursive: true, force: true });
  });

  describe("storage", () => {
    it("should init storage correctly and only once", () => {
      const storage = new HAPStorage();
      storage.setCustomStoragePath(storagePath);

      // @ts-expect-error: private access
      expect(storage.localStore).toBeUndefined();
      const localStore = storage.storage(); // init first time
      expect(localStore).toBeInstanceOf(HAPFileStorage);

      // @ts-expect-error: private access
      expect(storage.localStore).toBeDefined();
      const localStore2 = storage.storage(); // must not init a second time
      expect(localStore2).toBe(localStore);
    });

    it("should init into the default 'persist' directory when no custom path was set", () => {
      const storage = new HAPStorage();

      const previousCwd = process.cwd();
      try {
        process.chdir(storagePath);
        const localStore = storage.storage();

        expect(localStore).toBeInstanceOf(HAPFileStorage);
        expect(fs.statSync(path.join(storagePath, "persist")).isDirectory()).toBe(true);
      } finally {
        process.chdir(previousCwd);
      }
    });
  });

  describe("setCustomStoragePath", () => {
    it("should init storage correctly with custom storage path", () => {
      const storage = new HAPStorage();

      const customPath = path.join(storagePath, "custom");
      storage.setCustomStoragePath(customPath);
      const localStore = storage.storage();

      expect(fs.statSync(customPath).isDirectory()).toBe(true);

      localStore.setItemSync("key.json", { foo: 1 });
      expect(fs.readFileSync(path.join(customPath, "key.json"), "utf8")).toEqual("{\"foo\":1}");
    });

    it("should reject setCustomStoragePath after storage has already been initialized", () => {
      const storage = new HAPStorage();
      storage.setCustomStoragePath(storagePath);

      storage.storage();
      expect(() => storage.setCustomStoragePath("customPath")).toThrow(Error);
    });
  });

});
