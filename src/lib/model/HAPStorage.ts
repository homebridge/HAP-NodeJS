// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import storage, { LocalStorage } from "node-persist";
import { StorageMigration } from "./StorageMigration";
import path from "path";

/**
 * @group Model
 */
export class HAPStorage {

  private static readonly INSTANCE = new HAPStorage();
  private static migrationComplete = false;
  private static cleanupOldFiles = false;

  private localStore?: LocalStorage;
  private customStoragePath?: string;

  public static storage(): LocalStorage {
    return this.INSTANCE.storage();
  }

  public static setCustomStoragePath(path: string): void {
    this.INSTANCE.setCustomStoragePath(path);
  }

  /**
   * Enable automatic cleanup of old format files after migration.
   * WARNING: This is destructive. Old files will be permanently deleted after migration.
   * Should only be enabled after verifying migration was successful.
   * 
   * @param cleanup - Set to true to enable automatic cleanup of old files
   */
  public static setCleanupOldFiles(cleanup: boolean): void {
    this.cleanupOldFiles = cleanup;
  }

  public storage(): LocalStorage {
    if (!this.localStore) {
      this.localStore = storage.create();

      if (this.customStoragePath) {
        this.localStore.initSync({
          dir: this.customStoragePath,
        });
      } else {
        this.localStore.initSync();
      }

      // Run migration once after initialization
      if (!HAPStorage.migrationComplete) {
        HAPStorage.migrationComplete = true;
        const storageDir = this.customStoragePath || path.join(process.cwd(), ".node-persist/storage");
        StorageMigration.migrateStorageDirectory(storageDir, HAPStorage.cleanupOldFiles).catch(err => {
          console.error("Storage migration failed:", err);
        });
      }
    }

    return this.localStore;
  }

  public setCustomStoragePath(path: string): void {
    if (this.localStore) {
      throw new Error("Cannot change storage path after it has already been initialized!");
    }

    this.customStoragePath = path;
  }

}
