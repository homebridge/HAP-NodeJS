'use strict';

const dgram = require('dgram');
const EventEmitter = require('events').EventEmitter;

class RTPProxy extends EventEmitter {
  constructor(options) {
    super();

    let self = this;
    self.type = options.isIPV6 ? 'udp6' : 'udp4';

    self.options = options;
    self.startingPort = 10000;

    self.outgoingAddress = options.outgoingAddress;
    self.outgoingPort = options.outgoingPort;
    self.incomingPayloadType = 0;
    self.outgoingSSRC = options.outgoingSSRC;
    self.disabled = options.disabled;
    self.incomingSSRC = null;
    self.outgoingPayloadType = null;
  }

  setup() {
    let self = this;
    return self.createSocketPair(self.type)
      .then(function(sockets) {
        self.incomingRTPSocket = sockets[0];
        self.incomingRTCPSocket = sockets[1];

      return self.createSocket(self.type);
    }).then(function(socket) {
        self.outgoingSocket = socket;
        self.onBound();
    });
  }

  destroy() {
    let self = this;
    if (self.incomingRTPSocket) {
      self.incomingRTPSocket.close();
    }

    if (self.incomingRTCPSocket) {
      self.incomingRTCPSocket.close();
    }

    if (self.outgoingSocket) {
      self.outgoingSocket.close();
    }
  }

  incomingRTPPort() {
    let self = this;
    return self.incomingRTPSocket.address().port;
  }

  incomingRTCPPort() {
    let self = this;
    return self.incomingRTCPSocket.address().port;
  }

  outgoingLocalPort() {
    let self = this;
    return self.outgoingSocket.address().port;
  }

  setServerAddress(address) {
    let self = this;
    self.serverAddress = address;
  }

  setServerRTPPort(port) {
    let self = this;
    self.serverRTPPort = port;
  }

  setServerRTCPPort(port) {
    let self = this;
    self.serverRTCPPort = port;
  }

  setIncomingPayloadType(pt) {
    let self = this;
    self.incomingPayloadType = pt;
  }

  setOutgoingPayloadType(pt) {
    let self = this;
    self.outgoingPayloadType = pt;
  }

  sendOut(msg) {
    let self = this;
    // Just drop it if we're not setup yet, I guess.
    if(!self.outgoingAddress || !self.outgoingPort)
      return;

    self.outgoingSocket.send(msg, self.outgoingPort, self.outgoingAddress);
  }

  sendBack(msg) {
    let self = this;
    // Just drop it if we're not setup yet, I guess.
    if(!self.serverAddress || !self.serverRTCPPort)
      return;

    self.outgoingSocket.send(msg, self.serverRTCPPort, self.serverAddress);
  }

  onBound() {
    let self = this;
    if(self.disabled)
      return;

    self.incomingRTPSocket.on('message', function(msg, rinfo) {
        self.rtpMessage(msg);
        });

    self.incomingRTCPSocket.on('message', function(msg, rinfo) {
        self.rtcpMessage(msg);
        });

    self.outgoingSocket.on('message', function(msg, rinfo) {
        self.rtcpReply(msg);
        });
  }

  rtpMessage(msg) {
    let self = this;

    if(msg.length < 12) {
      // Not a proper RTP packet. Just forward it.
      self.sendOut(msg);
      return;
    }

    let mpt = msg.readUInt8(1);
    let pt = mpt & 0x7F;
    if(pt == self.incomingPayloadType) {
      mpt = (mpt & 0x80) | self.outgoingPayloadType;
      msg.writeUInt8(mpt, 1);
    }

    if(self.incomingSSRC === null)
      self.incomingSSRC = msg.readUInt32BE(4);

    msg.writeUInt32BE(self.outgoingSSRC, 8);
    self.sendOut(msg);
  }

  processRTCPMessage(msg, transform) {
    let self = this;
    let rtcpPackets = [];
    let offset = 0;
    while((offset + 4) <= msg.length) {
      let pt = msg.readUInt8(offset + 1);
      let len = msg.readUInt16BE(offset + 2) * 4;
      if((offset + 4 + len) > msg.length)
        break;
      let packet = msg.slice(offset, offset + 4 + len);

      packet = transform(pt, packet);

      if(packet)
        rtcpPackets.push(packet);

      offset += 4 + len;
    }

    if(rtcpPackets.length > 0)
      return Buffer.concat(rtcpPackets);

    return null;
  }

  rtcpMessage(msg) {
    let self = this;

    let processed = self.processRTCPMessage(msg, function(pt, packet) {
      if(pt != 200 || packet.length < 8)
        return packet;

      if(self.incomingSSRC === null)
        self.incomingSSRC = packet.readUInt32BE(4);
      packet.writeUInt32BE(self.outgoingSSRC, 4);
      return packet;
    });

    if(processed)
      self.sendOut(processed);
  }

  rtcpReply(msg) {
    let self = this;

    let processed = self.processRTCPMessage(msg, function(pt, packet) {
      if(pt != 201 || packet.length < 12)
        return packet;

      // Assume source 1 is the one we want to edit.
      packet.writeUInt32BE(self.incomingSSRC, 8);
      return packet;
    });


    if(processed)
      self.sendOut(processed);
  }

  createSocket(type) {
    let self = this;
    return new Promise(function(resolve, reject) {
      let retry = function() {
        let socket = dgram.createSocket(type);

        let bindErrorHandler = function() {
          if(self.startingPort == 65535)
            self.startingPort = 10000;
          else
            ++self.startingPort;

          socket.close();
          retry();
        };

        socket.once('error', bindErrorHandler);

        socket.on('listening', function() {
          resolve(socket);
        });

        socket.bind(self.startingPort);
      };

      retry();
    });
  }

  createSocketPair(type) {
    let self = this;
    return new Promise(function(resolve, reject) {
      let retry = function() {
        let socket1 = dgram.createSocket(type);
        let socket2 = dgram.createSocket(type);
        let state = {socket1: 0, socket2: 0};

        let recheck = function() {
          if(state.socket1 == 0 || state.socket2 == 0)
            return;

          if(state.socket1 == 2 && state.socket2 == 2) {
            resolve([socket1, socket2]);
            return;
          }

          if(self.startingPort == 65534)
            self.startingPort = 10000;
          else
            ++self.startingPort;

          socket1.close();
          socket2.close();

          retry(self.startingPort);
        }

        socket1.once('error', function() {
          state.socket1 = 1;
          recheck();
        });

        socket2.once('error', function() {
          state.socket2 = 1;
          recheck();
        });

        socket1.once('listening', function() {
          state.socket1 = 2;
          recheck();
        });

        socket2.once('listening', function() {
          state.socket2 = 2;
          recheck();
        });

        socket1.bind(self.startingPort);
        socket2.bind(self.startingPort + 1);
      }

      retry();
    });
  }
}

module.exports = RTPProxy;
