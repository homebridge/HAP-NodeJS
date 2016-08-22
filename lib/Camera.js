var debug = require('debug')('Camera');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var clone = require('./util/clone').clone;
var uuid = require('./util/uuid');
var Service = require('./Service').Service;
var Characteristic = require('./Characteristic').Characteristic;
var StreamController = require('./StreamController').StreamController;
var HomeKitTypes = require('./gen/HomeKitTypes');

var fs = require('fs');

'use strict';

module.exports = {
  Camera: Camera
};

function Camera() {
  this.services = [];
  this.streamControllers = [];

  this._createCameraControlService();
  this._createStreamControllers(2);
}

Camera.prototype.handleResourceRequest = function(data, callback) {
  debug('Resource Request: ', JSON.stringify(data));
  
  var snapshot = fs.readFileSync(__dirname + '/res/snapshot.jpg');
  callback(undefined, snapshot);
}

// Private

Camera.prototype._createCameraControlService = function() {
  var controlService = new Service.CameraControl();

  // TODO: add camera control support

  this.services.push(controlService);
}

Camera.prototype._createStreamControllers = function(maxStreams) {
  for (var i = 0; i < maxStreams; i++) {
    var streamController = new StreamController(i);

    this.services.push(streamController.service);
    this.streamControllers.push(streamController);
  }
}