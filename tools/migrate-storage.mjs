#!/usr/bin/env node

/**
 * HAP-NodeJS Storage Migration Tool
 * 
 * This tool migrates storage files from node-persist v0.0.12 format to v4.0.4 format.
 * 
 * Usage:
 *   node migrate-storage.js [storage-directory]
 *   node migrate-storage.js --cleanup [storage-directory]
 * 
 * If no directory is specified, uses the default: .node-persist/storage
 * 
 * Options:
 *   --cleanup    Delete old format files after successful migration
 */

import { StorageMigration } from "../dist/lib/model/StorageMigration.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let cleanupMode = false;
  let storageDir = null;
  
  for (const arg of args) {
    if (arg === "--cleanup") {
      cleanupMode = true;
    } else if (!arg.startsWith("--")) {
      storageDir = arg;
    }
  }
  
  if (!storageDir) {
    storageDir = path.join(process.cwd(), ".node-persist/storage");
  }

  console.log("HAP-NodeJS Storage Migration Tool");
  console.log("==================================");
  console.log();
  console.log("Storage directory:", storageDir);
  if (cleanupMode) {
    console.log("Cleanup mode: ENABLED (old files will be deleted)");
    console.log();
    console.log("⚠️  WARNING: This will permanently delete old format files!");
    console.log("   Make sure you have a backup before proceeding.");
    console.log();
  } else {
    console.log("Cleanup mode: DISABLED (old files will be preserved)");
  }
  console.log();

  try {
    console.log("Starting migration...");
    await StorageMigration.migrateStorageDirectory(storageDir, cleanupMode);
    console.log();
    console.log("✓ Migration completed successfully!");
    console.log();
    
    if (!cleanupMode) {
      console.log("IMPORTANT: Old format files have been preserved for safety.");
      console.log("After verifying your setup works correctly, you can clean them up with:");
      console.log(`  node migrate-storage.js --cleanup "${storageDir}"`);
    } else {
      console.log("Old format files have been deleted.");
    }
    console.log();
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
