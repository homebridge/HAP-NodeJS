var types = require("./types.js")
var dgram = require('dgram')
var exports = module.exports = {};

var sequenceNumber = 100;

var server = dgram.createSocket("udp4");

var queue = [];

server.on("error", function (err) {
  console.warn("server error:\n" + err.stack);
  server.close();
});

server.on("message", function (msg, rinfo) {
  console.log("server got: " + msg + " from " +
  rinfo.address + ":" + rinfo.port);
});

server.on("listening", function () {
  server.setBroadcast(true);
});

server.bind(9761);

function sendRegister(value) {
  queue.push({func: "*p"});
}

function send(room, device, func) {
  for (i = 0; i < queue.length; i++) {
    if (queue[i].room == room && queue[i].device == device) {
      queue.splice(i, 1);
    }
  }

  queue.push({room: room, device: device, func: func});
}

function sendFromQueue() {
  var command = queue.shift();

  if (command) {
    var buffer = new Buffer(sequenceNumber + ",!" + (command.room? "R" + command.room : "") + (command.device? "D" + command.device : "") + "F" + command.func + "\n");

    if( sequenceNumber++ == 1000) {
      sequenceNumber = 100;
    }

    console.log(buffer.toString());

    server.send(buffer, 0, buffer.length, 9760, "255.255.255.255", function(err, bytes) {
      if (err) {
        console.error(err);
      }
    });
  }
}

setInterval(sendFromQueue, 500);

function accessoryInformation(name) {
  return {
    sType: types.ACCESSORY_INFORMATION_STYPE,
    characteristics: [{
      cType: types.NAME_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: name,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.MANUFACTURER_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "Siemens",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.MODEL_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "Link v1",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.SERIAL_NUMBER_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "123ABC",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Bla",
      designedMaxLength: 255
    },{
      cType: types.IDENTIFY_CTYPE,
      onUpdate: function(value) { sendRegister(value) },
      perms: ["pw"],
      format: "bool",
      initialValue: false,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Identify Accessory",
      designedMaxLength: 1
    }]
  };
}

function light(name, room, device) {
  return {
    services: [accessoryInformation(name),
    {
      sType: types.LIGHTBULB_STYPE,
      characteristics: [{
        cType: types.NAME_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: name,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Bla",
        designedMaxLength: 255
      },{
        cType: types.POWER_STATE_CTYPE,
        onUpdate: function(value) { send(room, device, value? "1" : "0") },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Turn On the Light",
        designedMaxLength: 1
      },{
        cType: types.BRIGHTNESS_CTYPE,
        onUpdate: function(value) { send(room, device, "dP" + (value * 32 / 100).toFixed(0)) },
        perms: ["pw","pr","ev"],
        format: "int",
        initialValue: 0,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Adjust Brightness of Light",
        designedMinValue: 0,
        designedMaxValue: 100,
        designedMinStep: 6.25,
        unit: "%"
      },{
        cType: "20000001-0000-1000-8000-0026BB765291",
        onUpdate: function(value) { send(room, device, value? "d" : "uu") },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Lock the light switch",
        designedMaxLength: 1
      }]
    }]
  };
}

function socket(name, room, device) {
  return {
    services: [accessoryInformation(name),
    {
      sType: types.LIGHTBULB_STYPE,
      characteristics: [{
        cType: types.NAME_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: name,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Bla",
        designedMaxLength: 255
      },{
        cType: types.POWER_STATE_CTYPE,
        onUpdate: function(value) { send(room, device, value? "1" : "0") },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Turn On the Light",
        designedMaxLength: 1
      },{
        cType: "20000001-0000-1000-8000-0026BB765291",
        onUpdate: function(value) { send(room, device, value? "l" : "u") },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Lock the light switch",
        designedMaxLength: 1
      }]
    }]
  };
}

function link() {
  return {
    services: [
      accessoryInformation("LightwaveRF Link")
    ]
  };
}

exports.accessories = {
  displayName: "LightwaveRF Link",
  username: "1A:2B:3C:4D:5E:6F",
  pincode: "031-45-154",
  accessories: [
    link(),
    light("Test light 1", 1, 2),
    socket("Light one", 1, 1),
    socket("Light two", 2, 1),
    socket("Light three", 3, 1)
  ]
}
