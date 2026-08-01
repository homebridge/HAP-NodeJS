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
