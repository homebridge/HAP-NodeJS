'use strict';
// Manually created from metadata in HomeKitDaemon

var inherits = require('util').inherits;
var Characteristic = require('../Characteristic').Characteristic;
var Service = require('../Service').Service;

/**
 * Characteristic "Active Identifier"
 */

Characteristic.ActiveIdentifier = function() {
  Characteristic.call(this, 'Active Identifier', '000000E7-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT32,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ActiveIdentifier, Characteristic);

Characteristic.ActiveIdentifier.UUID = '000000E7-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Configured Name"
 */

Characteristic.ConfiguredName = function() {
  Characteristic.call(this, 'Configured Name', '000000E3-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ConfiguredName, Characteristic);

Characteristic.ConfiguredName.UUID = '000000E3-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Sleep Discovery Mode"
 */

Characteristic.SleepDiscoveryMode = function() {
  Characteristic.call(this, 'Sleep Discovery Mode', '000000E8-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    validValues: [0,1],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SleepDiscoveryMode, Characteristic);

Characteristic.SleepDiscoveryMode.UUID = '000000E8-0000-1000-8000-0026BB765291';

// The value property of SleepDiscoveryMode must be one of the following:
Characteristic.SleepDiscoveryMode.NOT_DISCOVERABLE = 0;
Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE = 1;

/**
 * Characteristic "Closed Captions"
 */

Characteristic.ClosedCaptions = function() {
  Characteristic.call(this, 'Closed Captions', '000000DD-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    validValues: [0,1],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ClosedCaptions, Characteristic);

Characteristic.ClosedCaptions.UUID = '000000DD-0000-1000-8000-0026BB765291';

// The value property of ClosedCaptions must be one of the following:
Characteristic.ClosedCaptions.DISABLED = 0;
Characteristic.ClosedCaptions.ENABLED = 1;

/**
 * Characteristic "Media State"
 */

Characteristic.MediaState = function() {
  Characteristic.call(this, 'Media State', '000000E0-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 2,
    minValue: 0,
    validValues: [0,1,2],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.MediaState, Characteristic);

Characteristic.MediaState.UUID = '000000E0-0000-1000-8000-0026BB765291';

// The value property of MediaState must be one of the following:
Characteristic.MediaState.PLAY = 0;
Characteristic.MediaState.PAUSE = 1;
Characteristic.MediaState.STOP = 2;

/**
 * Characteristic "Picture Mode"
 */

Characteristic.PictureMode = function() {
  Characteristic.call(this, 'Picture Mode', '000000E2-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 7,
    minValue: 0,
    validValues: [0,1,2,3,4,5,6,7],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PictureMode, Characteristic);

Characteristic.PictureMode.UUID = '000000E2-0000-1000-8000-0026BB765291';

// The value property of PictureMode must be one of the following:
Characteristic.PictureMode.OTHER = 0;
Characteristic.PictureMode.STANDARD = 1;
Characteristic.PictureMode.CALIBRATED = 2;
Characteristic.PictureMode.CALIBRATED_DARK = 3;
Characteristic.PictureMode.VIVID = 4;
Characteristic.PictureMode.GAME = 5;
Characteristic.PictureMode.COMPUTER = 6;
Characteristic.PictureMode.CUSTOM = 7;

/**
 * Characteristic "Power Mode"
 */

Characteristic.PowerMode = function() {
  Characteristic.call(this, 'Power Mode', '000000DE-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 3,
    minValue: 0,
    validValues: [0,1,2,3],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PowerMode, Characteristic);

Characteristic.PowerMode.UUID = '000000DE-0000-1000-8000-0026BB765291';

// The value property of PowerMode must be one of the following:
Characteristic.PowerMode.OTHER = 0;
Characteristic.PowerMode.LOW = 1;
Characteristic.PowerMode.MEDIUM = 2;
Characteristic.PowerMode.HIGH = 3;

/**
 * Characteristic "Power Mode Selection"
 */

Characteristic.PowerModeSelection = function() {
  Characteristic.call(this, 'Power Mode Selection', '000000DF-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    validValues: [0,1],
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PowerModeSelection, Characteristic);

Characteristic.PowerModeSelection.UUID = '000000DF-0000-1000-8000-0026BB765291';

// The value property of PowerModeSelection must be one of the following:
Characteristic.PowerModeSelection.SHOW = 0;
Characteristic.PowerModeSelection.HIDE = 1;

/**
 * Characteristic "Remote Key"
 */

Characteristic.RemoteKey = function() {
  Characteristic.call(this, 'Remote Key', '000000E1-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 11,
    minValue: 0,
    validValues: [0,1,2,3,4,5,6,7,8,9,10,11],
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.RemoteKey, Characteristic);

Characteristic.RemoteKey.UUID = '000000E1-0000-1000-8000-0026BB765291';

// The value property of RemoteKey must be one of the following:
Characteristic.RemoteKey.REWIND = 0;
Characteristic.RemoteKey.FAST_FORWARD = 1;
Characteristic.RemoteKey.NEXT_TRACK = 2;
Characteristic.RemoteKey.PREVIOUS_TRACK = 3;
Characteristic.RemoteKey.ARROW_UP = 4;
Characteristic.RemoteKey.ARROW_DOWN = 5;
Characteristic.RemoteKey.ARROW_LEFT = 6;
Characteristic.RemoteKey.ARROW_RIGHT = 7;
Characteristic.RemoteKey.SELECT = 8;
Characteristic.RemoteKey.BACK = 9;
Characteristic.RemoteKey.EXIT = 10;
Characteristic.RemoteKey.PLAY_PAUSE = 11;

/**
 * Characteristic "Input Source Type"
 */

Characteristic.InputSourceType = function() {
  Characteristic.call(this, 'Input Source Type', '000000DB-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 10,
    minValue: 0,
    validValues: [0,1,2,3,4,5,6,7,8,9,10],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.InputSourceType, Characteristic);

Characteristic.InputSourceType.UUID = '000000DB-0000-1000-8000-0026BB765291';

// The value property of InputSourceType must be one of the following:
Characteristic.InputSourceType.OTHER = 0;
Characteristic.InputSourceType.HOME_SCREEN = 1;
Characteristic.InputSourceType.TUNER = 2;
Characteristic.InputSourceType.HDMI = 3;
Characteristic.InputSourceType.COMPOSITE_VIDEO = 4;
Characteristic.InputSourceType.S_VIDEO = 5;
Characteristic.InputSourceType.COMPONENT_VIDEO = 6;
Characteristic.InputSourceType.DVI = 7;
Characteristic.InputSourceType.AIRPLAY = 8;
Characteristic.InputSourceType.USB = 9;
Characteristic.InputSourceType.APPLICATION = 10;

/**
 * Characteristic "Input Device Type"
 */

Characteristic.InputDeviceType = function() {
  Characteristic.call(this, 'Input Device Type', '000000DC-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 5,
    minValue: 0,
    validValues: [0,1,2,3,4,5],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.InputDeviceType, Characteristic);

Characteristic.InputDeviceType.UUID = '000000DC-0000-1000-8000-0026BB765291';

// The value property of InputDeviceType must be one of the following:
Characteristic.InputDeviceType.OTHER = 0;
Characteristic.InputDeviceType.TV = 1;
Characteristic.InputDeviceType.RECORDING = 2;
Characteristic.InputDeviceType.TUNER = 3;
Characteristic.InputDeviceType.PLAYBACK = 4;
Characteristic.InputDeviceType.AUDIO_SYSTEM = 5;

/**
 * Characteristic "Identifier"
 */

Characteristic.Identifier = function() {
  Characteristic.call(this, 'Identifier', '000000E6-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT32,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Identifier, Characteristic);

Characteristic.Identifier.UUID = '000000E6-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Is Hidden"
 */

Characteristic.IsHidden = function() {
  Characteristic.call(this, 'Is Hidden', '000000EB-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    validValues: [0,1],
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.IsHidden, Characteristic);

Characteristic.IsHidden.UUID = '000000EB-0000-1000-8000-0026BB765291';

// The value property of IsHidden must be one of the following:
Characteristic.IsHidden.SHOWN = 0;
Characteristic.IsHidden.HIDDEN = 1;

/**
 * Characteristic "Target Control Supported Configuration"
 */

Characteristic.TargetControlSupportedConfiguration = function() {
  Characteristic.call(this, 'Target Control Supported Configuration', '00000123-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetControlSupportedConfiguration, Characteristic);

Characteristic.TargetControlSupportedConfiguration.UUID = '00000123-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Target Control List"
 */

Characteristic.TargetControlList = function() {
  Characteristic.call(this, 'Target Control List', '00000124-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.WRITE_RESPONSE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetControlList, Characteristic);

Characteristic.TargetControlList.UUID = '00000124-0000-1000-8000-0026BB765291';

/**
 * Service "Television"
 */

Service.Television = function(displayName, subtype) {
  Service.call(this, displayName, '000000D8-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Active);
  this.addCharacteristic(Characteristic.ActiveIdentifier);
  this.addCharacteristic(Characteristic.ConfiguredName);
  this.addCharacteristic(Characteristic.SleepDiscoveryMode);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Brightness);
  this.addOptionalCharacteristic(Characteristic.ClosedCaptions);
  this.addOptionalCharacteristic(Characteristic.MediaState);
  this.addOptionalCharacteristic(Characteristic.PictureMode);
  this.addOptionalCharacteristic(Characteristic.PowerMode);
  this.addOptionalCharacteristic(Characteristic.PowerModeSelection);
  this.addOptionalCharacteristic(Characteristic.RemoteKey);
};

inherits(Service.Television, Service);

Service.Television.UUID = '000000D8-0000-1000-8000-0026BB765291';

/**
 * Service "Input Source"
 */

Service.InputSource = function(displayName, subtype) {
  Service.call(this, displayName, '000000D9-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.ConfiguredName);
  this.addCharacteristic(Characteristic.InputSourceType);
  this.addCharacteristic(Characteristic.IsConfigured);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Identifier);
  this.addOptionalCharacteristic(Characteristic.InputDeviceType);
  this.addOptionalCharacteristic(Characteristic.IsHidden);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.InputSource, Service);

Service.InputSource.UUID = '000000D9-0000-1000-8000-0026BB765291';

/**
 * Service "Target Control Management"
 */

Service.TargetControlManagement = function(displayName, subtype) {
  Service.call(this, displayName, '00000122-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.TargetControlSupportedConfiguration);
  this.addCharacteristic(Characteristic.TargetControlList);
};

inherits(Service.TargetControlManagement, Service);

Service.TargetControlManagement.UUID = '00000122-0000-1000-8000-0026BB765291';