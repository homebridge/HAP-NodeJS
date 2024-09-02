// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import { EventEmitter } from 'node:events'
import { createConnection as netCreateConnection } from 'node:net'
import process from 'node:process'

import createDebug from 'debug'

import MessageBus from './bus.js'
import clientHandshake from './handshake.js'
import { marshallMessage, unmarshallMessages } from './message.js'

const debug = createDebug('HAP-NodeJS:DBus')

function createStream(opts) {
  if (opts.stream) return opts.stream;
  let host = opts.host;
  let port = opts.port;
  const socket = opts.socket;
  if (socket) return netCreateConnection(socket);
  if (port) return netCreateConnection(port, host);

  const busAddress = opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS;
  if (!busAddress) throw new Error('unknown bus address');

  const addresses = busAddress.split(';');
  for (let i = 0; i < addresses.length; ++i) {
    const address = addresses[i];
    const familyParams = address.split(':');
    const family = familyParams[0];
    const params = {};
    familyParams[1].split(',').map(function (p) {
      const keyVal = p.split('=');
      params[keyVal[0]] = keyVal[1];
    });

    try {
      switch (family.toLowerCase()) {
        case 'tcp':
          host = params.host || 'localhost';
          port = params.port;
          return netCreateConnection(port, host);
        case 'unix':
          if (params.socket) return netCreateConnection(params.socket);
          if (params.path) return netCreateConnection(params.path);
          throw new Error(
            "not enough parameters for 'unix' connection - you need to specify 'socket' or 'abstract' or 'path' parameter"
          );
        default:
          throw new Error('unknown address type:' + family);
      }
    } catch (e) {
      if (i < addresses.length - 1) {
        debug(e.message);
      } else {
        throw e;
      }
    }
  }
}

function createConnection(opts) {
  const self = new EventEmitter();
  if (!opts) opts = {};
  const stream = (self.stream = createStream(opts));
  stream.setNoDelay();

  stream.on('error', function (err) {
    // forward network and stream errors
    self.emit('error', err);
  });

  stream.on('end', function () {
    self.emit('end');
    self.message = function () {
      debug("Didn't write bytes to closed stream");
    };
  });

  self.end = function () {
    stream.end();
    return self;
  };

  clientHandshake(stream, opts, function (error, guid) {
    if (error) {
      return self.emit('error', error);
    }
    self.guid = guid;
    self.emit('connect');
    unmarshallMessages(
      stream,
      function (message) {
        self.emit('message', message);
      },
      opts
    );
  });

  self._messages = [];

  // pre-connect version, buffers all messages. replaced after connect
  self.message = function (msg) {
    self._messages.push(msg);
  };

  self.once('connect', function () {
    self.state = 'connected';
    for (let i = 0; i < self._messages.length; ++i) {
      stream.write(marshallMessage(self._messages[i]));
    }
    self._messages.length = 0;

    // no need to buffer once connected
    self.message = function (msg) {
      stream.write(marshallMessage(msg));
    };
  });

  return self;
}

function createClient (params) {
  const connection = createConnection(params || {});
  return new MessageBus(connection, params || {});
}

export function systemBus() {
  return createClient({
    busAddress: process.env.DBUS_SYSTEM_BUS_ADDRESS || 'unix:path=/var/run/dbus/system_bus_socket'
  });
}
