import crypto from "crypto";
import fs from "fs";
import path from "path";
import createDebug from "debug";

const debug = createDebug("HAP-NodeJS:StorageMigration");

/**
 * StorageMigration handles migration between different node-persist storage formats.
 * 
 * node-persist version history:
 * - v0.0.12: Files stored with literal key names (e.g., "AccessoryInfo.CC223DE3CEF3.json")
 * - v1.0.0: Files stored as base64-encoded keys with / replaced by !
 * - v2.0.0: Files stored as MD5 hash of the key
 * - v4.0.0: Files stored as SHA256 hash of the key
 * 
 * @group Model
 */
export class StorageMigration {

  /**
   * Generates the SHA256 hash filename for a given key (node-persist v4 format)
   */
  private static generateV4Filename(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  /**
   * Generates the MD5 hash filename for a given key (node-persist v2 format)
   */
  private static generateV2Filename(key: string): string {
    return crypto.createHash("md5").update(key).digest("hex");
  }

  /**
   * Checks if a file exists in the old format (literal key name)
   */
  private static hasV0File(storageDir: string, key: string): boolean {
    const filePath = path.join(storageDir, key);
    return fs.existsSync(filePath);
  }

  /**
   * Checks if a file exists in the v2 format (MD5 hash)
   */
  private static hasV2File(storageDir: string, key: string): boolean {
    const filename = this.generateV2Filename(key);
    const filePath = path.join(storageDir, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Checks if a file exists in the v4 format (SHA256 hash)
   */
  private static hasV4File(storageDir: string, key: string): boolean {
    const filename = this.generateV4Filename(key);
    const filePath = path.join(storageDir, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Migrates a single file from v0 format to v4 format
   */
  private static async migrateFile(storageDir: string, key: string): Promise<boolean> {
    const oldPath = path.join(storageDir, key);
    const newFilename = this.generateV4Filename(key);
    const newPath = path.join(storageDir, newFilename);

    try {
      // Read old file
      const content = fs.readFileSync(oldPath, "utf8");
      const data = JSON.parse(content);

      // Write to new format with node-persist v4 structure
      const v4Data = {
        key: key,
        value: data,
      };
      fs.writeFileSync(newPath, JSON.stringify(v4Data), "utf8");

      debug("Migrated file: %s -> %s", key, newFilename);
      return true;
    } catch (error) {
      debug("Error migrating file %s: %s", key, error);
      return false;
    }
  }

  /**
   * Migrates a single file from v2 format to v4 format
   */
  private static async migrateV2File(storageDir: string, key: string): Promise<boolean> {
    const oldFilename = this.generateV2Filename(key);
    const oldPath = path.join(storageDir, oldFilename);
    const newFilename = this.generateV4Filename(key);
    const newPath = path.join(storageDir, newFilename);

    try {
      // Read old file
      const content = fs.readFileSync(oldPath, "utf8");
      const data = JSON.parse(content);

      // v2 format already has the structure we need, just copy it
      const v4Data = {
        key: key,
        value: data.value || data,
      };
      fs.writeFileSync(newPath, JSON.stringify(v4Data), "utf8");

      debug("Migrated v2 file: %s -> %s", oldFilename, newFilename);
      return true;
    } catch (error) {
      debug("Error migrating v2 file %s: %s", key, error);
      return false;
    }
  }

  /**
   * Detects which format a key is stored in and reads it
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async detectAndRead(storageDir: string, key: string): Promise<any> {
    // Try v4 format first (current)
    if (this.hasV4File(storageDir, key)) {
      const filename = this.generateV4Filename(key);
      const filePath = path.join(storageDir, filename);
      const content = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(content);
      return data.value;
    }

    // Try v2 format
    if (this.hasV2File(storageDir, key)) {
      const filename = this.generateV2Filename(key);
      const filePath = path.join(storageDir, filename);
      const content = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(content);
      // Migrate to v4 in the background
      this.migrateV2File(storageDir, key).catch(err => {
        debug("Background migration from v2 failed for %s: %s", key, err);
      });
      return data.value || data;
    }

    // Try v0 format (legacy)
    if (this.hasV0File(storageDir, key)) {
      const filePath = path.join(storageDir, key);
      const content = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(content);
      // Migrate to v4 in the background
      this.migrateFile(storageDir, key).catch(err => {
        debug("Background migration from v0 failed for %s: %s", key, err);
      });
      return data;
    }

    // File doesn't exist in any format
    return undefined;
  }

  /**
   * Migrates all storage files from v0/v2 format to v4 format
   * This should be called once during application startup
   * 
   * @param storageDir - The storage directory to migrate
   * @param cleanupOldFiles - If true, deletes old format files after successful migration (default: false)
   */
  public static async migrateStorageDirectory(storageDir: string, cleanupOldFiles = false): Promise<void> {
    if (!fs.existsSync(storageDir)) {
      debug("Storage directory does not exist: %s", storageDir);
      return;
    }

    const files = fs.readdirSync(storageDir);
    let migratedCount = 0;
    let skippedCount = 0;

    debug("Starting migration of storage directory: %s", storageDir);
    debug("Found %d files", files.length);
    if (cleanupOldFiles) {
      debug("Cleanup mode enabled - old files will be deleted after migration");
    }

    for (const file of files) {
      // Skip already migrated files (64-char hex strings are SHA256 hashes)
      if (/^[a-f0-9]{64}$/.test(file)) {
        skippedCount++;
        continue;
      }

      // Skip MD5 hashes (32-char hex strings)
      if (/^[a-f0-9]{32}$/.test(file)) {
        // Try to read and migrate v2 file
        // We need to determine the original key, which is stored in the file
        try {
          const filePath = path.join(storageDir, file);
          const content = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(content);
          if (data.key) {
            await this.migrateV2File(storageDir, data.key);
            migratedCount++;
          }
        } catch (error) {
          debug("Could not migrate MD5 file %s: %s", file, error);
        }
        continue;
      }

      // This is a v0 format file (literal key name)
      const migrated = await this.migrateFile(storageDir, file);
      if (migrated) {
        migratedCount++;
      }
    }

    debug("Migration complete: %d files migrated, %d files skipped", migratedCount, skippedCount);

    // Cleanup old files if requested
    if (cleanupOldFiles && migratedCount > 0) {
      debug("Cleaning up old format files...");
      await this.cleanupOldFiles(storageDir);
    }
  }

  /**
   * Deletes old format files after successful migration
   * WARNING: This is destructive and should only be called after verifying migration success
   */
  public static async cleanupOldFiles(storageDir: string): Promise<void> {
    if (!fs.existsSync(storageDir)) {
      return;
    }

    const files = fs.readdirSync(storageDir);
    let deletedCount = 0;

    for (const file of files) {
      // Only delete v0 format files (not hex strings)
      if (!/^[a-f0-9]+$/.test(file)) {
        const filePath = path.join(storageDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          debug("Deleted old format file: %s", file);
        } catch (error) {
          debug("Error deleting file %s: %s", file, error);
        }
      }
    }

    debug("Cleanup complete: %d old files deleted", deletedCount);
  }
}
