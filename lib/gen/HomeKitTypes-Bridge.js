'use strict';
// Removed from new HAS

var inherits = require('util').inherits;
var Characteristic = require('../Characteristic').Characteristic;
var Service = require('../Service').Service;

/**
 * 
 * Removed in IOS 11
 * 
 */

/**
 * Characteristic "App Matching Identifier"
 */

Characteristic.AppMatchingIdentifier = function() {
  Characteristic.call(this, 'App Matching Identifier', '000000A4-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AppMatchingIdentifier, Characteristic);

Characteristic.AppMatchingIdentifier.UUID = '000000A4-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Programmable Switch Output State"
 */

Characteristic.ProgrammableSwitchOutputState = function() {
  Characteristic.call(this, 'Programmable Switch Output State', '00000074-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ProgrammableSwitchOutputState, Characteristic);

Characteristic.ProgrammableSwitchOutputState.UUID = '00000074-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Software Revision"
 */

Characteristic.SoftwareRevision = function() {
  Characteristic.call(this, 'Software Revision', '00000054-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SoftwareRevision, Characteristic);

Characteristic.SoftwareRevision.UUID = '00000054-0000-1000-8000-0026BB765291';

/**
 * Service "Camera Control"
 */

Service.CameraControl = function(displayName, subtype) {
  Service.call(this, displayName, '00000111-0000-1000-8000-0026BB765291', subtype);

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
};

inherits(Service.CameraControl, Service);

Service.CameraControl.UUID = '00000111-0000-1000-8000-0026BB765291';

/**
 * Service "Stateful Programmable Switch"
 */

Service.StatefulProgrammableSwitch = function(displayName, subtype) {
  Service.call(this, displayName, '00000088-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.ProgrammableSwitchEvent);
  this.addCharacteristic(Characteristic.ProgrammableSwitchOutputState);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.StatefulProgrammableSwitch, Service);

Service.StatefulProgrammableSwitch.UUID = '00000088-0000-1000-8000-0026BB765291';


// Aliases
Characteristic.SelectedStreamConfiguration = Characteristic.SelectedRTPStreamConfiguration;
Service.Label = Service.ServiceLabel;
Characteristic.LabelNamespace = Characteristic.ServiceLabelNamespace;
Characteristic.LabelIndex = Characteristic.ServiceLabelIndex;

//Renamed Enums:
Characteristic.TargetHumidifierDehumidifierState.AUTO = 0; //Is Now HUMIDIFIER_OR_DEHUMIDIFIER







/**
 * 
 * Removed in IOS 10
 * 
 */

/**
 * Characteristic "Accessory Identifier"
 */

Characteristic.AccessoryIdentifier = function() {
  Characteristic.call(this, 'Accessory Identifier', '00000057-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AccessoryIdentifier, Characteristic);

Characteristic.AccessoryIdentifier.UUID = '00000057-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Category"
 */

Characteristic.Category = function() {
  Characteristic.call(this, 'Category', '000000A3-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT16,
    maxValue: 16,
    minValue: 1,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Category, Characteristic);

Characteristic.Category.UUID = '000000A3-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Configure Bridged Accessory"
 */

Characteristic.ConfigureBridgedAccessory = function() {
  Characteristic.call(this, 'Configure Bridged Accessory', '000000A0-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ConfigureBridgedAccessory, Characteristic);

Characteristic.ConfigureBridgedAccessory.UUID = '000000A0-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Configure Bridged Accessory Status"
 */

Characteristic.ConfigureBridgedAccessoryStatus = function() {
  Characteristic.call(this, 'Configure Bridged Accessory Status', '0000009D-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ConfigureBridgedAccessoryStatus, Characteristic);

Characteristic.ConfigureBridgedAccessoryStatus.UUID = '0000009D-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Current Time"
 */

Characteristic.CurrentTime = function() {
  Characteristic.call(this, 'Current Time', '0000009B-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentTime, Characteristic);

Characteristic.CurrentTime.UUID = '0000009B-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Day of the Week"
 */

Characteristic.DayoftheWeek = function() {
  Characteristic.call(this, 'Day of the Week', '00000098-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 7,
    minValue: 1,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.DayoftheWeek, Characteristic);

Characteristic.DayoftheWeek.UUID = '00000098-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Discover Bridged Accessories"
 */

Characteristic.DiscoverBridgedAccessories = function() {
  Characteristic.call(this, 'Discover Bridged Accessories', '0000009E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.DiscoverBridgedAccessories, Characteristic);

Characteristic.DiscoverBridgedAccessories.UUID = '0000009E-0000-1000-8000-0026BB765291';

// The value property of DiscoverBridgedAccessories must be one of the following:
Characteristic.DiscoverBridgedAccessories.START_DISCOVERY = 0;
Characteristic.DiscoverBridgedAccessories.STOP_DISCOVERY = 1;

/**
 * Characteristic "Discovered Bridged Accessories"
 */

Characteristic.DiscoveredBridgedAccessories = function() {
  Characteristic.call(this, 'Discovered Bridged Accessories', '0000009F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT16,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.DiscoveredBridgedAccessories, Characteristic);

Characteristic.DiscoveredBridgedAccessories.UUID = '0000009F-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Link Quality"
 */

Characteristic.LinkQuality = function() {
  Characteristic.call(this, 'Link Quality', '0000009C-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 4,
    minValue: 1,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LinkQuality, Characteristic);

Characteristic.LinkQuality.UUID = '0000009C-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Reachable"
 */

Characteristic.Reachable = function() {
  Characteristic.call(this, 'Reachable', '00000063-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Reachable, Characteristic);

Characteristic.Reachable.UUID = '00000063-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Relay Control Point"
 */

Characteristic.RelayControlPoint = function() {
  Characteristic.call(this, 'Relay Control Point', '0000005E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.RelayControlPoint, Characteristic);

Characteristic.RelayControlPoint.UUID = '0000005E-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Relay Enabled"
 */

Characteristic.RelayEnabled = function() {
  Characteristic.call(this, 'Relay Enabled', '0000005B-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.RelayEnabled, Characteristic);

Characteristic.RelayEnabled.UUID = '0000005B-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Relay State"
 */

Characteristic.RelayState = function() {
  Characteristic.call(this, 'Relay State', '0000005C-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.RelayState, Characteristic);

Characteristic.RelayState.UUID = '0000005C-0000-1000-8000-0026BB765291';


/**
 * Characteristic "Time Update"
 */

Characteristic.TimeUpdate = function() {
  Characteristic.call(this, 'Time Update', '0000009A-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TimeUpdate, Characteristic);

Characteristic.TimeUpdate.UUID = '0000009A-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Tunnel Connection Timeout "
 */

Characteristic.TunnelConnectionTimeout = function() {
  Characteristic.call(this, 'Tunnel Connection Timeout ', '00000061-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT32,
    perms: [Characteristic.Perms.WRITE, Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TunnelConnectionTimeout, Characteristic);

Characteristic.TunnelConnectionTimeout.UUID = '00000061-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Tunneled Accessory Advertising"
 */

Characteristic.TunneledAccessoryAdvertising = function() {
  Characteristic.call(this, 'Tunneled Accessory Advertising', '00000060-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.WRITE, Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TunneledAccessoryAdvertising, Characteristic);

Characteristic.TunneledAccessoryAdvertising.UUID = '00000060-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Tunneled Accessory Connected"
 */

Characteristic.TunneledAccessoryConnected = function() {
  Characteristic.call(this, 'Tunneled Accessory Connected', '00000059-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.WRITE, Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TunneledAccessoryConnected, Characteristic);

Characteristic.TunneledAccessoryConnected.UUID = '00000059-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Tunneled Accessory State Number"
 */

Characteristic.TunneledAccessoryStateNumber = function() {
  Characteristic.call(this, 'Tunneled Accessory State Number', '00000058-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TunneledAccessoryStateNumber, Characteristic);

Characteristic.TunneledAccessoryStateNumber.UUID = '00000058-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Version"
 */

Characteristic.Version = function() {
  Characteristic.call(this, 'Version', '00000037-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Version, Characteristic);

Characteristic.Version.UUID = '00000037-0000-1000-8000-0026BB765291';

/**
 * Service "Bridge Configuration"
 */

Service.BridgeConfiguration = function(displayName, subtype) {
  Service.call(this, displayName, '000000A1-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.ConfigureBridgedAccessoryStatus);
  this.addCharacteristic(Characteristic.DiscoverBridgedAccessories);
  this.addCharacteristic(Characteristic.DiscoveredBridgedAccessories);
  this.addCharacteristic(Characteristic.ConfigureBridgedAccessory);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.BridgeConfiguration, Service);

Service.BridgeConfiguration.UUID = '000000A1-0000-1000-8000-0026BB765291';

/**
 * Service "Bridging State"
 */

Service.BridgingState = function(displayName, subtype) {
  Service.call(this, displayName, '00000062-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Reachable);
  this.addCharacteristic(Characteristic.LinkQuality);
  this.addCharacteristic(Characteristic.AccessoryIdentifier);
  this.addCharacteristic(Characteristic.Category);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.BridgingState, Service);

Service.BridgingState.UUID = '00000062-0000-1000-8000-0026BB765291';

/**
 * Service "Pairing"
 */

Service.Pairing = function(displayName, subtype) {
  Service.call(this, displayName, '00000055-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.PairSetup);
  this.addCharacteristic(Characteristic.PairVerify);
  this.addCharacteristic(Characteristic.PairingFeatures);
  this.addCharacteristic(Characteristic.PairingPairings);

  // Optional Characteristics
};

inherits(Service.Pairing, Service);

Service.Pairing.UUID = '00000055-0000-1000-8000-0026BB765291';

/**
 * Service "Protocol Information"
 */

Service.ProtocolInformation = function(displayName, subtype) {
  Service.call(this, displayName, '000000A2-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Version);

  // Optional Characteristics
};

inherits(Service.ProtocolInformation, Service);

Service.ProtocolInformation.UUID = '000000A2-0000-1000-8000-0026BB765291';

/**
 * Service "Relay"
 */

Service.Relay = function(displayName, subtype) {
  Service.call(this, displayName, '0000005A-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.RelayEnabled);
  this.addCharacteristic(Characteristic.RelayState);
  this.addCharacteristic(Characteristic.RelayControlPoint);

  // Optional Characteristics
};

inherits(Service.Relay, Service);

Service.Relay.UUID = '0000005A-0000-1000-8000-0026BB765291';

/**
 * Service "Time Information"
 */

Service.TimeInformation = function(displayName, subtype) {
  Service.call(this, displayName, '00000099-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentTime);
  this.addCharacteristic(Characteristic.DayoftheWeek);
  this.addCharacteristic(Characteristic.TimeUpdate);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.TimeInformation, Service);

Service.TimeInformation.UUID = '00000099-0000-1000-8000-0026BB765291';

/**
 * Service "Tunneled BTLE Accessory Service"
 */

Service.TunneledBTLEAccessoryService = function(displayName, subtype) {
  Service.call(this, displayName, '00000056-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Name);
  this.addCharacteristic(Characteristic.AccessoryIdentifier);
  this.addCharacteristic(Characteristic.TunneledAccessoryStateNumber);
  this.addCharacteristic(Characteristic.TunneledAccessoryConnected);
  this.addCharacteristic(Characteristic.TunneledAccessoryAdvertising);
  this.addCharacteristic(Characteristic.TunnelConnectionTimeout);

  // Optional Characteristics
};

inherits(Service.TunneledBTLEAccessoryService, Service);

Service.TunneledBTLEAccessoryService.UUID = '00000056-0000-1000-8000-0026BB765291';
