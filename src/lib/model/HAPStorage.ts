// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import storage, { LocalStorage } from "node-persist";
import { StorageMigration } from "./StorageMigration";
import { StorageInterface } from "./StorageInterface";
import path from "path";

/**
 * Adapter to wrap node-persist LocalStorage to match StorageInterface
 * Provides backward compatibility by falling back to detectAndRead for legacy formats
 */
class NodePersistStorageAdapter implements StorageInterface {
  constructor(
    private localStore: LocalStorage,
    private storageDir: string,
  ) {}

  async getItem(key: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Try v4 format first via node-persist
    const value = await this.localStore.getItem(key);
    
    // If not found, fall back to detectAndRead for backward compatibility with legacy formats
    if (value === undefined) {
      return StorageMigration.detectAndRead(this.storageDir, key);
    }
    
    return value;
  }

  async setItem(key: string, value: any): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.localStore.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this.localStore.removeItem(key);
  }
}

/**
 * @group Model
 */
export class HAPStorage {

  private static readonly INSTANCE = new HAPStorage();
  private static migrationComplete = false;
  private static migrationPromise?: Promise<void>;
  private static cleanupOldFiles = false;
  private static customStorageInstance?: StorageInterface;

  private localStore?: LocalStorage;
  private storageAdapter?: StorageInterface;
  private customStoragePath?: string;

  /**
   * Get the storage interface.
   * Returns custom storage if set, otherwise returns node-persist storage.
   */
  public static storage(): StorageInterface {
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

  /**
   * Set a custom storage implementation.
   * This allows you to plug in your own storage backend instead of using node-persist.
   * Must be called before the first call to storage().
   * 
   * @param customStorage - Your custom storage implementation that implements StorageInterface
   * 
   * @example
   * ```typescript
   * class MyStorage implements StorageInterface {
   *   async getItem(key: string): Promise<any> { ... }
   *   async setItem(key: string, value: any): Promise<void> { ... }
   *   async removeItem(key: string): Promise<void> { ... }
   * }
   * 
   * HAPStorage.setCustomStorage(new MyStorage());
   * ```
   */
  public static setCustomStorage(customStorage: StorageInterface): void {
    if (this.INSTANCE.storageAdapter) {
      throw new Error("Cannot change storage implementation after it has already been initialized!");
    }
    this.customStorageInstance = customStorage;
  }

  public storage(): StorageInterface {
    // If custom storage is set, use it
    if (HAPStorage.customStorageInstance) {
      if (!this.storageAdapter) {
        this.storageAdapter = HAPStorage.customStorageInstance;
        // Note: Migration is not run for custom storage implementations
        // Users are responsible for handling their own data migration
      }
      return this.storageAdapter;
    }

    // Otherwise, use node-persist (default behavior)
    if (!this.storageAdapter) {
      this.localStore = storage.create();

      if (this.customStoragePath) {
        this.localStore.initSync({
          dir: this.customStoragePath,
        });
      } else {
        this.localStore.initSync();
      }

      // Wrap node-persist in adapter with storage directory for backward compatibility
      this.storageAdapter = new NodePersistStorageAdapter(
        this.localStore,
        this.customStoragePath || path.join(process.cwd(), ".node-persist/storage"),
      );

      // Run migration once after initialization (only for node-persist)
      // Migration runs in background, but detectAndRead provides fallback for legacy formats
      if (!HAPStorage.migrationComplete) {
        HAPStorage.migrationComplete = true;
        const storageDir = this.customStoragePath || path.join(process.cwd(), ".node-persist/storage");
        
        // Start migration in background
        // Note: detectAndRead in StorageMigration provides backward compatibility
        // for reading legacy format files even before migration completes
        StorageMigration.migrateStorageDirectory(storageDir, HAPStorage.cleanupOldFiles).catch(err => {
          console.error("Storage migration failed:", err);
        });
      }
    }

    return this.storageAdapter;
  }

  public setCustomStoragePath(path: string): void {
    if (this.localStore || this.storageAdapter) {
      throw new Error("Cannot change storage path after it has already been initialized!");
    }

    this.customStoragePath = path;
  }

}
