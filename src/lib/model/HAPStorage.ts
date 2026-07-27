import { accessSync, constants } from "node:fs";

import { HAPFileStorage } from "./HAPFileStorage";

/**
 * @group Model
 */
export class HAPStorage {

  private static readonly INSTANCE = new HAPStorage();

  private localStore?: HAPFileStorage;
  private customStoragePath?: string;

  public static storage(): HAPFileStorage {
    return this.INSTANCE.storage();
  }

  public static setCustomStoragePath(path: string): void {
    this.INSTANCE.setCustomStoragePath(path);
  }

  public storage(): HAPFileStorage {
    if (!this.localStore) {
      this.localStore = new HAPFileStorage();

      if (this.customStoragePath) {
        this.localStore.initSync({
          dir: this.customStoragePath,
        });
      } else {
        this.localStore.initSync();
      }

      this.checkStorageIsWritable();
    }

    return this.localStore;
  }

  /**
   * Warn early if the persist directory cannot be written to.
   *
   * Without this the first sign of trouble is a publish failing with an
   * unrelated-looking error, which is what happens when a container that
   * previously ran as root is switched to a non-root user and the existing
   * AccessoryInfo/IdentifierCache files stay owned by root.
   *
   * Only warns — an unwritable directory is not necessarily fatal at this
   * point, and throwing here would break consumers that never write.
   */
  private checkStorageIsWritable(): void {
    // HAPFileStorage resolves its directory during init and keeps it private;
    // read that rather than recomputing it, falling back to whatever we asked
    // for if the shape ever changes.
    const dir: string | undefined = (this.localStore as unknown as { dir?: string })?.dir
      ?? this.customStoragePath;

    if (!dir) {
      return;
    }

    try {
      accessSync(dir, constants.W_OK);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      // Only a permission problem is worth warning about. A missing directory
      // is not: HAPFileStorage creates it during init, so ENOENT here means we
      // are looking at a path it never used rather than a broken install.
      if (code !== "EACCES" && code !== "EPERM") {
        return;
      }

      console.warn(`HAP-NodeJS WARNING: The persist directory '${dir}' is not writable (${code}). `
        + "Accessories will fail to publish or will lose their pairing state. This usually means the files are "
        + "owned by a different user than the one running HAP-NodeJS — check the ownership and permissions of "
        + "that directory and its contents.");
    }
  }

  public setCustomStoragePath(path: string): void {
    if (this.localStore) {
      throw new Error("Cannot change storage path after it has already been initialized!");
    }

    this.customStoragePath = path;
  }

}
