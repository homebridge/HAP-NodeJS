import fs from "node:fs";
import path from "node:path";

/**
 * Init options supported by {@link HAPFileStorage.initSync}.
 *
 * This is the subset of node-persist's init options which was ever functional for HAP-NodeJS's storage.
 * Passing any other node-persist option throws instead of being silently ignored.
 *
 * @group Model
 */
export interface HAPFileStorageInitOptions {
  /**
   * Path of the storage directory. If provided, it must be an absolute path.
   * If omitted, storage defaults to the directory `persist` inside the current working directory.
   */
  dir?: string;
}

const SUPPORTED_METHODS = "initSync, getItem, setItemSync and removeItemSync";

/**
 * Every method of node-persist 0.0.12's `LocalStorage` prototype which {@link HAPFileStorage} does not implement.
 * They are assigned as throwing stubs in the constructor, so code depending on the removed node-persist API
 * fails with a clear error instead of exhibiting undefined behavior.
 */
const UNSUPPORTED_METHODS = [
  "setOptions", "init", "key", "keys", "length", "forEach", "values", "valuesWithKeyMatch",
  "setItem", "getItemSync", "removeItem", "clear", "clearSync", "persist", "persistSync",
  "persistKey", "persistKeySync", "removePersistedKey", "removePersistedKeySync",
  "parseString", "parseTTLDir", "parseTTLDirSync", "parseDataDir", "parseDataDirSync",
  "parseDir", "parseDirSync", "parseDataFile", "parseDataFileSync", "parseTTLFile",
  "parseTTLFileSync", "parseFile", "parseFileSync", "isExpired", "resolveDir",
  "stopInterval", "log",
] as const;

/**
 * Minimal synchronous file storage, a drop-in replacement for the subset of `node-persist@0.0.12`
 * which HAP-NodeJS used: `initSync`, `getItem`, `setItemSync` and `removeItemSync`.
 *
 * The on-disk layout is kept byte-for-byte compatible with node-persist 0.0.12:
 * one file per key inside the storage directory, named after the raw key (no hashing or escaping),
 * containing the bare `JSON.stringify` representation of the value. Values are read once
 * at {@link initSync} and served from memory afterwards.
 *
 * Writes are atomic, which node-persist's were not: see {@link setItemSync}.
 *
 * @group Model
 */
export class HAPFileStorage {

  // node-persist 0.0.12 default: the relative directory "persist", resolved against the current working directory
  private dir = "persist";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly data = new Map<string, any>();

  constructor() {
    for (const method of UNSUPPORTED_METHODS) {
      // runtime-only stubs, deliberately absent from the class type: TypeScript consumers get a compile error,
      // JavaScript consumers get this error instead of "storage.keys is not a function"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)[method] = () => {
        throw new Error(`${method}() is not supported anymore: HAP-NodeJS replaced node-persist with a minimal file storage ` +
          `which only implements ${SUPPORTED_METHODS} (see https://github.com/homebridge/HAP-NodeJS/issues/1107).`);
      };
    }
  }

  initSync(options?: HAPFileStorageInitOptions): void {
    if (options) {
      const unsupportedOptions = Object.keys(options).filter(key => key !== "dir");
      if (unsupportedOptions.length > 0) {
        throw new Error(`HAP-NodeJS's storage does not support the init options: ${unsupportedOptions.join(", ")}. ` +
          "Only \"dir\" is supported (see https://github.com/homebridge/HAP-NodeJS/issues/1107).");
      }

      if ("dir" in options) {
        if (typeof options.dir !== "string" || !path.isAbsolute(options.dir)) {
          // node-persist silently redirected relative paths into its own module directory inside node_modules,
          // where the data was lost on the next npm install. There is no sane location to keep that behavior.
          throw new Error(`HAP-NodeJS's storage requires an absolute storage path, got ${JSON.stringify(options.dir)}!`);
        }
        this.dir = path.normalize(options.dir);
      }
    }

    if (fs.existsSync(this.dir)) {
      for (const entry of fs.readdirSync(this.dir, { withFileTypes: true })) {
        // directories are skipped: reading one would abort startup with a cryptic EISDIR
        if (entry.name.startsWith(".") || entry.isDirectory()) {
          continue;
        }

        this.data.set(entry.name, HAPFileStorage.parse(fs.readFileSync(path.join(this.dir, entry.name), "utf8")));
      }
    } else {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  /**
   * Returns the in-memory value for the given key.
   * node-persist's legacy `getItem(key, callback)` form throws, like every other removed API.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItem(key: string, ...legacyCallback: never[]): any {
    if (legacyCallback.length > 0) {
      throw new Error("getItem() with a callback is not supported anymore: HAP-NodeJS replaced node-persist with a minimal file storage " +
        `which only implements ${SUPPORTED_METHODS} (see https://github.com/homebridge/HAP-NodeJS/issues/1107).`);
    }

    return this.data.get(key);
  }

  /**
   * Persists the given value, replacing the file for this key atomically.
   *
   * The value is written to a temporary file which is then renamed over the target, so an interrupted write
   * leaves the previous contents intact instead of a truncated file. This matters because a truncated
   * `AccessoryInfo` file reads back as an accessory which lost its pairings.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  setItemSync(key: string, value: any): void {
    this.data.set(key, value);

    const file = path.join(this.dir, key);
    const directory = path.dirname(file);
    fs.mkdirSync(directory, { recursive: true });

    // the dot prefix keeps a temporary file left behind by a crash from being loaded as a key by initSync,
    // the pid keeps processes sharing a storage directory (like child bridges) from racing on the same temporary file
    const temporaryFile = path.join(directory, `.${path.basename(file)}.${process.pid}.tmp`);

    try {
      fs.writeFileSync(temporaryFile, JSON.stringify(value));
      fs.renameSync(temporaryFile, file);
    } catch (error) {
      try {
        fs.unlinkSync(temporaryFile);
      } catch {
        // the temporary file may never have been created, in which case there is nothing to clean up
      }

      throw error;
    }
  }

  removeItemSync(key: string): void {
    const file = path.join(this.dir, key);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }

    this.data.delete(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static parse(json: string): any {
    try {
      return JSON.parse(json);
    } catch {
      // node-persist 0.0.12 swallowed unparseable files, leaving the value undefined
      return undefined;
    }
  }

}
