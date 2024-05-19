# Change Log

All notable changes to `hap-nodejs` will be documented in this file. This project tries to adhere to [Semantic Versioning](http://semver.org/).

## BETA

### Changed

- Updated dependencies (`rimraf` and `@types/node`)
- Updated dependencies (`simple-plist`)
- Updated dependencies (`typescript`)

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
