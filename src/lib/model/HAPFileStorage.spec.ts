import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HAPFileStorage } from "./HAPFileStorage";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hap-nodejs-storage-test-"));
}

describe(HAPFileStorage, () => {
  let dir: string;
  let storage: HAPFileStorage;

  beforeEach(() => {
    dir = tempDir();
    storage = new HAPFileStorage();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe("initSync", () => {
    it("should create the storage directory recursively if it does not exist", () => {
      const nested = path.join(dir, "does", "not", "exist");
      storage.initSync({ dir: nested });
      expect(fs.statSync(nested).isDirectory()).toBe(true);
    });

    it("should load existing files as raw-key filenames containing bare JSON values", () => {
      // layout written by node-persist 0.0.12: filename is the raw key, content is JSON.stringify(value)
      fs.writeFileSync(path.join(dir, "AccessoryInfo.CC223DE3CEF3.json"), "{\"displayName\":\"Outlet\",\"configVersion\":2}");
      storage.initSync({ dir: dir });
      expect(storage.getItem("AccessoryInfo.CC223DE3CEF3.json")).toEqual({ displayName: "Outlet", configVersion: 2 });
    });

    it("should ignore dotfiles when loading the storage directory", () => {
      fs.writeFileSync(path.join(dir, ".DS_Store"), "\"junk\"");
      storage.initSync({ dir: dir });
      expect(storage.getItem(".DS_Store")).toBeUndefined();
    });

    it("should treat files with invalid JSON as undefined instead of throwing", () => {
      fs.writeFileSync(path.join(dir, "corrupt.json"), "{ not json !");
      expect(() => storage.initSync({ dir: dir })).not.toThrow();
      expect(storage.getItem("corrupt.json")).toBeUndefined();
    });

    it("should default to the relative directory 'persist' like node-persist 0.0.12", () => {
      const previousCwd = process.cwd();
      try {
        process.chdir(dir);
        storage.initSync();
        storage.setItemSync("key.json", { foo: 1 });
        expect(fs.readFileSync(path.join(dir, "persist", "key.json"), "utf8")).toEqual("{\"foo\":1}");
      } finally {
        process.chdir(previousCwd);
      }
    });

    it("should reject relative custom directories", () => {
      expect(() => storage.initSync({ dir: "relative/persist/path" }))
        .toThrow(/absolute/);
    });

    it("should accept an absolute custom directory with a trailing separator", () => {
      storage.initSync({ dir: dir + path.sep });
      storage.setItemSync("key.json", 1);
      expect(fs.readFileSync(path.join(dir, "key.json"), "utf8")).toEqual("1");
    });

    it("should reject a dir option which is not a string instead of silently using the default directory", () => {
      expect(() => storage.initSync({ dir: undefined })).toThrow(/absolute/);
    });

    it("should reject unsupported node-persist init options instead of silently ignoring them", () => {
      // @ts-expect-error: deliberately test an illegal option
      expect(() => storage.initSync({ dir: dir, ttl: true })).toThrow(/ttl/);
    });

    it("should merge keys of a second directory on re-init and redirect writes to it, like node-persist 0.0.12", () => {
      const secondDir = tempDir();
      try {
        fs.writeFileSync(path.join(dir, "first.json"), "1");
        fs.writeFileSync(path.join(secondDir, "second.json"), "2");

        storage.initSync({ dir: dir });
        storage.initSync({ dir: secondDir });

        expect(storage.getItem("first.json")).toEqual(1);
        expect(storage.getItem("second.json")).toEqual(2);

        storage.setItemSync("third.json", 3);
        expect(fs.existsSync(path.join(secondDir, "third.json"))).toBe(true);
        expect(fs.existsSync(path.join(dir, "third.json"))).toBe(false);
      } finally {
        fs.rmSync(secondDir, { recursive: true, force: true });
      }
    });
  });

  describe("setItemSync", () => {
    beforeEach(() => {
      storage.initSync({ dir: dir });
    });

    it("should write the value as compact JSON without a trailing newline, byte-for-byte like node-persist 0.0.12", () => {
      const value = { displayName: "Outlet", pairedClients: {}, configVersion: 2 };
      storage.setItemSync("AccessoryInfo.CC223DE3CEF3.json", value);

      const raw = fs.readFileSync(path.join(dir, "AccessoryInfo.CC223DE3CEF3.json"));
      expect(raw.equals(Buffer.from(JSON.stringify(value), "utf8"))).toBe(true);
    });

    it("should use the raw key as the filename without hashing or escaping", () => {
      storage.setItemSync("IdentifierCache.CC223DE3CEF3.json", {});
      expect(fs.readdirSync(dir)).toEqual(["IdentifierCache.CC223DE3CEF3.json"]);
    });

    it("should overwrite an existing value", () => {
      storage.setItemSync("key.json", { a: 1 });
      storage.setItemSync("key.json", { b: 2 });
      expect(storage.getItem("key.json")).toEqual({ b: 2 });
      expect(fs.readFileSync(path.join(dir, "key.json"), "utf8")).toEqual("{\"b\":2}");
    });
  });

  describe("getItem", () => {
    beforeEach(() => {
      storage.initSync({ dir: dir });
    });

    it("should return undefined for a missing key", () => {
      expect(storage.getItem("missing.json")).toBeUndefined();
    });

    it("should return the in-memory value without re-reading from disk, like node-persist 0.0.12", () => {
      const value = { accessories: { uuid: [] } };
      storage.setItemSync("ControllerStorage.CC223DE3CEF3.json", value);
      // ControllerStorage.load() mutates the returned object, relying on getItem returning the cached reference
      expect(storage.getItem("ControllerStorage.CC223DE3CEF3.json")).toBe(value);
    });

    it("should fail loudly on node-persist's legacy callback form instead of never invoking the callback", () => {
      storage.setItemSync("key.json", 1);
      // @ts-expect-error: deliberately test the removed node-persist API
      expect(() => storage.getItem("key.json", () => undefined))
        .toThrow(/callback.*initSync, getItem, setItemSync and removeItemSync/);
    });
  });

  describe("removeItemSync", () => {
    beforeEach(() => {
      storage.initSync({ dir: dir });
    });

    it("should remove the file and the in-memory value", () => {
      storage.setItemSync("key.json", { a: 1 });
      storage.removeItemSync("key.json");
      expect(storage.getItem("key.json")).toBeUndefined();
      expect(fs.existsSync(path.join(dir, "key.json"))).toBe(false);
    });

    it("should silently do nothing for a key which was never persisted", () => {
      expect(() => storage.removeItemSync("missing.json")).not.toThrow();
    });
  });

  describe("unsupported node-persist methods", () => {
    it.each([
      "init", "key", "keys", "length", "forEach", "values", "valuesWithKeyMatch",
      "setItem", "getItemSync", "removeItem", "clear", "clearSync",
      "persist", "persistSync", "stopInterval",
    ])("should fail loudly when calling %s()", name => {
      storage.initSync({ dir: dir });
      const method = (storage as unknown as Record<string, (...args: unknown[]) => unknown>)[name];
      expect(typeof method).toEqual("function");
      expect(() => method()).toThrow(new RegExp(`${name}.*initSync, getItem, setItemSync and removeItemSync`));
    });
  });
});
