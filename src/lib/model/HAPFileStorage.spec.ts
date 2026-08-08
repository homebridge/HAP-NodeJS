import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HAPFileStorage } from "./HAPFileStorage";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hap-nodejs-storage-test-"));
}

function symlinksPermitted(): boolean {
  const probe = tempDir();
  try {
    fs.symlinkSync(path.join(probe, "target"), path.join(probe, "link"));
    return true;
  } catch {
    // creating a symlink on Windows needs Developer Mode or an elevated shell
    return false;
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}

const itWithSymlinks = symlinksPermitted() ? it : it.skip;

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

    it("should ignore directories when loading the storage directory", () => {
      // reading a directory as a file would abort startup with EISDIR
      fs.mkdirSync(path.join(dir, "backup"));
      fs.writeFileSync(path.join(dir, "key.json"), "1");

      expect(() => storage.initSync({ dir: dir })).not.toThrow();
      expect(storage.getItem("backup")).toBeUndefined();
      expect(storage.getItem("key.json")).toEqual(1);
    });

    itWithSymlinks("should ignore a symlink pointing at a directory, which does not report as one", () => {
      // a symlink is not a directory to readdir, so it would otherwise reach readFileSync and throw EISDIR
      fs.mkdirSync(path.join(dir, "backup"));
      fs.symlinkSync(path.join(dir, "backup"), path.join(dir, "backup-link"));
      fs.writeFileSync(path.join(dir, "key.json"), "1");

      expect(() => storage.initSync({ dir: dir })).not.toThrow();
      expect(storage.getItem("backup-link")).toBeUndefined();
      expect(storage.getItem("key.json")).toEqual(1);
    });

    itWithSymlinks("should still load a symlink pointing at a file", () => {
      fs.writeFileSync(path.join(dir, "target.json"), "1");
      fs.symlinkSync(path.join(dir, "target.json"), path.join(dir, "link.json"));

      storage.initSync({ dir: dir });
      expect(storage.getItem("link.json")).toEqual(1);
    });

    itWithSymlinks("should ignore a symlink pointing at nothing rather than failing on it", () => {
      fs.symlinkSync(path.join(dir, "missing.json"), path.join(dir, "dangling.json"));
      fs.writeFileSync(path.join(dir, "key.json"), "1");

      expect(() => storage.initSync({ dir: dir })).not.toThrow();
      expect(storage.getItem("dangling.json")).toBeUndefined();
      expect(storage.getItem("key.json")).toEqual(1);
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

    it("should leave no temporary file behind after writing atomically", () => {
      storage.setItemSync("key.json", { a: 1 });
      expect(fs.readdirSync(dir)).toEqual(["key.json"]);
    });

    it("should keep the previous contents intact when serializing the new value fails", () => {
      storage.setItemSync("key.json", { a: 1 });
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => storage.setItemSync("key.json", circular)).toThrow();
      expect(fs.readFileSync(path.join(dir, "key.json"), "utf8")).toEqual("{\"a\":1}");
      expect(fs.readdirSync(dir)).toEqual(["key.json"]);
    });

    it("should keep the previous in-memory value when the write fails, so memory matches the disk", () => {
      storage.setItemSync("key.json", { a: 1 });
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => storage.setItemSync("key.json", circular)).toThrow();
      // everything is served from memory, so a cached value which never reached the disk reads as saved until a restart
      expect(storage.getItem("key.json")).toEqual({ a: 1 });
    });

    it("should not remember a key whose only write failed", () => {
      // renaming onto an existing directory fails, after the temporary file has been written
      fs.mkdirSync(path.join(dir, "occupied"));

      expect(() => storage.setItemSync("occupied", { a: 1 })).toThrow();
      expect(storage.getItem("occupied")).toBeUndefined();
    });

    it("should write the temporary file beside its target, as renaming across directories is not atomic", () => {
      const renameSync = jest.spyOn(fs, "renameSync");
      try {
        storage.setItemSync("key.json", { a: 1 });

        expect(renameSync).toHaveBeenCalledTimes(1);
        const [temporaryFile, file] = renameSync.mock.calls[0] as [string, string];
        expect(path.dirname(temporaryFile)).toEqual(path.dirname(file));
      } finally {
        renameSync.mockRestore();
      }
    });

    it("should recreate a storage directory which was removed at runtime, like node-persist 0.0.12", () => {
      // 0.0.12 did mkdirp.sync(path.dirname(file)) before every write
      fs.rmSync(dir, { recursive: true, force: true });

      storage.setItemSync("key.json", { a: 1 });
      expect(fs.readFileSync(path.join(dir, "key.json"), "utf8")).toEqual("{\"a\":1}");
    });

    it.each([
      ["a key naming a subdirectory", "nested/key.json"],
      ["a key containing a backslash", "nested\\key.json"],
      ["a key starting with a dot", ".hidden"],
      ["the parent directory", ".."],
      ["the storage directory itself", "."],
      ["an empty key", ""],
    ])("should reject %s instead of writing where it could never be read back", (_, key) => {
      // initSync skips both subdirectories and dotfiles, so such a value would silently come back undefined after a restart
      expect(() => storage.setItemSync(key, { a: 1 })).toThrow(/plain filename/);
      expect(fs.readdirSync(dir)).toEqual([]);
    });

    it("should reject a key escaping the storage directory rather than writing outside it", () => {
      const inner = new HAPFileStorage();
      inner.initSync({ dir: path.join(dir, "inner") });

      expect(() => inner.setItemSync(`..${path.sep}escaped.json`, { a: 1 })).toThrow(/plain filename/);
      expect(fs.readdirSync(dir)).toEqual(["inner"]);
    });

    it("should clean up the temporary file when replacing the target fails", () => {
      // renaming onto an existing directory fails, after the temporary file has been written
      fs.mkdirSync(path.join(dir, "occupied"));

      expect(() => storage.setItemSync("occupied", { a: 1 })).toThrow();
      // the temporary file is cleaned up rather than left behind in the user's storage directory
      expect(fs.readdirSync(dir)).toEqual(["occupied"]);
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

    // Regression: removeItemSync used to check existsSync and then unlinkSync.
    // Child bridges share one persist directory, so another process could delete
    // the file in the gap between those two calls, and the unlink then threw
    // ENOENT out of a synchronous teardown path. Simulated here by making the
    // existence check report a file that is not actually there - which is exactly
    // the state the race leaves behind.
    it("should not throw when the file disappears between the check and the removal", () => {
      storage.setItemSync("key.json", { a: 1 });
      fs.rmSync(path.join(dir, "key.json")); // the racing process got there first

      const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
      try {
        expect(() => storage.removeItemSync("key.json")).not.toThrow();
      } finally {
        existsSpy.mockRestore();
      }

      // and the in-memory entry still goes, so the two stores cannot drift apart
      expect(storage.getItem("key.json")).toBeUndefined();
    });

    it("should reject a key which is not a plain filename rather than unlinking outside the storage directory", () => {
      const inner = new HAPFileStorage();
      inner.initSync({ dir: path.join(dir, "inner") });
      fs.writeFileSync(path.join(dir, "victim.json"), "1");

      expect(() => inner.removeItemSync(`..${path.sep}victim.json`)).toThrow(/plain filename/);
      expect(fs.existsSync(path.join(dir, "victim.json"))).toBe(true);
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
