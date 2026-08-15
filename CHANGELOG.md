# Change Log

All notable changes to `@homebridge/hap-nodejs` will be documented in this file. This project tries to adhere to [Semantic Versioning](http://semver.org/).

## v2.2.2 (Pending Release)

### Changes

- feat: log a debug line when the accessory configuration number increments
- fix: hash a canonical form of the configuration so array reordering cannot increment c#

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.12`
- `@homebridge/dbus-native` @ `v0.7.9`
- `bonjour-hap` @ `v3.10.5`

## v2.2.1 (2026-08-15)

### Changes

- refactor: drop the doubled advertiser check in the configuration-update debounce
- fix: close the exists-then-unlink gap when removing a storage key
- chore(deps): dependency updates
- docs: regenerate docs for `v2.2.1`

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.12`
- `@homebridge/dbus-native` @ `v0.7.9`
- `bonjour-hap` @ `v3.10.5`

## v2.2.0 (2026-08-08)

### ⚠️ Goodbye `node-persist`

- The long-unmaintained `node-persist` dependency has been replaced with a minimal file storage (#1125, thanks @tim-fin).
- **For users**: no action needed.
  - The on-disk format is unchanged — existing pairings and accessory data are read exactly as before, nothing is migrated or rewritten
  - Writes are now atomic: an interrupted write (power loss, crash) can no longer leave behind a corrupted file that loses your pairings
  - HAP-NodeJS now also warns at startup if the storage directory is not writable, instead of failing with an obscure error later
- **For developers** using `HAPStorage.storage()` directly: the returned object now only implements the methods HAP-NodeJS itself uses — `initSync`, `getItem`, `setItemSync` and `removeItemSync`. Everything else from the old `node-persist` API now throws a clear error explaining this change. Also note:
  - `initSync({ dir })` now requires an absolute path — `node-persist` silently redirected relative paths into `node_modules`, where the data was lost on the next install
  - Keys must be plain filenames — no slashes, no leading dot
- `getItem(key, callback)` (the legacy callback form) throws — use the plain `getItem(key)`
  - <details>
    <summary>Full list of removed methods:</summary>

    - `setOptions`
    - `init`
    - `key`
    - `keys`
    - `length`
    - `forEach`
    - `values`
    - `valuesWithKeyMatch`
    - `setItem`
    - `getItemSync`
    - `removeItem`
    - `clear[Sync]`
    - `persist[Sync]`
    - `persistKey[Sync]`
    - `removePersistedKey[Sync]`
    - `parseString`
    - `parseTTLDir[Sync]`
    - `parseDataDir[Sync]`
    - `parseDir[Sync]`
    - `parseDataFile[Sync]`
    - `parseTTLFile[Sync]`
    - `parseFile[Sync]`
    - `isExpired`
    - `resolveDir`
    - `stopInterval`
    - `log`
  </details>

### Changes

- fix: replace node-persist with minimal in-repo file storage (#1125) (@tim-fin)
- Update for NodeJS 26 (@NorthernMan54)
- feat: warn when the persist directory is not writable, instead of failing obscurely at publish (#1028)
- chore(deps): dependency updates
- docs: regenerate docs for `v2.2.0`

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.10`
- `@homebridge/dbus-native` @ `v0.7.7`
- `bonjour-hap` @ `v3.10.4`

## v2.1.9 (2026-07-18)

### Changes

- fix: test harness rewritten around a connection-owning HAP client, removing the axios dependency (#1122) (@hjdhjd)
- chore(ci): bump actions/setup-node to v7
- chore: dependency updates
- docs: regenerate docs for `v2.1.9`

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.10`
- `@homebridge/dbus-native` @ `v0.7.7`
- `bonjour-hap` @ `v3.10.4`

## v2.1.8 (2026-07-11)

### Changes

- test: work around Node free-socket data guard in HAP HTTP client
- chore: dependency updates
- chore: update `actions/checkout` to `v7`
- chore: added `deprecate-past-pre-releases` workflow
- chore: update hap characteristics and services
- docs: regenerate docs for `v2.1.8`

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.10`
- `@homebridge/dbus-native` @ `v0.7.7`
- `bonjour-hap` @ `v3.10.4`

## v2.1.7 (2026-05-26)

### Changes

- chore: dependency updates
- chore: drop local @types shims, use upstream bonjour-hap types
- chore(ci): bump release workflow action versions
- test: cover encrypted data length validation in pair handlers
- test: cover required TLV field validation in pairing handlers
- test: cover RTP proxy setup rejection handling
- test: cover SEQUENCE_NUM presence check in pair handlers
- test: cover M1 reset prevention in pair-setup
- test: cover safe accessory lookups in slow/timeout warnings
- test: cover aid.iid format validation
- test: cover camera stream start TLV parsing guards
- test: cover error argument in pairing debug logs
- test: cover constant-time pincode comparison
- test: cover characteristic warning message for non-Error throws
- fix: improve HomeKit `Name` characteristic validation (#1119) (@n0rt0nthec4t)
- docs: regenerate docs for `v2.1.7`

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.9`
- `@homebridge/dbus-native` @ `v0.7.6`
- `bonjour-hap` @ `v3.10.3`

## v2.1.6 (2026-05-08)

### Changes

- fix: defer `ControllerStorage` construction until UUID is set
- chore: route HKSV diagnostics through `HAP-NodeJS:HKSV` namespace
- chore: dependency updates

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.8`
- `@homebridge/dbus-native` @ `v0.7.5`
- `bonjour-hap` @ `v3.10.2`

## v2.1.5 (2026-05-05)

### Changes

- fix: drop `ConfiguredName` HIG warning
- chore: dependency updates

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.8`
- `@homebridge/dbus-native` @ `v0.7.5`
- `bonjour-hap` @ `v3.10.2`

## v2.1.4 (2026-05-04)

### Changes

- chore: dependency updates
- docs: regenerate typedoc docs

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.8`
- `@homebridge/dbus-native` @ `v0.7.5`
- `bonjour-hap` @ `v3.10.2`

## v2.1.3 (2026-04-26)

### Changes

- fix: int32 range check in `DataStreamParser`
- fix: `readFloat64LE` missing reader index advance
- fix: utf-8 tag using char count not byte length
- fix: validate encrypted data length before crypto split
- fix: validate required TLV fields in pairing handlers
- fix: unhandled `Promise.all` rejection in RTP proxy setup
- fix: missing `SEQUENCE_NUM` check in pair handlers
- fix: prevent M1 resetting in-progress pair setup
- fix: TLV decoder missing length bounds validation
- fix: unsafe non-null assertions in accessory lookups
- fix: validate `aid.iid` format before parsing
- fix: unguarded buffer reads in camera stream TLV parsing
- fix: category defaulting to string instead of enum
- fix: missing error argument in pairing debug logs
- fix: use constant-time comparison for pincode checks
- fix: `"undefined"` string in characteristic error warnings
- fix: O(n²) buffer concat in encrypt/decrypt hot path
- chore: dependency updates, inc. `typescript`
- docs: regenerate typedoc docs

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.7`
- `@homebridge/dbus-native` @ `v0.7.4`
- `bonjour-hap` @ `v3.10.1`

## v2.1.2 (2026-03-29)

### Changes

- chore: update hap characteristics and services
- dependency updates
- regenerate documentation (`typedoc`) files

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.6`
- `@homebridge/dbus-native` @ `v0.7.4`
- `bonjour-hap` @ `v3.10.1`

## v2.1.1 (2026-03-21)

### Changes

- Improvement: HKSV recording stream AbortSignal support and graceful generator termination. (#1111) (@hjdhjd)
- dependency updates + fix code from new lint rules
- regenerate documentation (`typedoc`) files

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.5`
- `@homebridge/dbus-native` @ `v0.7.3`
- `bonjour-hap` @ `v3.10.0`

## v2.1.0 (2026-02-08)

### Changes

- update readme badges (use `shields.io`) (#1104)
- update publish workflows for npm oidc auth (#1105)
- dependency updates
- update hap characteristics and services
- regenerate documentation (`typedoc`) files

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.5`
- `@homebridge/dbus-native` @ `v0.7.3`
- `bonjour-hap` @ `v3.10.0`

## v2.0.2 (2025-09-17)

### Changes

- dependency updates
- code style - use `subarray` instead of `slice` for buffers
- fix types around buffers in test files
- update hap characteristics and services
- regenerate documentation (`typedoc`) files
- docs: remove unnecessary `@group` tags on interface declarations

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.4`
- `@homebridge/dbus-native` @ `v0.7.2`
- `bonjour-hap` @ `v3.9.1`

## v2.0.1 (2025-07-23)

### Changes

- dependency updates

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.4`
- `@homebridge/dbus-native` @ `v0.7.2`
- `bonjour-hap` @ `v3.9.1`

## v2.0.0 (2025-06-17)

### Breaking

- ⚠️ drop support for node v18
  - the minimum node version required is now `v20`
- ⚠️ republish as `@homebridge/hap-nodejs` for consistency

### Changes

- update `commander` from `v13` to `v14`
- Added support for NodeJS 24
- Update @homebridge/ciao to 1.3.3
- update `jest` to `v30` and required migration steps
- update `eslint` to `v9` and required migration steps

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.3`
- `@homebridge/dbus-native` @ `v0.7.1`
- `bonjour-hap` @ `v3.9.0`

## v1.2.0 (2025-06-08)

### Changes

- add constants for `SecuritySystemAlarmType` (#1086)
- update hk plist file from V=880 to V=886 (#1087)
- updated dependencies (#1085)
- fix OOC errors from `validateUserInput` on steps
- merge branch 'release-0.x' into latest
- fix some bad merge conflicts from previous commit
- updated dependencies, use included types from `dbus-native` (#1092)

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.2`
- `@homebridge/dbus-native` @ `v0.7.1`
- `bonjour-hap` @ `v3.8.0`

## v1.1.2 (2025-06-04)

*No changes since v1.1.1, just a version bump to trigger a new release.*

## v1.1.1 (2025-03-11)

### Changes

- Update name checking (#1083)

### Other Changes

- Update docs
- support node 22 + dependency updates (#1075)

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.0`
- `bonjour-hap` @ `v3.8.0`

## v1.1.0 (2024-07-21)

### Changes

- Set `Ciao` as the default Advertiser

### Other Changes

- Update docs
- Updated dependencies

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.0`
- `bonjour-hap` @ `v3.8.0`

## v1.0.0 (2024-07-10)

### Breaking Changes

- **The minimum Node.js version required is now `v18`.**
- **Important notice:** Because of the cleanup of the Deprecated code, you will need to migrate you code base.
    - Remove the long-deprecated init().
    - Deprecate Core, BridgedCore, legacy Camera characteristics. (#1058) (@hjdhjd)
        - For deprecated `Core` and `BridgedCore` see: https://github.com/homebridge/HAP-NodeJS/wiki/Deprecation-of-Core-and-BridgeCore
    - Legacy code deprecation cleanup. (#1059) (@hjdhjd)
        - For deprecated `storagePath` switch to `HAPStorage.setCustomStoragePath`, `AudioCodec` switch to `AudioStreamingCodec`, `VideoCodec` switch to `H264CodecParameters`,`StreamAudioParams` switch to `AudioStreamingOptions`, `StreamVideoParams` switch to `VideoStreamingOptions`,`cameraSource` switch to `CameraController`.
    - Others deprecated code to highlight removed: `useLegacyAdvertiser`, `AccessoryLoader`.
- Fix: Naming for Characteristic.ProgramMode has been corrected from `PROGRAM_SCHEDULED_MANUAL_MODE_` to `PROGRAM_SCHEDULED_MANUAL_MODE`

### Fixed

- Fix: Build Issues (#1041) (@NorthernMan54)
- Fix: Ensure data is only transmitted on open and ready connections. (#1051) (@hjdhjd)
- Fix: Ensure we check names using the full UTF-8 character set. (#1052) (@hjdhjd)
- Fix: ConfiguredName (#1049) (@donavanbecker)
- Fix: Manufacturer looking at checkName but should look at checkValue. (#1053) (@donavanbecker)

### Other Changes

- Implement warning messages for invalid characters in names (#1009) (@NorthernMan54)
- Mitigate event emitter "memory leak" warnings when a significant number of camera streaming events occur simultaneously (#1037) (@hjdhjd)
- AdaptiveLightingController fix & improvement (#1038) (@Shaquu)
- Minor fixes to recording logging and one change in logging. (#1040) (@hjdhjd)
- Bridged core and core cleanup (#1048) (@Shaquu)
- Increase snapshot handler warning timeout to 8000ms. (#1055) (@hjdhjd)
- Cleanup and refactor getLocalNetworkInterface and address a potential edge case. (#1056) (@hjdhjd)
- Correct log spacing
- Updated and fixed `typedoc` config file
- Updated dependencies

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.0`
- `bonjour-hap` @ `v3.8.0`

## v0.14.3 (2026-03-29)

### Changed

- dependency updates
- regenerate documentation for new version

## v0.14.2 (2026-03-21)

### Changed

- Improvement: HKSV recording stream AbortSignal support and graceful generator termination. (#1111) (@hjdhjd)
- dependency updates
- regenerate documentation for new version

## v0.14.1 (2026-02-07)

### Changed

- dependency updates
- update release script for oidc releases

## v0.14.0 (2025-10-29)

### Changed

- remove `treatWarningsAsErrors` flag from doc gen
- updated dependencies, fix `Buffer` types
- add node 24 to node engines in `package.json`

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.4`
- `bonjour-hap` @ `v3.9.1`

## v0.13.1 (2025-06-04)

*No changes since v0.13.0, just a version bump to trigger a new release.*

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.1`
- `bonjour-hap` @ `v3.9.0`

## v0.13.0 (2025-06-04)

### Changed

_Most of these commits have been backported from the `v1.x` track. None should be breaking changes._

- Mitigate event emitter "memory leak" warnings when a significant number of HomeKit camera streaming events occur simultaneously. (#1037)
- fix type issue and fix ts build issue
- Correct the formatting and presentation of some recording-related debug and error logging. (#1040)
- AdaptiveLightingController fix & improvement (#1038)
- Bridged core and core cleanup (#1048)
- correct log spacing
- fix: Ensure data is only transmitted on open and ready connections. (#1051)
- Increase snapshot handler warning timeout to 8000ms. (#1055)
- Cleanup and refactor `getLocalNetworkInterface` and address a potential edge case. (#1056)
- add constants for `SecuritySystemAlarmType` (#1086)
- update hk plist file from `V=880` to `V=886` (#1087)
- dependency updates, lint and repo maintenance
- fix OOC errors from `validateUserInput` on steps
- regenerate documentation for new version

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.1`
- `bonjour-hap` @ `v3.9.0`

## v0.12.3 (2024-10-26)

### Changed

- minor dependency update
- mark compatible with node v22
- fix `initWithServices` reference in typedoc

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.3.0`
- `bonjour-hap` @ `v3.8.0`

## v0.12.2 (2024-05-31)

### Changed

- Updated dependencies (`rimraf` and `@types/node`)
- Updated dependencies (`simple-plist`)
- Updated dependencies (`typescript`)

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.2.0`
- `@homebridge/dbus-native` @ `v0.6.0`

## v0.12.1 (2024-05-11)

### Changed

- Updated dependencies (`axios` and `commander`)

### Fixed

- Mitigate event emitter "memory leak" warnings when a significant number of HSV events occur simultaneously (#1029) (@hjdhjd)

### Other Changes

- Update Discord Webhooks to trigger only after published to npm

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.2.0`
- `@homebridge/dbus-native` @ `v0.6.0`

## v0.12.0 (2024-04-19)

### Changed

- Create `CHANGELOG.md` file
- Fix: typos + add logo to `README.md`
- Refresh `package-lock.json` (no major changes to dep versions)
- general repo updates
- add alpha releases
- dependency updates
- Fix: typedoc generation
- update homebridge dependencies
- regenerate docs

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.2.0`
- `@homebridge/dbus-native` @ `v0.6.0`
