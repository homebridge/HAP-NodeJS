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

  private localStore?: LocalStorage;
  private customStoragePath?: string;

  public static storage(): LocalStorage {
    return this.INSTANCE.storage();
  }

  public static setCustomStoragePath(path: string): void {
    this.INSTANCE.setCustomStoragePath(path);
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
        StorageMigration.migrateStorageDirectory(storageDir).catch(err => {
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
