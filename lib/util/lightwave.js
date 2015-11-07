var dgram = require('dgram')
var macfromip = require('macfromip');

module.exports = {
  getRevisionAndMac: getRevisionAndMac,
  send: send
}

var sequenceNumber = 100;
var callbacks = [];

var server = dgram.createSocket("udp4");

var queue = [];

function getVersion() {
  return version
}

server.on("error", function (err) {
  console.warn("server error:\n" + err.stack);
  server.close();
});

server.on("message", function (msg, rinfo) {
  var recvSequenceNumber = 'S' + String(msg).substring(0, 3)

  var callback = false

  if (callbacks[recvSequenceNumber]) {
    callbacks[recvSequenceNumber](msg, rinfo)
    delete callbacks[recvSequenceNumber]
    callback = true
  }

  console.log("recv: " + String(msg).replace('\n', '') + " (callback=" + callback + ")")
});

server.on("listening", function () {
  server.setBroadcast(true);
});

server.bind(9761);

function getRevisionAndMac(callback) {
  send("", "", "*p", "Retrieving", "Version", function(msg, rinfo) {
    var str = String(msg)
    var revision = str.substring(8, str.length - 3);

    macfromip.getMac(rinfo.address, function(err, data){
        var mac = 'XX:XX:XX:XX:XX:XX';

        if(err){
            console.log(err);
        } else {
          mac = '';

          var match = data.match(/([0-9A-Fa-f]{1,2}):([0-9A-Fa-f]{1,2}):([0-9A-Fa-f]{1,2}):([0-9A-Fa-f]{1,2}):([0-9A-Fa-f]{1,2}):([0-9A-Fa-f]{1,2}).*/)

          for (i = 1; i <= 6; i++) {
            mac += (i > 1? ':' : '') + (match[i].length == 1? '0' : '') + match[i];
          }
        }

        callback(revision, mac.toUpperCase())
    });
  })
}

function send(room, device, func, line1, line2, callback) {
  for (i = 0; i < queue.length; i++) {
    if (queue[i].room == room && queue[i].device == device) {
      queue.splice(i, 1);
    }
  }

  queue.push({room: room, device: device, func: func, line1: line1, line2: line2, callback: callback});
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

    if (command.callback) {
      callbacks[String('S' + sequenceNumber)] = command.callback;
    }

    if( sequenceNumber++ == 1000) {
      sequenceNumber = 100;
    }

    console.log("send: " + buffer.toString().replace('\n', ''));

    server.send(buffer, 0, buffer.length, 9760, "255.255.255.255", function(err, bytes) {
      if (err) {
        console.error(err);
      }
    });
  }
}

setInterval(sendFromQueue, 250);
