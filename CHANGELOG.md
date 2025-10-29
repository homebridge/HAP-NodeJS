# Change Log

All notable changes to `hap-nodejs` will be documented in this file. This project tries to adhere to [Semantic Versioning](http://semver.org/).

## v0.13.2 (Unreleased)

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

- `@homebridge/ciao` @ `v1.3.1`
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
