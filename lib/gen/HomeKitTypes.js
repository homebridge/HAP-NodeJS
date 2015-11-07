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

// The value property of ChargingState must be one of the following:
Characteristic.ChargingState.NOT_CHARGING = 0;
Characteristic.ChargingState.CHARGING = 1;

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

// The value property of LeakDetected must be one of the following:
Characteristic.LeakDetected.LEAK_NOT_DETECTED = 0;
Characteristic.LeakDetected.LEAK_DETECTED = 1;

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

// The value property of TemperatureDisplayUnits must be one of the following:
Characteristic.TemperatureDisplayUnits.CELSIUS = 0;
Characteristic.TemperatureDisplayUnits.FAHRENHEIT = 1;

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

/**
 * Service "Bridging State"
 */

Service.BridgingState = function(displayName, subtype) {
  Service.call(this, displayName, '00000062-0000-1000-8000-0026BB765291', subtype);

  // Required Characteristics
  this.addCharacteristic(Characteristic.Reachable);

  // Optional Characteristics
  this.addOptionalCharacteristic(Characteristic.Name);
};

inherits(Service.BridgingState, Service);

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

