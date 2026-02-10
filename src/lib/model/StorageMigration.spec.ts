import { StorageMigration } from "./StorageMigration";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

describe("StorageMigration", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hap-storage-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("File Format Detection", () => {
    it("should detect v0 format files (literal keys)", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const data = { test: "data" };
      
      // Create v0 format file
      fs.writeFileSync(path.join(tempDir, key), JSON.stringify(data));

      const result = await StorageMigration.detectAndRead(tempDir, key);
      expect(result).toEqual(data);
    });

    it("should detect v4 format files (SHA256 hash)", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const data = { test: "data" };
      const filename = crypto.createHash("sha256").update(key).digest("hex");
      
      // Create v4 format file
      const v4Data = { key, value: data };
      fs.writeFileSync(path.join(tempDir, filename), JSON.stringify(v4Data));

      const result = await StorageMigration.detectAndRead(tempDir, key);
      expect(result).toEqual(data);
    });

    it("should return undefined for non-existent files", async () => {
      const result = await StorageMigration.detectAndRead(tempDir, "NonExistent.json");
      expect(result).toBeUndefined();
    });
  });

  describe("Migration", () => {
    it("should migrate v0 format to v4 format", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const data = { displayName: "Test Accessory", pincode: "123-45-678" };
      
      // Create v0 format file
      fs.writeFileSync(path.join(tempDir, key), JSON.stringify(data));

      // Run migration
      await StorageMigration.migrateStorageDirectory(tempDir);

      // Check v4 file exists
      const v4Filename = crypto.createHash("sha256").update(key).digest("hex");
      const v4FilePath = path.join(tempDir, v4Filename);
      expect(fs.existsSync(v4FilePath)).toBe(true);

      // Verify content
      const v4Content = JSON.parse(fs.readFileSync(v4FilePath, "utf8"));
      expect(v4Content.key).toBe(key);
      expect(v4Content.value).toEqual(data);
    });

    it("should migrate multiple files", async () => {
      const files = [
        { key: "AccessoryInfo.AA11BB22CC33.json", data: { displayName: "Accessory 1" } },
        { key: "IdentifierCache.AA11BB22CC33.json", data: { cache: {} } },
        { key: "ControllerStorage.AA11BB22CC33.json", data: { accessories: {} } },
      ];

      // Create v0 format files
      files.forEach(file => {
        fs.writeFileSync(path.join(tempDir, file.key), JSON.stringify(file.data));
      });

      // Run migration
      await StorageMigration.migrateStorageDirectory(tempDir);

      // Verify all files migrated
      files.forEach(file => {
        const v4Filename = crypto.createHash("sha256").update(file.key).digest("hex");
        const v4FilePath = path.join(tempDir, v4Filename);
        expect(fs.existsSync(v4FilePath)).toBe(true);

        const v4Content = JSON.parse(fs.readFileSync(v4FilePath, "utf8"));
        expect(v4Content.key).toBe(file.key);
        expect(v4Content.value).toEqual(file.data);
      });
    });

    it("should skip already migrated files", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const data = { test: "data" };
      const v4Filename = crypto.createHash("sha256").update(key).digest("hex");
      
      // Create v4 format file (already migrated)
      const v4Data = { key, value: data };
      fs.writeFileSync(path.join(tempDir, v4Filename), JSON.stringify(v4Data));

      // Run migration (should skip)
      await StorageMigration.migrateStorageDirectory(tempDir);

      // Verify file unchanged
      const v4Content = JSON.parse(fs.readFileSync(path.join(tempDir, v4Filename), "utf8"));
      expect(v4Content).toEqual(v4Data);
    });

    it("should handle empty storage directory", async () => {
      // Run migration on empty directory
      await expect(StorageMigration.migrateStorageDirectory(tempDir)).resolves.not.toThrow();
    });

    it("should handle non-existent storage directory", async () => {
      const nonExistentDir = path.join(tempDir, "non-existent");
      
      // Run migration on non-existent directory
      await expect(StorageMigration.migrateStorageDirectory(nonExistentDir)).resolves.not.toThrow();
    });
  });

  describe("Backwards Compatibility", () => {
    it("should read v0 files and automatically migrate", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const data = { test: "data" };
      
      // Create v0 format file
      fs.writeFileSync(path.join(tempDir, key), JSON.stringify(data));

      // Read using detectAndRead (should trigger background migration)
      const result = await StorageMigration.detectAndRead(tempDir, key);
      expect(result).toEqual(data);

      // Wait a bit for async migration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify v4 file was created in background
      const v4Filename = crypto.createHash("sha256").update(key).digest("hex");
      const v4FilePath = path.join(tempDir, v4Filename);
      expect(fs.existsSync(v4FilePath)).toBe(true);
    });

    it("should prefer v4 format over v0 when both exist", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const oldData = { version: "old" };
      const newData = { version: "new" };
      
      // Create v0 format file
      fs.writeFileSync(path.join(tempDir, key), JSON.stringify(oldData));

      // Create v4 format file
      const v4Filename = crypto.createHash("sha256").update(key).digest("hex");
      const v4Data = { key, value: newData };
      fs.writeFileSync(path.join(tempDir, v4Filename), JSON.stringify(v4Data));

      // Should return v4 data (new format preferred)
      const result = await StorageMigration.detectAndRead(tempDir, key);
      expect(result).toEqual(newData);
    });
  });

  describe("Data Integrity", () => {
    it("should preserve complex nested data structures", async () => {
      const key = "AccessoryInfo.CC223DE3CEF3.json";
      const complexData = {
        displayName: "Test Accessory",
        category: 1,
        pincode: "123-45-678",
        signSk: "abc123",
        signPk: "def456",
        pairedClients: {
          "user1": { username: "user1", publicKey: "key1", permission: 1 },
          "user2": { username: "user2", publicKey: "key2", permission: 0 },
        },
        pairedClientsPermission: {
          "user1": 1,
          "user2": 0,
        },
        configVersion: 5,
        setupID: "ABCD",
      };
      
      // Create v0 format file
      fs.writeFileSync(path.join(tempDir, key), JSON.stringify(complexData));

      // Migrate
      await StorageMigration.migrateStorageDirectory(tempDir);

      // Verify data integrity
      const v4Filename = crypto.createHash("sha256").update(key).digest("hex");
      const v4Content = JSON.parse(fs.readFileSync(path.join(tempDir, v4Filename), "utf8"));
      expect(v4Content.value).toEqual(complexData);
    });

    it("should handle special characters in data", async () => {
      const key = "Test.json";
      const data = {
        text: "Special chars: émojis 🎉, quotes \"', backslashes \\, newlines \n",
        unicode: "日本語",
      };
      
      fs.writeFileSync(path.join(tempDir, key), JSON.stringify(data));
      await StorageMigration.migrateStorageDirectory(tempDir);

      const v4Filename = crypto.createHash("sha256").update(key).digest("hex");
      const v4Content = JSON.parse(fs.readFileSync(path.join(tempDir, v4Filename), "utf8"));
      expect(v4Content.value).toEqual(data);
    });
  });

  describe("Error Handling", () => {
    it("should handle corrupted JSON files gracefully", async () => {
      const key = "Corrupted.json";
      
      // Create corrupted file
      fs.writeFileSync(path.join(tempDir, key), "{ invalid json ]");

      // Migration should not throw
      await expect(StorageMigration.migrateStorageDirectory(tempDir)).resolves.not.toThrow();
    });

    it("should handle read-only files gracefully", async () => {
      const key = "ReadOnly.json";
      const data = { test: "data" };
      const filePath = path.join(tempDir, key);
      
      // Create file and make it read-only
      fs.writeFileSync(filePath, JSON.stringify(data));
      fs.chmodSync(filePath, 0o444);

      // Migration should not throw (v4 file creation might fail, but that's ok)
      await expect(StorageMigration.migrateStorageDirectory(tempDir)).resolves.not.toThrow();

      // Restore permissions for cleanup
      fs.chmodSync(filePath, 0o644);
    });
  });
});
