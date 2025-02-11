# Change Log

All notable changes to `hap-nodejs` will be documented in this file. This project tries to adhere to [Semantic Versioning](http://semver.org/).

## v1.1.0 (2025-02-11)

### Changes

- Update name checking (#1083)

### Other Changes

- Update docs
- support node 22 + dependency updates (#1075)

## v1.1.0 (2024-07-21)

### Changes

- Set `Ciao` as the default Advertiser

### Other Changes

- Update docs
- Updated dependencies

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

## v0.12.3 (2024-10-25)

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
