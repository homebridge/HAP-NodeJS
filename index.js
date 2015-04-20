var accessory_Factor           = new require("./Accessory.js");
var accessoryController_Factor = new require("./AccessoryController.js");
var service_Factor             = new require("./Service.js");
var characteristic_Factor      = new require("./Characteristic.js");
var bridge_Factor              = new require("./BridgedAccessoryController.js");
var types                      = new require("./accessories/types.js");

var exports = module.exports = {};
exports.accessoryFactory           = accessory_Factor;
exports.accessoryControllerFactory = accessoryController_Factor;
exports.serviceFactory             = service_Factor;
exports.characteristicFactory      = characteristic_Factor;
exports.bridgeFactory              = bridge_Factor;
exports.types                      = types;
