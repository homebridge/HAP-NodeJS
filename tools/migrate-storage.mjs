#!/usr/bin/env node

/**
 * HAP-NodeJS Storage Migration Tool
 * 
 * This tool migrates storage files from node-persist v0.0.12 format to v4.0.4 format.
 * 
 * Usage:
 *   node migrate-storage.js [storage-directory]
 * 
 * If no directory is specified, uses the default: .node-persist/storage
 */

import { StorageMigration } from "../dist/lib/model/StorageMigration.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  const storageDir = args[0] || path.join(process.cwd(), ".node-persist/storage");

  console.log("HAP-NodeJS Storage Migration Tool");
  console.log("==================================");
  console.log();
  console.log("Storage directory:", storageDir);
  console.log();

  try {
    console.log("Starting migration...");
    await StorageMigration.migrateStorageDirectory(storageDir);
    console.log();
    console.log("✓ Migration completed successfully!");
    console.log();
    console.log("IMPORTANT: Please test your setup before deleting old files.");
    console.log("Old format files are kept for safety. To clean them up, run:");
    console.log("  node migrate-storage.js --cleanup [storage-directory]");
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
