/**
 * Interface for custom storage implementations.
 * Implement this interface to provide your own storage backend for HAP-NodeJS.
 * 
 * @example
 * ```typescript
 * class MyCustomStorage implements StorageInterface {
 *   async getItem(key: string): Promise<any> {
 *     // Your implementation
 *   }
 *   
 *   async setItem(key: string, value: any): Promise<void> {
 *     // Your implementation
 *   }
 *   
 *   async removeItem(key: string): Promise<void> {
 *     // Your implementation
 *   }
 * }
 * 
 * // Use your custom storage
 * HAPStorage.setCustomStorage(new MyCustomStorage());
 * ```
 * 
 * @group Model
 */
export interface StorageInterface {
  /**
   * Retrieve an item from storage by key.
   * @param key - The key to retrieve
   * @returns The stored value, or undefined if not found
   */
  getItem(key: string): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  /**
   * Store an item in storage.
   * @param key - The key to store under
   * @param value - The value to store
   */
  setItem(key: string, value: any): Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any

  /**
   * Remove an item from storage by key.
   * @param key - The key to remove
   */
  removeItem(key: string): Promise<void>;
}
