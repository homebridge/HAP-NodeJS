import { Characteristic, Formats, Perms } from '../Characteristic';
import { Service } from '../Service';

/**
 *
 * Removed in iOS 11
 *
 */

/**
 * Characteristic "App Matching Identifier"
 */

export class AppMatchingIdentifier extends Characteristic {

  static readonly UUID: string = '000000A4-0000-1000-8000-0026BB765291';

  constructor() {
    super('App Matching Identifier', AppMatchingIdentifier.UUID);
    this.setProps({
      format: Formats.TLV8,
      perms: [Perms.PAIRED_READ]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.AppMatchingIdentifier = AppMatchingIdentifier;

/**
 * Characteristic "Programmable Switch Output State"
 */

export class ProgrammableSwitchOutputState extends Characteristic {

  static readonly UUID: string = '00000074-0000-1000-8000-0026BB765291';

  constructor() {
    super('Programmable Switch Output State', ProgrammableSwitchOutputState.UUID);
    this.setProps({
      format: Formats.UINT8,
      maxValue: 1,
      minValue: 0,
      minStep: 1,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.ProgrammableSwitchOutputState = ProgrammableSwitchOutputState;

/**
 * Characteristic "Software Revision"
 */

export class SoftwareRevision extends Characteristic {

  static readonly UUID: string = '00000054-0000-1000-8000-0026BB765291';

  constructor() {
    super('Software Revision', SoftwareRevision.UUID);
    this.setProps({
      format: Formats.STRING,
      perms: [Perms.PAIRED_READ]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.SoftwareRevision = SoftwareRevision;

/**
 * Service "Camera Control"
 */

export class CameraControl extends Service {

  static readonly UUID: string = '00000111-0000-1000-8000-0026BB765291'

  constructor(displayName: string, subtype: string) {
    super(displayName, CameraControl.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.On);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.CurrentHorizontalTiltAngle);
    this.addOptionalCharacteristic(Characteristic.CurrentVerticalTiltAngle);
    this.addOptionalCharacteristic(Characteristic.TargetHorizontalTiltAngle);
    this.addOptionalCharacteristic(Characteristic.TargetVerticalTiltAngle);
    this.addOptionalCharacteristic(Characteristic.NightVision);
    this.addOptionalCharacteristic(Characteristic.OpticalZoom);
    this.addOptionalCharacteristic(Characteristic.DigitalZoom);
    this.addOptionalCharacteristic(Characteristic.ImageRotation);
    this.addOptionalCharacteristic(Characteristic.ImageMirroring);
    this.addOptionalCharacteristic(Characteristic.Name);
  }
}

Service.CameraControl = CameraControl;

/**
 * Service "Stateful Programmable Switch"
 */

export class StatefulProgrammableSwitch extends Service {

  static readonly UUID: string = '00000088-0000-1000-8000-0026BB765291'

  constructor(displayName: string, subtype: string) {
    super(displayName, StatefulProgrammableSwitch.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.ProgrammableSwitchEvent);
    this.addCharacteristic(Characteristic.ProgrammableSwitchOutputState);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Name);
  }
}

Service.StatefulProgrammableSwitch = StatefulProgrammableSwitch;

/**
 *
 * Removed in iOS 10
 *
 */

/**
 * Characteristic "Accessory Identifier"
 */

export class AccessoryIdentifier extends Characteristic {

  static readonly UUID: string = '00000057-0000-1000-8000-0026BB765291';

  constructor() {
    super('Accessory Identifier', AccessoryIdentifier.UUID);
    this.setProps({
      format: Formats.STRING,
      perms: [Perms.PAIRED_READ]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.AccessoryIdentifier = AccessoryIdentifier;

/**
 * Characteristic "Category"
 */

export class Category extends Characteristic {

  static readonly UUID: string = '000000A3-0000-1000-8000-0026BB765291';

  constructor() {
    super('Category', Category.UUID);
    this.setProps({
      format: Formats.UINT16,
      maxValue: 16,
      minValue: 1,
      minStep: 1,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.Category = Category;

/**
 * Characteristic "Configure Bridged Accessory"
 */

export class ConfigureBridgedAccessory extends Characteristic {

  static readonly UUID: string = '000000A0-0000-1000-8000-0026BB765291';

  constructor() {
    super('Configure Bridged Accessory', ConfigureBridgedAccessory.UUID);
    this.setProps({
      format: Formats.TLV8,
      perms: [Perms.PAIRED_WRITE]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.ConfigureBridgedAccessory = ConfigureBridgedAccessory;

/**
 * Characteristic "Configure Bridged Accessory Status"
 */

export class ConfigureBridgedAccessoryStatus extends Characteristic {

  static readonly UUID: string = '0000009D-0000-1000-8000-0026BB765291';

  constructor() {
    super('Configure Bridged Accessory Status', ConfigureBridgedAccessoryStatus.UUID);
    this.setProps({
      format: Formats.TLV8,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.ConfigureBridgedAccessoryStatus = ConfigureBridgedAccessoryStatus;

/**
 * Characteristic "Current Time"
 */

export class CurrentTime extends Characteristic {

  static readonly UUID: string = '0000009B-0000-1000-8000-0026BB765291';

  constructor() {
    super('Current Time', CurrentTime.UUID);
    this.setProps({
      format: Formats.STRING,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.CurrentTime = CurrentTime;

/**
 * Characteristic "Day of the Week"
 */

export class DayoftheWeek extends Characteristic {

  static readonly UUID: string = '00000098-0000-1000-8000-0026BB765291';

  constructor() {
    super('Day of the Week', DayoftheWeek.UUID);
    this.setProps({
      format: Formats.UINT8,
      maxValue: 7,
      minValue: 1,
      minStep: 1,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.DayoftheWeek = DayoftheWeek;

/**
 * Characteristic "Discover Bridged Accessories"
 */

export class DiscoverBridgedAccessories extends Characteristic {

  // The value property of DiscoverBridgedAccessories must be one of the following:
  static readonly START_DISCOVERY = 0;
  static readonly STOP_DISCOVERY = 1;

  static readonly UUID: string = '0000009E-0000-1000-8000-0026BB765291';

  constructor() {
    super('Discover Bridged Accessories', DiscoverBridgedAccessories.UUID);
    this.setProps({
      format: Formats.UINT8,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.DiscoverBridgedAccessories = DiscoverBridgedAccessories;

/**
 * Characteristic "Discovered Bridged Accessories"
 */

export class DiscoveredBridgedAccessories extends Characteristic {

  static readonly UUID: string = '0000009F-0000-1000-8000-0026BB765291';

  constructor() {
    super('Discovered Bridged Accessories', DiscoveredBridgedAccessories.UUID);
    this.setProps({
      format: Formats.UINT16,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.DiscoveredBridgedAccessories = DiscoveredBridgedAccessories;

/**
 * Characteristic "Link Quality"
 */

export class LinkQuality extends Characteristic {

  static readonly UUID: string = '0000009C-0000-1000-8000-0026BB765291';

  constructor() {
    super('Link Quality', LinkQuality.UUID);
    this.setProps({
      format: Formats.UINT8,
      maxValue: 4,
      minValue: 1,
      minStep: 1,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.LinkQuality = LinkQuality;

/**
 * Characteristic "Reachable"
 */

export class Reachable extends Characteristic {

  static readonly UUID: string = '00000063-0000-1000-8000-0026BB765291';

  constructor() {
    super('Reachable', Reachable.UUID);
    this.setProps({
      format: Formats.BOOL,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.Reachable = Reachable;

/**
 * Characteristic "Relay Control Point"
 */

export class RelayControlPoint extends Characteristic {

  static readonly UUID: string = '0000005E-0000-1000-8000-0026BB765291';

  constructor() {
    super('Relay Control Point', RelayControlPoint.UUID);
    this.setProps({
      format: Formats.TLV8,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.RelayControlPoint = RelayControlPoint;

/**
 * Characteristic "Relay Enabled"
 */

export class RelayEnabled extends Characteristic {

  static readonly UUID: string = '0000005B-0000-1000-8000-0026BB765291';

  constructor() {
    super('Relay Enabled', RelayEnabled.UUID);
    this.setProps({
      format: Formats.BOOL,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.RelayEnabled = RelayEnabled;

/**
 * Characteristic "Relay State"
 */

export class RelayState extends Characteristic {

  static readonly UUID: string = '0000005C-0000-1000-8000-0026BB765291';

  constructor() {
    super('Relay State', RelayState.UUID);
    this.setProps({
      format: Formats.UINT8,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.RelayState = RelayState;

/**
 * Characteristic "Time Update"
 */

export class TimeUpdate extends Characteristic {

  static readonly UUID: string = '0000009A-0000-1000-8000-0026BB765291';

  constructor() {
    super('Time Update', TimeUpdate.UUID);
    this.setProps({
      format: Formats.BOOL,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TimeUpdate = TimeUpdate;

/**
 * Characteristic "Tunnel Connection Timeout "
 */

export class TunnelConnectionTimeout extends Characteristic {

  static readonly UUID: string = '00000061-0000-1000-8000-0026BB765291';

  constructor() {
    super('Tunnel Connection Timeout ', TunnelConnectionTimeout.UUID);
    this.setProps({
      format: Formats.UINT32,
      perms: [Perms.PAIRED_WRITE, Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TunnelConnectionTimeout = TunnelConnectionTimeout;

/**
 * Characteristic "Tunneled Accessory Advertising"
 */

export class TunneledAccessoryAdvertising extends Characteristic {

  static readonly UUID: string = '00000060-0000-1000-8000-0026BB765291';

  constructor() {
    super('Tunneled Accessory Advertising', TunneledAccessoryAdvertising.UUID);
    this.setProps({
      format: Formats.BOOL,
      perms: [Perms.PAIRED_WRITE, Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TunneledAccessoryAdvertising = TunneledAccessoryAdvertising;

/**
 * Characteristic "Tunneled Accessory Connected"
 */

export class TunneledAccessoryConnected extends Characteristic {

  static readonly UUID: string = '00000059-0000-1000-8000-0026BB765291';

  constructor() {
    super('Tunneled Accessory Connected', TunneledAccessoryConnected.UUID);
    this.setProps({
      format: Formats.BOOL,
      perms: [Perms.PAIRED_WRITE, Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TunneledAccessoryConnected = TunneledAccessoryConnected;

/**
 * Characteristic "Tunneled Accessory State Number"
 */

export class TunneledAccessoryStateNumber extends Characteristic {

  static readonly UUID: string = '00000058-0000-1000-8000-0026BB765291';

  constructor() {
    super('Tunneled Accessory State Number', TunneledAccessoryStateNumber.UUID);
    this.setProps({
      format: Formats.FLOAT,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}

Characteristic.TunneledAccessoryStateNumber = TunneledAccessoryStateNumber;

/**
 * Service "Bridge Configuration"
 */

export class BridgeConfiguration extends Service {

  static readonly UUID: string = '000000A1-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, BridgeConfiguration.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.ConfigureBridgedAccessoryStatus);
    this.addCharacteristic(Characteristic.DiscoverBridgedAccessories);
    this.addCharacteristic(Characteristic.DiscoveredBridgedAccessories);
    this.addCharacteristic(Characteristic.ConfigureBridgedAccessory);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Name);
  }
}

Service.BridgeConfiguration = BridgeConfiguration;

/**
 * Service "Bridging State"
 */

export class BridgingState extends Service {

  static readonly UUID: string = '00000062-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, BridgingState.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.Reachable);
    this.addCharacteristic(Characteristic.LinkQuality);
    this.addCharacteristic(Characteristic.AccessoryIdentifier);
    this.addCharacteristic(Characteristic.Category);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Name);
  }
}

Service.BridgingState = BridgingState;

/**
 * Service "Pairing"
 */

export class Pairing extends Service {

  static readonly UUID: string = '00000055-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, Pairing.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.PairSetup);
    this.addCharacteristic(Characteristic.PairVerify);
    this.addCharacteristic(Characteristic.PairingFeatures);
    this.addCharacteristic(Characteristic.PairingPairings);

    // Optional Characteristics
  }
}

Service.Pairing = Pairing;

/**
 * Service "Protocol Information"
 */

export class ProtocolInformation extends Service {

  static readonly UUID: string = '000000A2-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, ProtocolInformation.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.Version);

    // Optional Characteristics
  }
}

Service.ProtocolInformation = ProtocolInformation;

/**
 * Service "Relay"
 */

export class Relay extends Service {

  static readonly UUID: string = '0000005A-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, Relay.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.RelayEnabled);
    this.addCharacteristic(Characteristic.RelayState);
    this.addCharacteristic(Characteristic.RelayControlPoint);

    // Optional Characteristics
  }
}

Service.Relay = Relay;

/**
 * Service "Time Information"
 */

export class TimeInformation extends Service {

  static readonly UUID: string = '00000099-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, TimeInformation.UUID, subtype);

    // Required Characteristics
    this.addCharacteristic(Characteristic.CurrentTime);
    this.addCharacteristic(Characteristic.DayoftheWeek);
    this.addCharacteristic(Characteristic.TimeUpdate);

    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.Name);
  }
}

Service.TimeInformation = TimeInformation;

/**
 * Service "Tunneled BTLE Accessory Service"
 */

export class TunneledBTLEAccessoryService extends Service {

  static readonly UUID: string = '00000056-0000-1000-8000-0026BB765291';

  constructor(displayName: string, subtype: string) {
    super(displayName, TunneledBTLEAccessoryService.UUID, subtype);

    // Required Characteristics
    if (!this.testCharacteristic(Characteristic.Name)) { // workaround for name characteristic collision in constructor
      this.addCharacteristic(Characteristic.Name);
    }
    this.addCharacteristic(Characteristic.AccessoryIdentifier);
    this.addCharacteristic(Characteristic.TunneledAccessoryStateNumber);
    this.addCharacteristic(Characteristic.TunneledAccessoryConnected);
    this.addCharacteristic(Characteristic.TunneledAccessoryAdvertising);
    this.addCharacteristic(Characteristic.TunnelConnectionTimeout);

    // Optional Characteristics
  }
}

Service.TunneledBTLEAccessoryService = TunneledBTLEAccessoryService;
