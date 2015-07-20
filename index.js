var Accessory = require('./lib/Accessory.js').Accessory;
var Bridge = require('./lib/Bridge.js').Bridge;
var Service = require('./lib/Service.js').Service;
var Characteristic = require('./lib/Characteristic.js').Characteristic;
var uuid = require('./lib/util/uuid');

// ensure Characteristic subclasses are defined
var HomeKitTypes = require('./lib/gen/HomeKitTypes');

module.exports = {
  Accessory: Accessory,
  Bridge: Bridge,
  Service: Service,
  Characteristic: Characteristic,
  uuid: uuid
}