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

  describe("persist directory permissions (#1028)", () => {
    let warnSpy: jest.SpyInstance;
    let unwritableDir: string;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      unwritableDir = path.join(storagePath, "perm-check");
    });

    afterEach(() => {
      warnSpy.mockRestore();
      try {
        // the outer afterEach removes storagePath; make it removable again first
        fs.chmodSync(unwritableDir, 0o700);
      } catch {
        // never created
      }
    });

    it("warns when the persist directory is not writable", () => {
      fs.mkdirSync(unwritableDir, { recursive: true });
      fs.chmodSync(unwritableDir, 0o500); // read + execute, no write

      const storage = new HAPStorage();
      storage.setCustomStoragePath(unwritableDir);
      storage.storage();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("is not writable"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(unwritableDir));
    });

    it("does not warn when the persist directory is writable", () => {
      fs.mkdirSync(unwritableDir, { recursive: true });

      const storage = new HAPStorage();
      storage.setCustomStoragePath(unwritableDir);
      storage.storage();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not warn when the directory did not exist beforehand", () => {
      // HAPFileStorage creates a missing directory during init, so by the time
      // the check runs it exists and is writable. Warning on a fresh install
      // would be noise — this pins that it stays silent.
      const storage = new HAPStorage();
      storage.setCustomStoragePath(path.join(unwritableDir, "does", "not", "exist"));
      storage.storage();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("reads the directory HAPFileStorage resolved, not just the requested one", () => {
      // The check reads the resolved `dir` off the HAPFileStorage instance
      // rather than recomputing it, so it must match what init actually used.
      fs.mkdirSync(unwritableDir, { recursive: true });

      const storage = new HAPStorage();
      storage.setCustomStoragePath(unwritableDir);
      const localStore = storage.storage();

      expect((localStore as unknown as { dir?: string }).dir).toBe(unwritableDir);
    });

    it("does not warn on a default init with no custom path", () => {
      // With no custom path HAPFileStorage uses `persist` relative to the
      // working directory and creates it writable, so the check stays silent.
      const previousCwd = process.cwd();
      try {
        process.chdir(storagePath);
        const storage = new HAPStorage();
        storage.storage();

        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        process.chdir(previousCwd);
      }
    });
  });

});
