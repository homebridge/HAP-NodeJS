// Manually created from metadata in HomeKitDaemon

import { Characteristic, Perms, Formats } from '../Characteristic';
import { Service } from '../Service';

/**
 * Characteristic "Active Identifier"
 */

export class ActiveIdentifier extends Characteristic {

  static readonly UUID: string = '000000E7-0000-1000-8000-0026BB765291';

  constructor() {
    super('Active Identifier', ActiveIdentifier.UUID, {
      format: Formats.UINT32,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.ActiveIdentifier = ActiveIdentifier;

/**
 * Characteristic "Configured Name"
 */

export class ConfiguredName extends Characteristic {

  static readonly UUID: string = '000000E3-0000-1000-8000-0026BB765291';

  constructor() {
    super('Configured Name', ConfiguredName.UUID, {
      format: Formats.STRING,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.ConfiguredName = ConfiguredName;

/**
 * Characteristic "Sleep Discovery Mode"
 */

export class SleepDiscoveryMode extends Characteristic {

// The value property of SleepDiscoveryMode must be one of the following:
  static readonly NOT_DISCOVERABLE = 0;
  static readonly ALWAYS_DISCOVERABLE = 1;

  static readonly UUID: string = '000000E8-0000-1000-8000-0026BB765291';

  constructor() {
    super('Sleep Discovery Mode', SleepDiscoveryMode.UUID, {
      format: Formats.UINT8,
      maxValue: 1,
      minValue: 0,
      validValues: [0,1],
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.SleepDiscoveryMode = SleepDiscoveryMode;

/**
 * Characteristic "Closed Captions"
 */

export class ClosedCaptions extends Characteristic {

  // The value property of ClosedCaptions must be one of the following:
  static readonly DISABLED = 0;
  static readonly ENABLED = 1;

  static readonly UUID: string = '000000DD-0000-1000-8000-0026BB765291';

  constructor() {
    super('Closed Captions', ClosedCaptions.UUID, {
      format: Formats.UINT8,
      maxValue: 1,
      minValue: 0,
      validValues: [0,1],
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.ClosedCaptions = ClosedCaptions;

/**
 * Characteristic "Display Order"
 */

export class DisplayOrder extends Characteristic {

  static readonly UUID: string = '00000136-0000-1000-8000-0026BB765291';

  constructor() {
    super('Display Order', DisplayOrder.UUID, {
      format: Formats.TLV8,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.DisplayOrder = DisplayOrder;

/**
 * Characteristic "Current Media State"
 */

export class CurrentMediaState extends Characteristic {

  static readonly PLAY = 0;
  static readonly PAUSE = 1;
  static readonly STOP = 2;
  // 3 is unknown (maybe some Television specific value)
  static readonly LOADING = 4; // seems to be SmartSpeaker specific
  static readonly INTERRUPTED = 5; // seems to be SmartSpeaker specific

  static readonly UUID: string = '000000E0-0000-1000-8000-0026BB765291';

  constructor() {
    super('Current Media State', CurrentMediaState.UUID, {
      format: Formats.UINT8,
      maxValue: 5,
      minValue: 0,
      validValues: [0,1,2,3,4,5],
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.CurrentMediaState = CurrentMediaState;

/**
 * Characteristic "Target Media State"
 */

export class TargetMediaState extends Characteristic {

// The value property of TargetMediaState must be one of the following:
  static readonly PLAY = 0;
  static readonly PAUSE = 1;
  static readonly STOP = 2;

  static readonly UUID: string = '00000137-0000-1000-8000-0026BB765291';

  constructor() {
    super('Target Media State', TargetMediaState.UUID, {
      format: Formats.UINT8,
      maxValue: 2,
      minValue: 0,
      validValues: [0,1,2,3],
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TargetMediaState = TargetMediaState;

/**
 * Characteristic "Picture Mode"
 */

export class PictureMode extends Characteristic {

// The value property of PictureMode must be one of the following:
  static readonly OTHER = 0;
  static readonly STANDARD = 1;
  static readonly CALIBRATED = 2;
  static readonly CALIBRATED_DARK = 3;
  static readonly VIVID = 4;
  static readonly GAME = 5;
  static readonly COMPUTER = 6;
  static readonly CUSTOM = 7;

  static readonly UUID: string = '000000E2-0000-1000-8000-0026BB765291';

  constructor() {
    super('Picture Mode', PictureMode.UUID, {
      format: Formats.UINT8,
      maxValue: 13,
      minValue: 0,
      validValues: [0,1,2,3,4,5,6,7,8,9,10,11,12,13],
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.PictureMode = PictureMode;

/**
 * Characteristic "Power Mode Selection"
 */

export class PowerModeSelection extends Characteristic {

  // The value property of PowerModeSelection must be one of the following:
  static readonly SHOW = 0;
  static readonly HIDE = 1;

  static readonly UUID: string = '000000DF-0000-1000-8000-0026BB765291';

  constructor() {
    super('Power Mode Selection', PowerModeSelection.UUID, {
      format: Formats.UINT8,
      maxValue: 1,
      minValue: 0,
      validValues: [0,1],
      perms: [Perms.PAIRED_WRITE]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.PowerModeSelection = PowerModeSelection;

/**
 * Characteristic "Remote Key"
 */

export class RemoteKey extends Characteristic {

// The value property of RemoteKey must be one of the following:
  static readonly REWIND = 0;
  static readonly FAST_FORWARD = 1;
  static readonly NEXT_TRACK = 2;
  static readonly PREVIOUS_TRACK = 3;
  static readonly ARROW_UP = 4;
  static readonly ARROW_DOWN = 5;
  static readonly ARROW_LEFT = 6;
  static readonly ARROW_RIGHT = 7;
  static readonly SELECT = 8;
  static readonly BACK = 9;
  static readonly EXIT = 10;
  static readonly PLAY_PAUSE = 11;
  static readonly INFORMATION = 15;

  static readonly UUID: string = '000000E1-0000-1000-8000-0026BB765291';

  constructor() {
    super('Remote Key', RemoteKey.UUID, {
      format: Formats.UINT8,
      maxValue: 16,
      minValue: 0,
      validValues: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      perms: [Perms.PAIRED_WRITE]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.RemoteKey = RemoteKey;

/**
 * Characteristic "Input Source Type"
 */

export class InputSourceType extends Characteristic {

// The value property of InputSourceType must be one of the following:
  static readonly OTHER = 0;
  static readonly HOME_SCREEN = 1;
  static readonly TUNER = 2;
  static readonly HDMI = 3;
  static readonly COMPOSITE_VIDEO = 4;
  static readonly S_VIDEO = 5;
  static readonly COMPONENT_VIDEO = 6;
  static readonly DVI = 7;
  static readonly AIRPLAY = 8;
  static readonly USB = 9;
  static readonly APPLICATION = 10;

  static readonly UUID: string = '000000DB-0000-1000-8000-0026BB765291';

  constructor() {
    super('Input Source Type', InputSourceType.UUID, {
      format: Formats.UINT8,
      maxValue: 10,
      minValue: 0,
      validValues: [0,1,2,3,4,5,6,7,8,9,10],
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.InputSourceType = InputSourceType;

/**
 * Characteristic "Input Device Type"
 */

export class InputDeviceType extends Characteristic {

  // The value property of InputDeviceType must be one of the following:
  static readonly OTHER = 0;
  static readonly TV = 1;
  static readonly RECORDING = 2;
  static readonly TUNER = 3;
  static readonly PLAYBACK = 4;
  static readonly AUDIO_SYSTEM = 5;
  static readonly UNKNOWN_6 = 6; // introduce in iOS 14; "UNKNOWN_6" is not stable API, changes as soon as the type is known

  static readonly UUID: string = '000000DC-0000-1000-8000-0026BB765291';

  constructor() {
    super('Input Device Type', InputDeviceType.UUID, {
      format: Formats.UINT8,
      maxValue: 6,
      minValue: 0,
      validValues: [0,1,2,3,4,5],
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.InputDeviceType = InputDeviceType;

/**
 * Characteristic "Identifier"
 */

export class Identifier extends Characteristic {

  static readonly UUID: string = '000000E6-0000-1000-8000-0026BB765291';

  constructor() {
    super('Identifier', Identifier.UUID, {
      format: Formats.UINT32,
      minValue: 0,
      minStep: 1,
      perms: [Perms.PAIRED_READ]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.Identifier = Identifier;

/**
 * Characteristic "Current Visibility State"
 */

export class CurrentVisibilityState extends Characteristic {

// The value property of CurrentVisibilityState must be one of the following:
  static readonly SHOWN = 0;
  static readonly HIDDEN = 1;

  static readonly UUID: string = '00000135-0000-1000-8000-0026BB765291';

  constructor() {
    super('Current Visibility State', CurrentVisibilityState.UUID, {
      format: Formats.UINT8,
      maxValue: 3,
      minValue: 0,
      validValues: [0,1,2,3],
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.CurrentVisibilityState = CurrentVisibilityState;

/**
 * Characteristic "Target Visibility State"
 */

export class TargetVisibilityState extends Characteristic {

// The value property of TargetVisibilityState must be one of the following:
  static readonly SHOWN = 0;
  static readonly HIDDEN = 1;

  static readonly UUID: string = '00000134-0000-1000-8000-0026BB765291';

  constructor() {
    super('Target Visibility State', TargetVisibilityState.UUID, {
      format: Formats.UINT8,
      maxValue: 1,
      minValue: 0,
      validValues: [0,1],
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TargetVisibilityState = TargetVisibilityState;

/**
 * Characteristic "Volume Control Type"
 */

export class VolumeControlType extends Characteristic {

// The value property of VolumeControlType must be one of the following:
  static readonly NONE = 0;
  static readonly RELATIVE = 1;
  static readonly RELATIVE_WITH_CURRENT = 2;
  static readonly ABSOLUTE = 3;

  static readonly UUID: string = '000000E9-0000-1000-8000-0026BB765291';

  constructor() {
    super('Volume Control Type', VolumeControlType.UUID, {
      format: Formats.UINT8,
      maxValue: 3,
      minValue: 0,
      validValues: [0,1,2,3],
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.VolumeControlType = VolumeControlType;

/**
 * Characteristic "Volume Selector"
 */

export class VolumeSelector extends Characteristic {

// The value property of VolumeSelector must be one of the following:
  static readonly INCREMENT = 0;
  static readonly DECREMENT = 1;

  static readonly UUID: string = '000000EA-0000-1000-8000-0026BB765291';

  constructor() {
    super('Volume Selector', VolumeSelector.UUID, {
      format: Formats.UINT8,
      maxValue: 1,
      minValue: 0,
      validValues: [0,1],
      perms: [Perms.PAIRED_WRITE]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.VolumeSelector = VolumeSelector;


/**
 * Service "Television"
 */

export class Television extends Service {

  static readonly UUID: string = '000000D8-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, Television.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.Active);
    this.addCharacteristic(Characteristic.ActiveIdentifier);
    this.addCharacteristic(Characteristic.ConfiguredName);
    this.addCharacteristic(Characteristic.RemoteKey);
    this.addCharacteristic(Characteristic.SleepDiscoveryMode);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Brightness);
    this.addOptionalCharacteristic(Characteristic.ClosedCaptions);
    this.addOptionalCharacteristic(Characteristic.DisplayOrder);
    this.addOptionalCharacteristic(Characteristic.CurrentMediaState);
    this.addOptionalCharacteristic(Characteristic.TargetMediaState);
    this.addOptionalCharacteristic(Characteristic.PictureMode);
    this.addOptionalCharacteristic(Characteristic.PowerModeSelection);
    this.addOptionalCharacteristic(Characteristic.Name);
  }
}

Service.Television = Television;

/**
 * Service "Input Source"
 */

export class InputSource extends Service {

  static readonly UUID: string = '000000D9-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, InputSource.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.ConfiguredName);
    this.addCharacteristic(Characteristic.InputSourceType);
    this.addCharacteristic(Characteristic.IsConfigured);
    if (!this.testCharacteristic(Characteristic.Name)) { // workaround for name characteristic collision in constructor
      this.addCharacteristic(Characteristic.Name).updateValue("Unnamed InputSource");
    }
    this.addCharacteristic(Characteristic.CurrentVisibilityState);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Identifier);
    this.addOptionalCharacteristic(Characteristic.InputDeviceType);
    this.addOptionalCharacteristic(Characteristic.TargetVisibilityState);
  }
}

Service.InputSource = InputSource;

/**
 * Service "Television Speaker"
 */

export class TelevisionSpeaker extends Service {

  static readonly UUID: string = '00000113-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, TelevisionSpeaker.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.Mute);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Active);
    this.addOptionalCharacteristic(Characteristic.Volume);
    this.addOptionalCharacteristic(Characteristic.VolumeControlType);
    this.addOptionalCharacteristic(Characteristic.VolumeSelector);
  }
}

Service.TelevisionSpeaker = TelevisionSpeaker;
