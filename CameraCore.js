var storage = require('node-persist');
var uuid = require('./').uuid;
var Accessory = require('./').Accessory;
var Camera = require('./').Camera;

console.log("HAP-NodeJS starting...");

// Initialize our storage system
storage.initSync();

// Start by creating our Bridge which will host all loaded Accessories
var cameraAccessory = new Accessory('Node Camera', uuid.generate("Node Camera"));

var cameraSource = new Camera([{
    uri: 'rtsp://planetbeing:c1VVbSratQxw@192.168.0.121:88/videoMain',
    width: 1280,
    height: 720,
    fps: 30
}]);

cameraAccessory.configureCameraSource(cameraSource);

cameraAccessory.on('identify', function(paired, callback) {
  console.log("Node Camera identify");
  callback(); // success
});

// Publish the camera on the local network.
cameraAccessory.publish({
  username: "FC:22:3D:D3:CE:F5",
  port: 51062,
  pincode: "031-45-154",
  category: Accessory.Categories.CAMERA
}, true);
