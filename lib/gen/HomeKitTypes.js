// THIS FILE IS AUTO-GENERATED - DO NOT MODIFY

var inherits = require('util').inherits;
var Characteristic = require('../Characteristic').Characteristic;
var Service = require('../Service').Service;

/**
 * Characteristic "Administrator Only Access"
 */

Characteristic.AdministratorOnlyAccess = function() {
  Characteristic.call(this, 'Administrator Only Access', '00000001-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AdministratorOnlyAccess, Characteristic);

Characteristic.AdministratorOnlyAccess.UUID = '00000001-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Air Particulate Density"
 */

Characteristic.AirParticulateDensity = function() {
  Characteristic.call(this, 'Air Particulate Density', '00000064-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    maxValue: 1000,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AirParticulateDensity, Characteristic);

Characteristic.AirParticulateDensity.UUID = '00000064-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Air Particulate Size"
 */

Characteristic.AirParticulateSize = function() {
  Characteristic.call(this, 'Air Particulate Size', '00000065-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AirParticulateSize, Characteristic);

Characteristic.AirParticulateSize.UUID = '00000065-0000-1000-8000-0026BB765291';

// The value property of AirParticulateSize must be one of the following:
Characteristic.AirParticulateSize._2_5_M = 0;
Characteristic.AirParticulateSize._10_M = 1;

/**
 * Characteristic "Air Quality"
 */

Characteristic.AirQuality = function() {
  Characteristic.call(this, 'Air Quality', '00000095-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AirQuality, Characteristic);

Characteristic.AirQuality.UUID = '00000095-0000-1000-8000-0026BB765291';

// The value property of AirQuality must be one of the following:
Characteristic.AirQuality.UNKNOWN = 0;
Characteristic.AirQuality.EXCELLENT = 1;
Characteristic.AirQuality.GOOD = 2;
Characteristic.AirQuality.FAIR = 3;
Characteristic.AirQuality.INFERIOR = 4;
Characteristic.AirQuality.POOR = 5;

/**
 * Characteristic "Audio Feedback"
 */

Characteristic.AudioFeedback = function() {
  Characteristic.call(this, 'Audio Feedback', '00000005-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.AudioFeedback, Characteristic);

Characteristic.AudioFeedback.UUID = '00000005-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Battery Level"
 */

Characteristic.BatteryLevel = function() {
  Characteristic.call(this, 'Battery Level', '00000068-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.BatteryLevel, Characteristic);

Characteristic.BatteryLevel.UUID = '00000068-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Brightness"
 */

Characteristic.Brightness = function() {
  Characteristic.call(this, 'Brightness', '00000008-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Brightness, Characteristic);

Characteristic.Brightness.UUID = '00000008-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Carbon Dioxide Detected"
 */

Characteristic.CarbonDioxideDetected = function() {
  Characteristic.call(this, 'Carbon Dioxide Detected', '00000092-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CarbonDioxideDetected, Characteristic);

Characteristic.CarbonDioxideDetected.UUID = '00000092-0000-1000-8000-0026BB765291';

// The value property of CarbonDioxideDetected must be one of the following:
Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL = 0;
Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL = 1;

/**
 * Characteristic "Carbon Dioxide Level"
 */

Characteristic.CarbonDioxideLevel = function() {
  Characteristic.call(this, 'Carbon Dioxide Level', '00000093-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    maxValue: 100000,
    minValue: 0,
    minStep: 100,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CarbonDioxideLevel, Characteristic);

Characteristic.CarbonDioxideLevel.UUID = '00000093-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Carbon Dioxide Peak Level"
 */

Characteristic.CarbonDioxidePeakLevel = function() {
  Characteristic.call(this, 'Carbon Dioxide Peak Level', '00000094-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    maxValue: 100000,
    minValue: 0,
    minStep: 100,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CarbonDioxidePeakLevel, Characteristic);

Characteristic.CarbonDioxidePeakLevel.UUID = '00000094-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Carbon Monoxide Detected"
 */

Characteristic.CarbonMonoxideDetected = function() {
  Characteristic.call(this, 'Carbon Monoxide Detected', '00000069-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CarbonMonoxideDetected, Characteristic);

Characteristic.CarbonMonoxideDetected.UUID = '00000069-0000-1000-8000-0026BB765291';

// The value property of CarbonMonoxideDetected must be one of the following:
Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL = 0;
Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL = 1;

/**
 * Characteristic "Carbon Monoxide Level"
 */

Characteristic.CarbonMonoxideLevel = function() {
  Characteristic.call(this, 'Carbon Monoxide Level', '00000090-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    maxValue: 100,
    minValue: 0,
    minStep: 0.1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CarbonMonoxideLevel, Characteristic);

Characteristic.CarbonMonoxideLevel.UUID = '00000090-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Carbon Monoxide Peak Level"
 */

Characteristic.CarbonMonoxidePeakLevel = function() {
  Characteristic.call(this, 'Carbon Monoxide Peak Level', '00000091-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    maxValue: 100,
    minValue: 0,
    minStep: 0.1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CarbonMonoxidePeakLevel, Characteristic);

Characteristic.CarbonMonoxidePeakLevel.UUID = '00000091-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Category"
 */

Characteristic.Category = function() {
  Characteristic.call(this, 'Category', '00000103-0000-1000-8000-0026BB765291');
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

Characteristic.Category.UUID = '00000103-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Charging State"
 */

Characteristic.ChargingState = function() {
  Characteristic.call(this, 'Charging State', '0000008F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ChargingState, Characteristic);

Characteristic.ChargingState.UUID = '0000008F-0000-1000-8000-0026BB765291';

// The value property of ChargingState must be one of the following:
Characteristic.ChargingState.NOT_CHARGING = 0;
Characteristic.ChargingState.CHARGING = 1;

/**
 * Characteristic "Configure Bridged Accessory"
 */

Characteristic.ConfigureBridgedAccessory = function() {
  Characteristic.call(this, 'Configure Bridged Accessory', '00000100-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ConfigureBridgedAccessory, Characteristic);

Characteristic.ConfigureBridgedAccessory.UUID = '00000100-0000-1000-8000-0026BB765291';

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
 * Characteristic "Contact Sensor State"
 */

Characteristic.ContactSensorState = function() {
  Characteristic.call(this, 'Contact Sensor State', '0000006A-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ContactSensorState, Characteristic);

Characteristic.ContactSensorState.UUID = '0000006A-0000-1000-8000-0026BB765291';

// The value property of ContactSensorState must be one of the following:
Characteristic.ContactSensorState.CONTACT_DETECTED = 0;
Characteristic.ContactSensorState.CONTACT_NOT_DETECTED = 1;

/**
 * Characteristic "Cooling Threshold Temperature"
 */

Characteristic.CoolingThresholdTemperature = function() {
  Characteristic.call(this, 'Cooling Threshold Temperature', '0000000D-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.CELSIUS,
    maxValue: 35,
    minValue: 10,
    minStep: 0.1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CoolingThresholdTemperature, Characteristic);

Characteristic.CoolingThresholdTemperature.UUID = '0000000D-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Current Ambient Light Level"
 */

Characteristic.CurrentAmbientLightLevel = function() {
  Characteristic.call(this, 'Current Ambient Light Level', '0000006B-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.LUX,
    maxValue: 100000,
    minValue: 0.0001,
    minStep: 0.0001,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentAmbientLightLevel, Characteristic);

Characteristic.CurrentAmbientLightLevel.UUID = '0000006B-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Current Door State"
 */

Characteristic.CurrentDoorState = function() {
  Characteristic.call(this, 'Current Door State', '0000000E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentDoorState, Characteristic);

Characteristic.CurrentDoorState.UUID = '0000000E-0000-1000-8000-0026BB765291';

// The value property of CurrentDoorState must be one of the following:
Characteristic.CurrentDoorState.OPEN = 0;
Characteristic.CurrentDoorState.CLOSED = 1;
Characteristic.CurrentDoorState.OPENING = 2;
Characteristic.CurrentDoorState.CLOSING = 3;
Characteristic.CurrentDoorState.STOPPED = 4;

/**
 * Characteristic "Current Heating Cooling State"
 */

Characteristic.CurrentHeatingCoolingState = function() {
  Characteristic.call(this, 'Current Heating Cooling State', '0000000F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentHeatingCoolingState, Characteristic);

Characteristic.CurrentHeatingCoolingState.UUID = '0000000F-0000-1000-8000-0026BB765291';

// The value property of CurrentHeatingCoolingState must be one of the following:
Characteristic.CurrentHeatingCoolingState.OFF = 0;
Characteristic.CurrentHeatingCoolingState.HEAT = 1;
Characteristic.CurrentHeatingCoolingState.COOL = 2;

/**
 * Characteristic "Current Horizontal Tilt Angle"
 */

Characteristic.CurrentHorizontalTiltAngle = function() {
  Characteristic.call(this, 'Current Horizontal Tilt Angle', '0000006C-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.ARC_DEGREE,
    maxValue: 90,
    minValue: -90,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentHorizontalTiltAngle, Characteristic);

Characteristic.CurrentHorizontalTiltAngle.UUID = '0000006C-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Current Position"
 */

Characteristic.CurrentPosition = function() {
  Characteristic.call(this, 'Current Position', '0000006D-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentPosition, Characteristic);

Characteristic.CurrentPosition.UUID = '0000006D-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Current Relative Humidity"
 */

Characteristic.CurrentRelativeHumidity = function() {
  Characteristic.call(this, 'Current Relative Humidity', '00000010-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentRelativeHumidity, Characteristic);

Characteristic.CurrentRelativeHumidity.UUID = '00000010-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Current Temperature"
 */

Characteristic.CurrentTemperature = function() {
  Characteristic.call(this, 'Current Temperature', '00000011-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.CELSIUS,
    maxValue: 100,
    minValue: 0,
    minStep: 0.1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentTemperature, Characteristic);

Characteristic.CurrentTemperature.UUID = '00000011-0000-1000-8000-0026BB765291';

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
 * Characteristic "Current Vertical Tilt Angle"
 */

Characteristic.CurrentVerticalTiltAngle = function() {
  Characteristic.call(this, 'Current Vertical Tilt Angle', '0000006E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.ARC_DEGREE,
    maxValue: 90,
    minValue: -90,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.CurrentVerticalTiltAngle, Characteristic);

Characteristic.CurrentVerticalTiltAngle.UUID = '0000006E-0000-1000-8000-0026BB765291';

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
 * Characteristic "Firmware Revision"
 */

Characteristic.FirmwareRevision = function() {
  Characteristic.call(this, 'Firmware Revision', '00000052-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.FirmwareRevision, Characteristic);

Characteristic.FirmwareRevision.UUID = '00000052-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Hardware Revision"
 */

Characteristic.HardwareRevision = function() {
  Characteristic.call(this, 'Hardware Revision', '00000053-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.HardwareRevision, Characteristic);

Characteristic.HardwareRevision.UUID = '00000053-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Heating Threshold Temperature"
 */

Characteristic.HeatingThresholdTemperature = function() {
  Characteristic.call(this, 'Heating Threshold Temperature', '00000012-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.CELSIUS,
    maxValue: 25,
    minValue: 0,
    minStep: 0.1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.HeatingThresholdTemperature, Characteristic);

Characteristic.HeatingThresholdTemperature.UUID = '00000012-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Hold Position"
 */

Characteristic.HoldPosition = function() {
  Characteristic.call(this, 'Hold Position', '0000006F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.HoldPosition, Characteristic);

Characteristic.HoldPosition.UUID = '0000006F-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Hue"
 */

Characteristic.Hue = function() {
  Characteristic.call(this, 'Hue', '00000013-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.ARC_DEGREE,
    maxValue: 360,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Hue, Characteristic);

Characteristic.Hue.UUID = '00000013-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Identify"
 */

Characteristic.Identify = function() {
  Characteristic.call(this, 'Identify', '00000014-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Identify, Characteristic);

Characteristic.Identify.UUID = '00000014-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Leak Detected"
 */

Characteristic.LeakDetected = function() {
  Characteristic.call(this, 'Leak Detected', '00000070-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LeakDetected, Characteristic);

Characteristic.LeakDetected.UUID = '00000070-0000-1000-8000-0026BB765291';

// The value property of LeakDetected must be one of the following:
Characteristic.LeakDetected.LEAK_NOT_DETECTED = 0;
Characteristic.LeakDetected.LEAK_DETECTED = 1;

/**
 * Characteristic "Link Address"
 */

Characteristic.LinkAddress = function() {
  Characteristic.call(this, 'Link Address', '00000102-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LinkAddress, Characteristic);

Characteristic.LinkAddress.UUID = '00000102-0000-1000-8000-0026BB765291';

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
 * Characteristic "Link Type"
 */

Characteristic.LinkType = function() {
  Characteristic.call(this, 'Link Type', '00000104-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 4,
    minValue: 1,
    minStep: 1,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LinkType, Characteristic);

Characteristic.LinkType.UUID = '00000104-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Lock Control Point"
 */

Characteristic.LockControlPoint = function() {
  Characteristic.call(this, 'Lock Control Point', '00000019-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LockControlPoint, Characteristic);

Characteristic.LockControlPoint.UUID = '00000019-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Lock Current State"
 */

Characteristic.LockCurrentState = function() {
  Characteristic.call(this, 'Lock Current State', '0000001D-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LockCurrentState, Characteristic);

Characteristic.LockCurrentState.UUID = '0000001D-0000-1000-8000-0026BB765291';

// The value property of LockCurrentState must be one of the following:
Characteristic.LockCurrentState.UNSECURED = 0;
Characteristic.LockCurrentState.SECURED = 1;
Characteristic.LockCurrentState.JAMMED = 2;
Characteristic.LockCurrentState.UNKNOWN = 3;

/**
 * Characteristic "Lock Last Known Action"
 */

Characteristic.LockLastKnownAction = function() {
  Characteristic.call(this, 'Lock Last Known Action', '0000001C-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LockLastKnownAction, Characteristic);

Characteristic.LockLastKnownAction.UUID = '0000001C-0000-1000-8000-0026BB765291';

// The value property of LockLastKnownAction must be one of the following:
Characteristic.LockLastKnownAction.SECURED_PHYSICALLY_INTERIOR = 0;
Characteristic.LockLastKnownAction.UNSECURED_PHYSICALLY_INTERIOR = 1;
Characteristic.LockLastKnownAction.SECURED_PHYSICALLY_EXTERIOR = 2;
Characteristic.LockLastKnownAction.UNSECURED_PHYSICALLY_EXTERIOR = 3;
Characteristic.LockLastKnownAction.SECURED_BY_KEYPAD = 4;
Characteristic.LockLastKnownAction.UNSECURED_BY_KEYPAD = 5;
Characteristic.LockLastKnownAction.SECURED_REMOTELY = 6;
Characteristic.LockLastKnownAction.UNSECURED_REMOTELY = 7;
Characteristic.LockLastKnownAction.SECURED_BY_AUTO_SECURE_TIMEOUT = 8;

/**
 * Characteristic "Lock Management Auto Security Timeout"
 */

Characteristic.LockManagementAutoSecurityTimeout = function() {
  Characteristic.call(this, 'Lock Management Auto Security Timeout', '0000001A-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT32,
    unit: Characteristic.Units.SECONDS,
    maxValue: 86400,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LockManagementAutoSecurityTimeout, Characteristic);

Characteristic.LockManagementAutoSecurityTimeout.UUID = '0000001A-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Lock Target State"
 */

Characteristic.LockTargetState = function() {
  Characteristic.call(this, 'Lock Target State', '0000001E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.LockTargetState, Characteristic);

Characteristic.LockTargetState.UUID = '0000001E-0000-1000-8000-0026BB765291';

// The value property of LockTargetState must be one of the following:
Characteristic.LockTargetState.UNSECURED = 0;
Characteristic.LockTargetState.SECURED = 1;

/**
 * Characteristic "Logs"
 */

Characteristic.Logs = function() {
  Characteristic.call(this, 'Logs', '0000001F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Logs, Characteristic);

Characteristic.Logs.UUID = '0000001F-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Manufacturer"
 */

Characteristic.Manufacturer = function() {
  Characteristic.call(this, 'Manufacturer', '00000020-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Manufacturer, Characteristic);

Characteristic.Manufacturer.UUID = '00000020-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Model"
 */

Characteristic.Model = function() {
  Characteristic.call(this, 'Model', '00000021-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Model, Characteristic);

Characteristic.Model.UUID = '00000021-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Motion Detected"
 */

Characteristic.MotionDetected = function() {
  Characteristic.call(this, 'Motion Detected', '00000022-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.MotionDetected, Characteristic);

Characteristic.MotionDetected.UUID = '00000022-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Name"
 */

Characteristic.Name = function() {
  Characteristic.call(this, 'Name', '00000023-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Name, Characteristic);

Characteristic.Name.UUID = '00000023-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Obstruction Detected"
 */

Characteristic.ObstructionDetected = function() {
  Characteristic.call(this, 'Obstruction Detected', '00000024-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ObstructionDetected, Characteristic);

Characteristic.ObstructionDetected.UUID = '00000024-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Occupancy Detected"
 */

Characteristic.OccupancyDetected = function() {
  Characteristic.call(this, 'Occupancy Detected', '00000071-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.OccupancyDetected, Characteristic);

Characteristic.OccupancyDetected.UUID = '00000071-0000-1000-8000-0026BB765291';

// The value property of OccupancyDetected must be one of the following:
Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED = 0;
Characteristic.OccupancyDetected.OCCUPANCY_DETECTED = 1;

/**
 * Characteristic "On"
 */

Characteristic.On = function() {
  Characteristic.call(this, 'On', '00000025-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.On, Characteristic);

Characteristic.On.UUID = '00000025-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Outlet In Use"
 */

Characteristic.OutletInUse = function() {
  Characteristic.call(this, 'Outlet In Use', '00000026-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.OutletInUse, Characteristic);

Characteristic.OutletInUse.UUID = '00000026-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Pair Setup"
 */

Characteristic.PairSetup = function() {
  Characteristic.call(this, 'Pair Setup', '0000004C-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PairSetup, Characteristic);

Characteristic.PairSetup.UUID = '0000004C-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Pair Verify"
 */

Characteristic.PairVerify = function() {
  Characteristic.call(this, 'Pair Verify', '0000004E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PairVerify, Characteristic);

Characteristic.PairVerify.UUID = '0000004E-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Pairing Features"
 */

Characteristic.PairingFeatures = function() {
  Characteristic.call(this, 'Pairing Features', '0000004F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PairingFeatures, Characteristic);

Characteristic.PairingFeatures.UUID = '0000004F-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Pairing Pairings"
 */

Characteristic.PairingPairings = function() {
  Characteristic.call(this, 'Pairing Pairings', '00000050-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.TLV8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PairingPairings, Characteristic);

Characteristic.PairingPairings.UUID = '00000050-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Position State"
 */

Characteristic.PositionState = function() {
  Characteristic.call(this, 'Position State', '00000072-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.PositionState, Characteristic);

Characteristic.PositionState.UUID = '00000072-0000-1000-8000-0026BB765291';

// The value property of PositionState must be one of the following:
Characteristic.PositionState.DECREASING = 0;
Characteristic.PositionState.INCREASING = 1;
Characteristic.PositionState.STOPPED = 2;

/**
 * Characteristic "Programmable Switch Event"
 */

Characteristic.ProgrammableSwitchEvent = function() {
  Characteristic.call(this, 'Programmable Switch Event', '00000073-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.ProgrammableSwitchEvent, Characteristic);

Characteristic.ProgrammableSwitchEvent.UUID = '00000073-0000-1000-8000-0026BB765291';

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
 * Characteristic "Rotation Direction"
 */

Characteristic.RotationDirection = function() {
  Characteristic.call(this, 'Rotation Direction', '00000028-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.INT,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.RotationDirection, Characteristic);

Characteristic.RotationDirection.UUID = '00000028-0000-1000-8000-0026BB765291';

// The value property of RotationDirection must be one of the following:
Characteristic.RotationDirection.CLOCKWISE = 0;
Characteristic.RotationDirection.COUNTER_CLOCKWISE = 1;

/**
 * Characteristic "Rotation Speed"
 */

Characteristic.RotationSpeed = function() {
  Characteristic.call(this, 'Rotation Speed', '00000029-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.RotationSpeed, Characteristic);

Characteristic.RotationSpeed.UUID = '00000029-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Saturation"
 */

Characteristic.Saturation = function() {
  Characteristic.call(this, 'Saturation', '0000002F-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.Saturation, Characteristic);

Characteristic.Saturation.UUID = '0000002F-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Security System Alarm Type"
 */

Characteristic.SecuritySystemAlarmType = function() {
  Characteristic.call(this, 'Security System Alarm Type', '0000008E-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    maxValue: 1,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SecuritySystemAlarmType, Characteristic);

Characteristic.SecuritySystemAlarmType.UUID = '0000008E-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Security System Current State"
 */

Characteristic.SecuritySystemCurrentState = function() {
  Characteristic.call(this, 'Security System Current State', '00000066-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SecuritySystemCurrentState, Characteristic);

Characteristic.SecuritySystemCurrentState.UUID = '00000066-0000-1000-8000-0026BB765291';

// The value property of SecuritySystemCurrentState must be one of the following:
Characteristic.SecuritySystemCurrentState.STAY_ARM = 0;
Characteristic.SecuritySystemCurrentState.AWAY_ARM = 1;
Characteristic.SecuritySystemCurrentState.NIGHT_ARM = 2;
Characteristic.SecuritySystemCurrentState.DISARMED = 3;
Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED = 4;

/**
 * Characteristic "Security System Target State"
 */

Characteristic.SecuritySystemTargetState = function() {
  Characteristic.call(this, 'Security System Target State', '00000067-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SecuritySystemTargetState, Characteristic);

Characteristic.SecuritySystemTargetState.UUID = '00000067-0000-1000-8000-0026BB765291';

// The value property of SecuritySystemTargetState must be one of the following:
Characteristic.SecuritySystemTargetState.STAY_ARM = 0;
Characteristic.SecuritySystemTargetState.AWAY_ARM = 1;
Characteristic.SecuritySystemTargetState.NIGHT_ARM = 2;
Characteristic.SecuritySystemTargetState.DISARM = 3;

/**
 * Characteristic "Serial Number"
 */

Characteristic.SerialNumber = function() {
  Characteristic.call(this, 'Serial Number', '00000030-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SerialNumber, Characteristic);

Characteristic.SerialNumber.UUID = '00000030-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Smoke Detected"
 */

Characteristic.SmokeDetected = function() {
  Characteristic.call(this, 'Smoke Detected', '00000076-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.SmokeDetected, Characteristic);

Characteristic.SmokeDetected.UUID = '00000076-0000-1000-8000-0026BB765291';

// The value property of SmokeDetected must be one of the following:
Characteristic.SmokeDetected.SMOKE_NOT_DETECTED = 0;
Characteristic.SmokeDetected.SMOKE_DETECTED = 1;

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
 * Characteristic "Status Active"
 */

Characteristic.StatusActive = function() {
  Characteristic.call(this, 'Status Active', '00000075-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.StatusActive, Characteristic);

Characteristic.StatusActive.UUID = '00000075-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Status Fault"
 */

Characteristic.StatusFault = function() {
  Characteristic.call(this, 'Status Fault', '00000077-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.StatusFault, Characteristic);

Characteristic.StatusFault.UUID = '00000077-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Status Jammed"
 */

Characteristic.StatusJammed = function() {
  Characteristic.call(this, 'Status Jammed', '00000078-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.StatusJammed, Characteristic);

Characteristic.StatusJammed.UUID = '00000078-0000-1000-8000-0026BB765291';

// The value property of StatusJammed must be one of the following:
Characteristic.StatusJammed.NOT_JAMMED = 0;
Characteristic.StatusJammed.JAMMED = 1;

/**
 * Characteristic "Status Low Battery"
 */

Characteristic.StatusLowBattery = function() {
  Characteristic.call(this, 'Status Low Battery', '00000079-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.StatusLowBattery, Characteristic);

Characteristic.StatusLowBattery.UUID = '00000079-0000-1000-8000-0026BB765291';

// The value property of StatusLowBattery must be one of the following:
Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL = 0;
Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW = 1;

/**
 * Characteristic "Status Tampered"
 */

Characteristic.StatusTampered = function() {
  Characteristic.call(this, 'Status Tampered', '0000007A-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.StatusTampered, Characteristic);

Characteristic.StatusTampered.UUID = '0000007A-0000-1000-8000-0026BB765291';

// The value property of StatusTampered must be one of the following:
Characteristic.StatusTampered.NOT_TAMPERED = 0;
Characteristic.StatusTampered.TAMPERED = 1;

/**
 * Characteristic "Target Door State"
 */

Characteristic.TargetDoorState = function() {
  Characteristic.call(this, 'Target Door State', '00000032-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetDoorState, Characteristic);

Characteristic.TargetDoorState.UUID = '00000032-0000-1000-8000-0026BB765291';

// The value property of TargetDoorState must be one of the following:
Characteristic.TargetDoorState.OPEN = 0;
Characteristic.TargetDoorState.CLOSED = 1;

/**
 * Characteristic "Target Heating Cooling State"
 */

Characteristic.TargetHeatingCoolingState = function() {
  Characteristic.call(this, 'Target Heating Cooling State', '00000033-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetHeatingCoolingState, Characteristic);

Characteristic.TargetHeatingCoolingState.UUID = '00000033-0000-1000-8000-0026BB765291';

// The value property of TargetHeatingCoolingState must be one of the following:
Characteristic.TargetHeatingCoolingState.OFF = 0;
Characteristic.TargetHeatingCoolingState.HEAT = 1;
Characteristic.TargetHeatingCoolingState.COOL = 2;
Characteristic.TargetHeatingCoolingState.AUTO = 3;

/**
 * Characteristic "Target Horizontal Tilt Angle"
 */

Characteristic.TargetHorizontalTiltAngle = function() {
  Characteristic.call(this, 'Target Horizontal Tilt Angle', '0000007B-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.ARC_DEGREE,
    maxValue: 90,
    minValue: -90,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetHorizontalTiltAngle, Characteristic);

Characteristic.TargetHorizontalTiltAngle.UUID = '0000007B-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Target Position"
 */

Characteristic.TargetPosition = function() {
  Characteristic.call(this, 'Target Position', '0000007C-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetPosition, Characteristic);

Characteristic.TargetPosition.UUID = '0000007C-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Target Relative Humidity"
 */

Characteristic.TargetRelativeHumidity = function() {
  Characteristic.call(this, 'Target Relative Humidity', '00000034-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetRelativeHumidity, Characteristic);

Characteristic.TargetRelativeHumidity.UUID = '00000034-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Target Temperature"
 */

Characteristic.TargetTemperature = function() {
  Characteristic.call(this, 'Target Temperature', '00000035-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.FLOAT,
    unit: Characteristic.Units.CELSIUS,
    maxValue: 38,
    minValue: 10,
    minStep: 0.1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetTemperature, Characteristic);

Characteristic.TargetTemperature.UUID = '00000035-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Target Vertical Tilt Angle"
 */

Characteristic.TargetVerticalTiltAngle = function() {
  Characteristic.call(this, 'Target Vertical Tilt Angle', '0000007D-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.ARC_DEGREE,
    maxValue: 90,
    minValue: -90,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TargetVerticalTiltAngle, Characteristic);

Characteristic.TargetVerticalTiltAngle.UUID = '0000007D-0000-1000-8000-0026BB765291';

/**
 * Characteristic "Temperature Display Units"
 */

Characteristic.TemperatureDisplayUnits = function() {
  Characteristic.call(this, 'Temperature Display Units', '00000036-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TemperatureDisplayUnits, Characteristic);

Characteristic.TemperatureDisplayUnits.UUID = '00000036-0000-1000-8000-0026BB765291';

// The value property of TemperatureDisplayUnits must be one of the following:
Characteristic.TemperatureDisplayUnits.CELSIUS = 0;
Characteristic.TemperatureDisplayUnits.FAHRENHEIT = 1;

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
 * Characteristic "Tunneled Accessory HAP Identifier"
 */

Characteristic.TunneledAccessoryHAPIdentifier = function() {
  Characteristic.call(this, 'Tunneled Accessory HAP Identifier', '00000057-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ]
  });
  this.value = this.getDefaultValue();
};

inherits(Characteristic.TunneledAccessoryHAPIdentifier, Characteristic);

Characteristic.TunneledAccessoryHAPIdentifier.UUID = '00000057-0000-1000-8000-0026BB765291';

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
 * Service "Accessory Information"
 */

Service.AccessoryInformation = function(displayName, subtype) {
  Service.call(this, displayName, '0000003E-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Identify);
  this.addCharacteristic(Characteristic.Manufacturer);
  this.addCharacteristic(Characteristic.Model);
  this.addCharacteristic(Characteristic.Name);
  this.addCharacteristic(Characteristic.SerialNumber);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.FirmwareRevision);
  this.addOptionalCharacteristic(Characteristic.HardwareRevision);
  this.addOptionalCharacteristic(Characteristic.SoftwareRevision);
};

inherits(Service.AccessoryInformation, Service);

Service.AccessoryInformation.UUID = '0000003E-0000-1000-8000-0026BB765291';

/**
 * Service "Air Quality Sensor"
 */

Service.AirQualitySensor = function(displayName, subtype) {
  Service.call(this, displayName, '0000008D-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.AirQuality);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.AirParticulateDensity);
  this.addOptionalCharacteristic(Characteristic.AirParticulateSize);
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.AirQualitySensor, Service);

Service.AirQualitySensor.UUID = '0000008D-0000-1000-8000-0026BB765291';

/**
 * Service "Battery Service"
 */

Service.BatteryService = function(displayName, subtype) {
  Service.call(this, displayName, '00000096-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.BatteryLevel);
  this.addCharacteristic(Characteristic.ChargingState);
  this.addCharacteristic(Characteristic.StatusLowBattery);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.BatteryService, Service);

Service.BatteryService.UUID = '00000096-0000-1000-8000-0026BB765291';

/**
 * Service "Bridge Configuration"
 */

Service.BridgeConfiguration = function(displayName, subtype) {
  Service.call(this, displayName, '00000101-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.ConfigureBridgedAccessoryStatus);
  this.addCharacteristic(Characteristic.DiscoverBridgedAccessories);
  this.addCharacteristic(Characteristic.DiscoveredBridgedAccessories);
  this.addCharacteristic(Characteristic.ConfigureBridgedAccessory);

  // Optional Characteristics
};

inherits(Service.BridgeConfiguration, Service);

Service.BridgeConfiguration.UUID = '00000101-0000-1000-8000-0026BB765291';

/**
 * Service "Bridging State"
 */

Service.BridgingState = function(displayName, subtype) {
  Service.call(this, displayName, '00000062-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Reachable);
  this.addCharacteristic(Characteristic.LinkQuality);
  this.addCharacteristic(Characteristic.LinkAddress);
  this.addCharacteristic(Characteristic.Category);
  this.addCharacteristic(Characteristic.LinkType);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.BridgingState, Service);

Service.BridgingState.UUID = '00000062-0000-1000-8000-0026BB765291';

/**
 * Service "Carbon Dioxide Sensor"
 */

Service.CarbonDioxideSensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000097-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CarbonDioxideDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.CarbonDioxideLevel);
  this.addOptionalCharacteristic(Characteristic.CarbonDioxidePeakLevel);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.CarbonDioxideSensor, Service);

Service.CarbonDioxideSensor.UUID = '00000097-0000-1000-8000-0026BB765291';

/**
 * Service "Carbon Monoxide Sensor"
 */

Service.CarbonMonoxideSensor = function(displayName, subtype) {
  Service.call(this, displayName, '0000007F-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CarbonMonoxideDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.CarbonMonoxideLevel);
  this.addOptionalCharacteristic(Characteristic.CarbonMonoxidePeakLevel);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.CarbonMonoxideSensor, Service);

Service.CarbonMonoxideSensor.UUID = '0000007F-0000-1000-8000-0026BB765291';

/**
 * Service "Contact Sensor"
 */

Service.ContactSensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000080-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.ContactSensorState);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.ContactSensor, Service);

Service.ContactSensor.UUID = '00000080-0000-1000-8000-0026BB765291';

/**
 * Service "Door"
 */

Service.Door = function(displayName, subtype) {
  Service.call(this, displayName, '00000081-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentPosition);
  this.addCharacteristic(Characteristic.PositionState);
  this.addCharacteristic(Characteristic.TargetPosition);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.HoldPosition);
  this.addOptionalCharacteristic(Characteristic.ObstructionDetected);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Door, Service);

Service.Door.UUID = '00000081-0000-1000-8000-0026BB765291';

/**
 * Service "Fan"
 */

Service.Fan = function(displayName, subtype) {
  Service.call(this, displayName, '00000040-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.On);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.RotationDirection);
  this.addOptionalCharacteristic(Characteristic.RotationSpeed);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Fan, Service);

Service.Fan.UUID = '00000040-0000-1000-8000-0026BB765291';

/**
 * Service "Garage Door Opener"
 */

Service.GarageDoorOpener = function(displayName, subtype) {
  Service.call(this, displayName, '00000041-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentDoorState);
  this.addCharacteristic(Characteristic.TargetDoorState);
  this.addCharacteristic(Characteristic.ObstructionDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.LockCurrentState);
  this.addOptionalCharacteristic(Characteristic.LockTargetState);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.GarageDoorOpener, Service);

Service.GarageDoorOpener.UUID = '00000041-0000-1000-8000-0026BB765291';

/**
 * Service "Humidity Sensor"
 */

Service.HumiditySensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000082-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentRelativeHumidity);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.HumiditySensor, Service);

Service.HumiditySensor.UUID = '00000082-0000-1000-8000-0026BB765291';

/**
 * Service "Leak Sensor"
 */

Service.LeakSensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000083-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.LeakDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.LeakSensor, Service);

Service.LeakSensor.UUID = '00000083-0000-1000-8000-0026BB765291';

/**
 * Service "Light Sensor"
 */

Service.LightSensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000084-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentAmbientLightLevel);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.LightSensor, Service);

Service.LightSensor.UUID = '00000084-0000-1000-8000-0026BB765291';

/**
 * Service "Lightbulb"
 */

Service.Lightbulb = function(displayName, subtype) {
  Service.call(this, displayName, '00000043-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.On);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Brightness);
  this.addOptionalCharacteristic(Characteristic.Hue);
  this.addOptionalCharacteristic(Characteristic.Saturation);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Lightbulb, Service);

Service.Lightbulb.UUID = '00000043-0000-1000-8000-0026BB765291';

/**
 * Service "Lock Management"
 */

Service.LockManagement = function(displayName, subtype) {
  Service.call(this, displayName, '00000044-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.LockControlPoint);
  this.addCharacteristic(Characteristic.Version);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Logs);
  this.addOptionalCharacteristic(Characteristic.AudioFeedback);
  this.addOptionalCharacteristic(Characteristic.LockManagementAutoSecurityTimeout);
  this.addOptionalCharacteristic(Characteristic.AdministratorOnlyAccess);
  this.addOptionalCharacteristic(Characteristic.LockLastKnownAction);
  this.addOptionalCharacteristic(Characteristic.CurrentDoorState);
  this.addOptionalCharacteristic(Characteristic.MotionDetected);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.LockManagement, Service);

Service.LockManagement.UUID = '00000044-0000-1000-8000-0026BB765291';

/**
 * Service "Lock Mechanism"
 */

Service.LockMechanism = function(displayName, subtype) {
  Service.call(this, displayName, '00000045-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.LockCurrentState);
  this.addCharacteristic(Characteristic.LockTargetState);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.LockMechanism, Service);

Service.LockMechanism.UUID = '00000045-0000-1000-8000-0026BB765291';

/**
 * Service "Motion Sensor"
 */

Service.MotionSensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000085-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.MotionDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.MotionSensor, Service);

Service.MotionSensor.UUID = '00000085-0000-1000-8000-0026BB765291';

/**
 * Service "Occupancy Sensor"
 */

Service.OccupancySensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000086-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.OccupancyDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.OccupancySensor, Service);

Service.OccupancySensor.UUID = '00000086-0000-1000-8000-0026BB765291';

/**
 * Service "Outlet"
 */

Service.Outlet = function(displayName, subtype) {
  Service.call(this, displayName, '00000047-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.On);
  this.addCharacteristic(Characteristic.OutletInUse);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Outlet, Service);

Service.Outlet.UUID = '00000047-0000-1000-8000-0026BB765291';

/**
 * Service "Security System"
 */

Service.SecuritySystem = function(displayName, subtype) {
  Service.call(this, displayName, '0000007E-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.SecuritySystemCurrentState);
  this.addCharacteristic(Characteristic.SecuritySystemTargetState);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.SecuritySystemAlarmType);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.SecuritySystem, Service);

Service.SecuritySystem.UUID = '0000007E-0000-1000-8000-0026BB765291';

/**
 * Service "Smoke Sensor"
 */

Service.SmokeSensor = function(displayName, subtype) {
  Service.call(this, displayName, '00000087-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.SmokeDetected);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.SmokeSensor, Service);

Service.SmokeSensor.UUID = '00000087-0000-1000-8000-0026BB765291';

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

/**
 * Service "Stateless Programmable Switch"
 */

Service.StatelessProgrammableSwitch = function(displayName, subtype) {
  Service.call(this, displayName, '00000089-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.ProgrammableSwitchEvent);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.StatelessProgrammableSwitch, Service);

Service.StatelessProgrammableSwitch.UUID = '00000089-0000-1000-8000-0026BB765291';

/**
 * Service "Switch"
 */

Service.Switch = function(displayName, subtype) {
  Service.call(this, displayName, '00000049-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.On);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Switch, Service);

Service.Switch.UUID = '00000049-0000-1000-8000-0026BB765291';

/**
 * Service "Temperature Sensor"
 */

Service.TemperatureSensor = function(displayName, subtype) {
  Service.call(this, displayName, '0000008A-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentTemperature);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.StatusActive);
  this.addOptionalCharacteristic(Characteristic.StatusFault);
  this.addOptionalCharacteristic(Characteristic.StatusLowBattery);
  this.addOptionalCharacteristic(Characteristic.StatusTampered);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.TemperatureSensor, Service);

Service.TemperatureSensor.UUID = '0000008A-0000-1000-8000-0026BB765291';

/**
 * Service "Thermostat"
 */

Service.Thermostat = function(displayName, subtype) {
  Service.call(this, displayName, '0000004A-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentHeatingCoolingState);
  this.addCharacteristic(Characteristic.TargetHeatingCoolingState);
  this.addCharacteristic(Characteristic.CurrentTemperature);
  this.addCharacteristic(Characteristic.TargetTemperature);
  this.addCharacteristic(Characteristic.TemperatureDisplayUnits);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.CurrentRelativeHumidity);
  this.addOptionalCharacteristic(Characteristic.TargetRelativeHumidity);
  this.addOptionalCharacteristic(Characteristic.CoolingThresholdTemperature);
  this.addOptionalCharacteristic(Characteristic.HeatingThresholdTemperature);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Thermostat, Service);

Service.Thermostat.UUID = '0000004A-0000-1000-8000-0026BB765291';

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
  this.addCharacteristic(Characteristic.TunneledAccessoryHAPIdentifier);
  this.addCharacteristic(Characteristic.TunneledAccessoryStateNumber);
  this.addCharacteristic(Characteristic.TunneledAccessoryConnected);
  this.addCharacteristic(Characteristic.TunneledAccessoryAdvertising);
  this.addCharacteristic(Characteristic.TunnelConnectionTimeout);

  // Optional Characteristics
};

inherits(Service.TunneledBTLEAccessoryService, Service);

Service.TunneledBTLEAccessoryService.UUID = '00000056-0000-1000-8000-0026BB765291';

/**
 * Service "Window"
 */

Service.Window = function(displayName, subtype) {
  Service.call(this, displayName, '0000008B-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentPosition);
  this.addCharacteristic(Characteristic.TargetPosition);
  this.addCharacteristic(Characteristic.PositionState);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.HoldPosition);
  this.addOptionalCharacteristic(Characteristic.ObstructionDetected);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.Window, Service);

Service.Window.UUID = '0000008B-0000-1000-8000-0026BB765291';

/**
 * Service "Window Covering"
 */

Service.WindowCovering = function(displayName, subtype) {
  Service.call(this, displayName, '0000008C-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.CurrentPosition);
  this.addCharacteristic(Characteristic.TargetPosition);
  this.addCharacteristic(Characteristic.PositionState);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.HoldPosition);
  this.addOptionalCharacteristic(Characteristic.TargetHorizontalTiltAngle);
  this.addOptionalCharacteristic(Characteristic.TargetVerticalTiltAngle);
  this.addOptionalCharacteristic(Characteristic.CurrentHorizontalTiltAngle);
  this.addOptionalCharacteristic(Characteristic.CurrentVerticalTiltAngle);
  this.addOptionalCharacteristic(Characteristic.ObstructionDetected);
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.WindowCovering, Service);

Service.WindowCovering.UUID = '0000008C-0000-1000-8000-0026BB765291';

