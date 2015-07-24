var exports = module.exports = {};

//HomeKit Types UUID's

var stPre = "000000";
var stPost = "-0000-1000-8000-0026BB765291";


//HomeKitTransportCategoryTypes
exports.OTHER_TCTYPE = 1;
exports.FAN_TCTYPE = 3;
exports.GARAGE_DOOR_OPENER_TCTYPE = 4;
exports.LIGHTBULB_TCTYPE = 5;
exports.DOOR_LOCK_TCTYPE = 6;
exports.OUTLET_TCTYPE = 7;
exports.SWITCH_TCTYPE = 8;
exports.THERMOSTAT_TCTYPE = 9;
exports.SENSOR_TCTYPE = 10;
exports.ALARM_SYSTEM_TCTYPE = 11;
exports.DOOR_TCTYPE = 12;
exports.WINDOW_TCTYPE = 13;
exports.WINDOW_COVERING_TCTYPE = 14;
exports.PROGRAMMABLE_SWITCH_TCTYPE = 15;

//HomeKitServiceTypes

exports.LIGHTBULB_STYPE = stPre + "43" + stPost;
exports.SWITCH_STYPE = stPre + "49" + stPost;
exports.THERMOSTAT_STYPE = stPre + "4A" + stPost;
exports.GARAGE_DOOR_OPENER_STYPE = stPre + "41" + stPost;
exports.ACCESSORY_INFORMATION_STYPE = stPre + "3E" + stPost;
exports.FAN_STYPE = stPre + "40" + stPost;
exports.OUTLET_STYPE = stPre + "47" + stPost;
exports.LOCK_MECHANISM_STYPE = stPre + "45" + stPost;
exports.LOCK_MANAGEMENT_STYPE = stPre + "44" + stPost;
exports.ALARM_STYPE = stPre + "7E" + stPost;
exports.WINDOW_COVERING_STYPE = stPre + "8C" + stPost;
exports.OCCUPANCY_SENSOR_STYPE = stPre + "86" + stPost;
exports.CONTACT_SENSOR_STYPE = stPre + "80" + stPost;
exports.MOTION_SENSOR_STYPE = stPre + "85" + stPost;
exports.HUMIDITY_SENSOR_STYPE = stPre + "82" + stPost;
exports.TEMPERATURE_SENSOR_STYPE = stPre + "8A" + stPost;

//HomeKitCharacteristicsTypes


exports.ALARM_CURRENT_STATE_CTYPE = stPre + "66" + stPost;
exports.ALARM_TARGET_STATE_CTYPE = stPre + "67" + stPost;
exports.ADMIN_ONLY_ACCESS_CTYPE = stPre + "01" + stPost;
exports.AUDIO_FEEDBACK_CTYPE = stPre + "05" + stPost;
exports.BRIGHTNESS_CTYPE = stPre + "08" + stPost;
exports.BATTERY_LEVEL_CTYPE = stPre + "68" + stPost;
exports.COOLING_THRESHOLD_CTYPE = stPre + "0D" + stPost;
exports.CONTACT_SENSOR_STATE_CTYPE = stPre + "6A" + stPost;
exports.CURRENT_DOOR_STATE_CTYPE = stPre + "0E" + stPost;
exports.CURRENT_LOCK_MECHANISM_STATE_CTYPE = stPre + "1D" + stPost;
exports.CURRENT_RELATIVE_HUMIDITY_CTYPE = stPre + "10" + stPost;
exports.CURRENT_TEMPERATURE_CTYPE = stPre + "11" + stPost;
exports.HEATING_THRESHOLD_CTYPE = stPre + "12" + stPost;
exports.HUE_CTYPE = stPre + "13" + stPost;
exports.IDENTIFY_CTYPE = stPre + "14" + stPost;
exports.LOCK_MANAGEMENT_AUTO_SECURE_TIMEOUT_CTYPE = stPre + "1A" + stPost;
exports.LOCK_MANAGEMENT_CONTROL_POINT_CTYPE = stPre + "19" + stPost;
exports.LOCK_MECHANISM_LAST_KNOWN_ACTION_CTYPE = stPre + "1C" + stPost;
exports.LOGS_CTYPE = stPre + "1F" + stPost;
exports.MANUFACTURER_CTYPE = stPre + "20" + stPost;
exports.MODEL_CTYPE = stPre + "21" + stPost;
exports.MOTION_DETECTED_CTYPE = stPre + "22" + stPost;
exports.NAME_CTYPE = stPre + "23" + stPost;
exports.OBSTRUCTION_DETECTED_CTYPE = stPre + "24" + stPost;
exports.OUTLET_IN_USE_CTYPE = stPre + "26" + stPost;
exports.OCCUPANCY_DETECTED_CTYPE = stPre + "71" + stPost;
exports.POWER_STATE_CTYPE = stPre + "25" + stPost;
exports.PROGRAMMABLE_SWITCH_SWITCH_EVENT_CTYPE = stPre + "73" + stPost;
exports.PROGRAMMABLE_SWITCH_OUTPUT_STATE_CTYPE = stPre + "74" + stPost;
exports.ROTATION_DIRECTION_CTYPE = stPre + "28" + stPost;
exports.ROTATION_SPEED_CTYPE = stPre + "29" + stPost;
exports.SATURATION_CTYPE = stPre + "2F" + stPost;
exports.SERIAL_NUMBER_CTYPE = stPre + "30" + stPost;
exports.STATUS_LOW_BATTERY_CTYPE = stPre + "79" + stPost;
exports.STATUS_FAULT_CTYPE = stPre + "77" + stPost;
exports.TARGET_DOORSTATE_CTYPE = stPre + "32" + stPost;
exports.TARGET_LOCK_MECHANISM_STATE_CTYPE = stPre + "1E" + stPost;
exports.TARGET_RELATIVE_HUMIDITY_CTYPE = stPre + "34" + stPost;
exports.TARGET_TEMPERATURE_CTYPE = stPre + "35" + stPost;
exports.TEMPERATURE_UNITS_CTYPE = stPre + "36" + stPost;
exports.VERSION_CTYPE = stPre + "37" + stPost;
exports.WINDOW_COVERING_TARGET_POSITION_CTYPE = stPre + "7C" + stPost;
exports.WINDOW_COVERING_CURRENT_POSITION_CTYPE = stPre + "6D" + stPost;
exports.WINDOW_COVERING_OPERATION_STATE_CTYPE = stPre + "72" + stPost;
exports.CURRENTHEATINGCOOLING_CTYPE = stPre + "0F" + stPost;
exports.TARGETHEATINGCOOLING_CTYPE = stPre + "33" + stPost;
