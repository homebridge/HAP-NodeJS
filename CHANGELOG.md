# Change Log

All notable changes to `hap-nodejs` will be documented in this file. This project tries to adhere to [Semantic Versioning](http://semver.org/).

## v1.0.0 (2024-06-XX)

### Breaking Changes

* **The minimum Node.js version required is now `v18`.**
* **Important notice:** This update bring true semver support.

### Other Changes

- Implement warning messages for invalid characters in names (#1009) (@NorthernMan54)
- Mitigate event emitter "memory leak" warnings when a significant number of camera streaming events occur simultaneously (#1037) (@hjdhjd)
- AdaptiveLightingController fix & improvement (#1038) (@Shaquu)
- Minor fixes to recording logging and one change in logging. (#1040) (@hjdhjd)
- Fix Build Issues (#1041) (@NorthernMan54)
- Updated and fixed `typedoc` config file
- Updated dependencies 

### Homebridge Dependencies

- `bonjour-hap` @ `v3.7.3`

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
- Fix typos + add logo to `README.md`
- Refresh `package-lock.json` (no major changes to dep versions)
- general repo updates
- add alpha releases
- dependency updates
- fix typedoc generation
- update homebridge dependencies
- regenerate docs

### Homebridge Dependencies

- `@homebridge/ciao` @ `v1.2.0`
- `@homebridge/dbus-native` @ `v0.6.0`
