var Accessory = require('./lib/Accessory.js').Accessory;
var Bridge = require('./lib/Bridge.js').Bridge;
var Camera = require('./lib/Camera.js').Camera;
var Service = require('./lib/Service.js').Service;
var Characteristic = require('./lib/Characteristic.js').Characteristic;
var uuid = require('./lib/util/uuid');
var AccessoryLoader = require('./lib/AccessoryLoader.js');
var StreamController = require('./lib/StreamController.js').StreamController;
var storage = require('node-persist');

// ensure Characteristic subclasses are defined
var HomeKitTypes = require('./lib/gen/HomeKitTypes');

module.exports = {
  init: init,
  Accessory: Accessory,
  Bridge: Bridge,
  Camera: Camera,
  Service: Service,
  Characteristic: Characteristic,
  uuid: uuid,
  AccessoryLoader: AccessoryLoader,
  StreamController: StreamController
}

function init(storagePath) {
  // initialize our underlying storage system, passing on the directory if needed
  if (typeof storagePath !== 'undefined')
    storage.initSync({ dir: storagePath });
  else
    storage.initSync(); // use whatever is default
}