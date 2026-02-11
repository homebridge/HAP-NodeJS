# HAP-NodeJS Storage Migration Guide

## Overview

HAP-NodeJS v3.0.0 upgrades the `node-persist` dependency from v0.0.12 to v4.0.4 to remove the deprecated `q` promise library. This upgrade changes how storage files are named on disk, requiring a one-time migration.

## What Changed

### File Naming Format

| Version | File Format | Example |
|---------|-------------|---------|
| v0.0.12 (old) | Literal key name | `AccessoryInfo.CC223DE3CEF3.json` |
| v4.0.4 (new) | SHA256 hash of key | `bced6ef4c848bd19798ac8f750e748d4449355b75ae9b9b5f8a5aaa68a167646` |

### Why This Matters

- **HomeKit Pairings**: All pairing information is stored in these files
- **Identifier Cache**: Device IDs and instance IDs are cached here
- **Controller Data**: Bridge and accessory controller state is persisted
- **Config-UI-X**: The Homebridge Config UI also reads these files

## Migration Process

### Automatic Migration (Recommended)

HAP-NodeJS v3.0.0+ automatically migrates storage files on first startup:

1. **Detection**: On startup, HAP-NodeJS detects old format files
2. **Migration**: Files are copied to the new format
3. **Preservation**: Old files are kept for safety
4. **Transparent**: Your accessories continue to work without re-pairing

**No manual action required** - the migration happens automatically!

### Manual Migration (Advanced)

If you prefer to migrate before upgrading or need to migrate multiple directories:

```bash
# Install HAP-NodeJS v3.0.0+
npm install @homebridge/hap-nodejs@latest

# Build the project (if using from source)
npm run build

# Run migration tool
node tools/migrate-storage.mjs [path-to-storage-directory]

# Default location (if no path specified):
# .node-persist/storage
```

### Verify Migration

After migration, both old and new format files will exist:

```bash
# Check storage directory
ls -la .node-persist/storage/

# You should see:
# - Old format: AccessoryInfo.*.json, IdentifierCache.*.json, etc.
# - New format: 64-character hex filenames (SHA256 hashes)
```

### Cleanup Old Files (Optional)

After verifying your setup works correctly with the new version:

**⚠️ WARNING: This is destructive. Only do this after thorough testing!**

**Option 1: Using Migration Tool (Recommended)**
```bash
# Use the migration tool with --cleanup flag
node tools/migrate-storage.mjs --cleanup [path-to-storage-directory]

# Or with default location:
node tools/migrate-storage.mjs --cleanup
```

**Option 2: Using API (Programmatic)**
```typescript
import { HAPStorage } from "@homebridge/hap-nodejs";

// Enable cleanup before initializing storage
HAPStorage.setCleanupOldFiles(true);

// Initialize storage (migration with cleanup will run automatically)
HAPStorage.storage();
```

**Option 3: Manual Cleanup**
```bash
# Remove old format files manually
cd .node-persist/storage
rm *.json  # or be more selective

# The application will continue using the new format files
```

**Important Notes:**
- By default, old files are **preserved** for safety
- Cleanup is **disabled** unless explicitly enabled
- Old files are only deleted if migration was successful
- Backup your storage directory before enabling cleanup

## For Plugin Developers

### If Your Plugin Uses HAPStorage

If your plugin uses HAP-NodeJS's storage system, no code changes are needed! The migration is transparent.

### Custom Storage Implementation (New in v3.0.0)

HAP-NodeJS v3.0.0 introduces support for custom storage implementations using dependency injection. This allows you to plug in your own storage backend instead of using node-persist.

**Implementing Custom Storage:**

```typescript
import { StorageInterface, HAPStorage } from "@homebridge/hap-nodejs";

class MyDatabaseStorage implements StorageInterface {
  private db: MyDatabase;

  constructor(database: MyDatabase) {
    this.db = database;
  }

  async getItem(key: string): Promise<any> {
    return await this.db.query('SELECT value FROM storage WHERE key = ?', [key]);
  }

  async setItem(key: string, value: any): Promise<void> {
    await this.db.query('INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)', 
      [key, JSON.stringify(value)]);
  }

  async removeItem(key: string): Promise<void> {
    await this.db.query('DELETE FROM storage WHERE key = ?', [key]);
  }
}

// Set your custom storage BEFORE any HAP-NodeJS initialization
const myStorage = new MyDatabaseStorage(myDb);
HAPStorage.setCustomStorage(myStorage);

// Now HAP-NodeJS will use your storage for all persistence
```

**Important Notes:**
- Custom storage must be set **before** the first call to `HAPStorage.storage()`
- Custom storage implementations are responsible for their own data migration
- The automatic node-persist migration only runs for the default storage
- Custom storage must implement all three methods: `getItem`, `setItem`, `removeItem`
- All methods must return Promises

**Use Cases:**
- Integration with existing database systems
- Multi-branch configuration support
- Custom backup/restore mechanisms
- Centralized storage across multiple instances
- Advanced caching strategies

### If Your Plugin Reads Files Directly

If your plugin reads storage files directly (not recommended), you need to update:

**Before:**
```typescript
import fs from "fs";
import path from "path";

// Old: Direct file access
const filePath = path.join(storageDir, "AccessoryInfo.CC223DE3CEF3.json");
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
```

**After:**
```typescript
import { HAPStorage } from "@homebridge/hap-nodejs";

// New: Use HAP storage API
const data = await HAPStorage.storage().getItem("AccessoryInfo.CC223DE3CEF3.json");
```

### If Your Plugin Manages Storage Directories

If your plugin (like homebridge-config-ui-x) manages or displays storage:

1. Update to use SHA256 hashing for new format files
2. Add support for detecting both formats during transition
3. Use the `StorageMigration` class for compatibility:

```typescript
import { StorageMigration } from "@homebridge/hap-nodejs";

// Automatically handles both old and new formats
const data = await StorageMigration.detectAndRead(storageDir, key);
```

## Troubleshooting

### Migration Fails

If automatic migration fails:

1. **Check Permissions**: Ensure the storage directory is writable
2. **Check Disk Space**: Ensure sufficient space (migration doubles storage temporarily)
3. **Check File Integrity**: Old files must be valid JSON

### Lost Pairings

If you lose HomeKit pairings after upgrade:

1. **Verify Old Files Exist**: Check that old format files weren't deleted
2. **Manual Recovery**: Restore from backup if available
3. **Re-pair**: As a last resort, remove and re-add accessories to HomeKit

### Homebridge Config UI Issues

If Config UI can't read storage:

1. **Update Config UI**: Ensure you're using a compatible version
2. **Check Paths**: Verify Config UI is looking in the right directory
3. **File Permissions**: Ensure Config UI has read access to new files

## Migration Timeline

### Phase 1: Compatibility (v3.0.0 - v3.x.x)

- Both formats supported
- Automatic migration on startup
- Old files preserved for safety

### Phase 2: Deprecation (v4.0.0+, future)

- Old format support deprecated
- Warning messages if old format detected
- Manual cleanup recommended

### Phase 3: Removal (v5.0.0+, future)

- Old format support removed
- Only new format supported
- Migration must be completed

## Rollback Procedure

If you need to rollback to HAP-NodeJS v2.x:

**⚠️ Important: Do this BEFORE cleaning up old files!**

1. **Keep Old Files**: Do not delete old format files
2. **Downgrade**: `npm install @homebridge/hap-nodejs@2.x`
3. **Restart**: Old version will use old format files
4. **No Data Loss**: Your pairings remain intact

**If you already cleaned up old files:**

1. **Manual Recovery**: Use SHA256 to filename mapping if available
2. **Read New Format**: Write a script to read new format and recreate old format
3. **Re-pair**: May need to re-pair accessories

## For Homebridge Users

### Standard Installation

If you're using Homebridge:

1. **Update Homebridge**: `npm install -g homebridge@latest`
2. **Update Config UI**: `npm install -g homebridge-config-ui-x@latest`
3. **Restart**: Migration happens automatically

### Docker Installation

Docker images will handle migration automatically on container restart.

### HOOBS Users

Follow HOOBS-specific update procedures. Migration is automatic.

## Support

### Getting Help

- **GitHub Issues**: [HAP-NodeJS Issues](https://github.com/homebridge/HAP-NodeJS/issues)
- **Homebridge Discord**: [discord.gg/homebridge](https://discord.gg/homebridge)
- **Homebridge Reddit**: [r/homebridge](https://reddit.com/r/homebridge)

### Reporting Migration Issues

When reporting issues, include:

1. HAP-NodeJS version (before and after)
2. Node.js version
3. Operating system
4. Storage directory location
5. Error messages from migration
6. List of storage files (before and after)

## Technical Details

### Storage Format Specification

**Old Format (v0.0.12):**
```
Filename: {key}
Content: {value as JSON}
```

**New Format (v4.0.4):**
```
Filename: SHA256({key})
Content: {"key": "{key}", "value": {value as JSON}}
```

### Migration Algorithm

1. Scan storage directory
2. Identify format by filename pattern:
   - Literal: v0 format
   - 32-char hex: v2 format (MD5)
   - 64-char hex: v4 format (SHA256)
3. For each old format file:
   - Read and parse JSON
   - Generate new filename (SHA256)
   - Write in new format
   - Keep old file

### Performance Impact

- **One-time Cost**: Migration runs once on first startup
- **Storage Space**: 2x space during transition (old + new files)
- **Runtime**: Negligible after migration completes
- **Cleanup**: Recovering space requires manual cleanup

## Best Practices

1. **Backup First**: Always backup storage directory before upgrading
2. **Test Before Production**: Test migration on non-critical systems first
3. **Monitor Logs**: Check logs for migration warnings or errors
4. **Keep Old Files**: Don't delete old files until thoroughly tested
5. **Update Dependencies**: Ensure all plugins are compatible with v3.0.0+

## FAQ

**Q: Do I need to re-pair my accessories?**  
A: No, migration preserves all pairing information.

**Q: Will my custom storage paths work?**  
A: Yes, custom paths set via `HAPStorage.setCustomStoragePath()` are supported.

**Q: Can I upgrade multiple servers at once?**  
A: Yes, but backup each server's storage directory first.

**Q: What if I have terabytes of storage files?**  
A: Migration processes files sequentially. Time depends on file count, not size.

**Q: Do I need to stop Homebridge during migration?**  
A: No, migration is safe to run while Homebridge is running.

**Q: Can I use the old and new versions simultaneously?**  
A: Not recommended. Stick with one version to avoid file conflicts.

## Version Compatibility Matrix

| HAP-NodeJS | node-persist | q Library | Migration Required | Old Format Support |
|------------|--------------|-----------|--------------------|--------------------|
| v2.x | v0.0.12 | Yes (deprecated) | N/A | Native format |
| v3.x | v4.0.4 | No | Automatic | Yes (compatibility) |
| v4.x (future) | v4.0.4+ | No | Required | Deprecated |
| v5.x (future) | v4.0.4+ | No | Required | No |

## Changelog

### v3.0.0
- Upgraded node-persist from v0.0.12 to v4.0.4
- Removed deprecated q dependency
- Added automatic storage migration
- Added manual migration tool
- Backwards compatible with old storage format

## License

This migration guide is part of HAP-NodeJS, licensed under Apache-2.0.
