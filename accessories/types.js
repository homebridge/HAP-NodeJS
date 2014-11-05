var exports = module.exports = {};

//HomeKit Types UUID's

var stPre = "000000";
var stPost = "-0000-1000-8000-0026BB765291";


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

//HomeKitCharacteristicsTypes

exports.ADMIN_ONLY_ACCESS_CTYPE = stPre + "01" + stPost;
exports.AUDIO_FEEDBACK_CTYPE = stPre + "05" + stPost;
exports.BRIGHTNESS_CTYPE = stPre + "08" + stPost;
exports.COOLING_THRESHOLD_CTYPE = stPre + "0D" + stPost;
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
exports.POWER_STATE_CTYPE = stPre + "25" + stPost;
exports.ROTATION_DIRECTION_CTYPE = stPre + "28" + stPost;
exports.ROTATION_SPEED_CTYPE = stPre + "29" + stPost;
exports.SATURATION_CTYPE = stPre + "2F" + stPost;
exports.SERIAL_NUMBER_CTYPE = stPre + "30" + stPost;
exports.TARGET_DOORSTATE_CTYPE = stPre + "32" + stPost;
exports.TARGET_LOCK_MECHANISM_STATE_CTYPE = stPre + "1E" + stPost;
exports.TARGET_RELATIVE_HUMIDITY_CTYPE = stPre + "34" + stPost;
exports.TARGET_TEMPERATURE_CTYPE = stPre + "35" + stPost;
exports.TEMPERATURE_UNITS_CTYPE = stPre + "36" + stPost;
exports.VERSION_CTYPE = stPre + "37" + stPost;
