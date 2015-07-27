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
  queue.push({func: "*p", line1: "Register", line2: "HAP-NodeJS"});
}

function sendIdentity(room, device, line1) {
  queue.push({room: room, device: device, func: "1", line1: line1, line2: "Identify"});
  queue.push({room: room, device: device, func: "0", line1: line1, line2: "Identify"});
}

function send(room, device, func, line1, line2) {
  for (i = 0; i < queue.length; i++) {
    if (queue[i].room == room && queue[i].device == device) {
      queue.splice(i, 1);
    }
  }

  queue.push({room: room, device: device, func: func, line1: line1, line2: line2});
}

function sendFromQueue() {
  var command = queue.shift();

  if (command) {
    var buffer = new Buffer(sequenceNumber + ",!" +
      (command.room? "R" + command.room : "") +
      (command.device? "D" + command.device : "") +
      "F" + command.func +
      "|" + (command.line1? command.line1 : "") +
      "|" + (command.line2? command.line2 : "") +
      "\n");

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

setInterval(sendFromQueue, 250);

// Characteristics

function brightnessCharacteristic(room, device, name) {
  return {
    cType: types.BRIGHTNESS_CTYPE,
    onUpdate: function(value) { send(room, device, "dP" + (value * 32 / 100).toFixed(0), name, "Dim " + value + "%") },
    perms: ["pw","pr","ev"],
    format: "int",
    initialValue: 0,
    supportEvents: false,
    supportBonjour: false,
    manfDescription: "Adjust the brightness of the device",
    designedMinValue: 0,
    designedMaxValue: 100,
    designedMinStep: 6.25,
    unit: "%"
  };
}

function identifyCharacteristic(identityFunction) {
  return {
    cType: types.IDENTIFY_CTYPE,
    onUpdate: identityFunction,
    perms: ["pw"],
    format: "bool",
    supportEvents: false,
    supportBonjour: false,
    manfDescription: "Identify Accessory",
    designedMaxLength: 1
  };
}

function lockCharacteristic(room, device, name) {
  return {
    cType: types.CUSTOM_LW_LOCK_STATE_CTYPE,
    onUpdate: function(value) { send(room, device, value == 0? "u" : value == 1? "l" : "k", name, value == 0? "Unlock" : value == 1? "Lock" : "Double lock") },
    perms: ["pw","pr","ev"],
    format: "int",
    initialValue: false,
    supportEvents: false,
    supportBonjour: false,
    manfDescription: "Lock the device",
    designedMinValue: 0,
    designedMaxValue: 2,
    designedMinStep: 1
  };
}

function nameCharacteristic(name) {
  return stringCharacteristic(types.NAME_CTYPE, name);
}

function powerCharacteristic(room, device, name) {
  return {
    cType: types.POWER_STATE_CTYPE,
    onUpdate: function(value) { send(room, device, value? "1" : "0", name, value? "On" : "Off") },
    perms: ["pw","pr","ev"],
    format: "bool",
    initialValue: false,
    supportEvents: false,
    supportBonjour: false,
    manfDescription: "Turn on the device",
    designedMaxLength: 1
  };
}

function stringCharacteristic(type, value) {
  return {
    cType: type,
    onUpdate: null,
    perms: ["pr"],
    format: "string",
    initialValue: value,
    supportEvents: false,
    supportBonjour: false,
    manfDescription: "Bla",
    designedMaxLength: 255
  };
}

// Services

function accessoryInformation(name, identityFunction) {
  return {
    sType: types.ACCESSORY_INFORMATION_STYPE,
    characteristics: [
      nameCharacteristic(name),
      stringCharacteristic(types.MANUFACTURER_CTYPE, "LightwaveRF"),
      stringCharacteristic(types.MODEL_CTYPE, "JSJSLW500"),
      stringCharacteristic(types.SERIAL_NUMBER_CTYPE, "Unknown"),
      identifyCharacteristic(identityFunction)
    ]
  };
}

// Accessories

function dimmableSocket(name, room, device) {
  return {
    services: [accessoryInformation(name, function(value) { sendIdentity(room, device, name) }),
    {
      sType: types.SWITCH_STYPE,
      characteristics: [
        nameCharacteristic(name),
        powerCharacteristic(room, device, name),
        brightnessCharacteristic(room, device, name),
        lockCharacteristic(room, device, name)
      ]
    }]
  };
}

function link() {
  return {
    services: [
      accessoryInformation("LightwaveRF Link", function(value) { sendRegister(value) })
    ]
  };
}

function light(name, room, device) {
  return {
    services: [accessoryInformation(name, function(value) { sendIdentity(room, device, name) }),
    {
      sType: types.LIGHTBULB_STYPE,
      characteristics: [
        nameCharacteristic(name),
        powerCharacteristic(room, device, name),
        brightnessCharacteristic(room, device, name),
        lockCharacteristic(room, device, name)
      ]
    }]
  };
}

function socket(name, room, device) {
  return {
    services: [accessoryInformation(name, function(value) { sendIdentity(room, device, name) }),
    {
      sType: types.SWITCH_STYPE,
      characteristics: [
        nameCharacteristic(name),
        powerCharacteristic(room, device, name),
        lockCharacteristic(room, device, name)
      ]
    }]
  };
}


exports.accessories = {
  displayName: "LightwaveRF Link",
  username: "1A:2B:3C:4D:5E:6F",
  pincode: "031-45-154",
  accessories: [
    link("LightwaveRF Link"),
    light("Test light 1", 1, 2),
    socket("Light one", 1, 1),
    socket("Light two", 2, 1),
    socket("Light three", 3, 1)
  ]
}
