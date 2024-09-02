// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import { EventEmitter } from 'node:events'

import createDebug from 'debug'

import constants from './constants.js'
import { introspectBus } from './introspect.js'
import stdDbusIfaces from './stdifaces.js'

const debug = createDebug('HAP-NodeJS:DBus')

export default function MessageBus(conn, opts) {
  if (!(this instanceof MessageBus)) {
    return new MessageBus(conn);
  }
  if (!opts) opts = {};

  const self = this;
  this.connection = conn;
  this.serial = 1;
  this.cookies = {}; // TODO: rename to methodReturnHandlers
  this.methodCallHandlers = {};
  this.signals = new EventEmitter();
  this.exportedObjects = {};

  this.invoke = function (msg, callback) {
    if (!msg.type) msg.type = constants.messageType.methodCall;
    msg.serial = self.serial++;
    this.cookies[msg.serial] = callback;
    self.connection.message(msg);
  };

  this.invokeDbus = function (msg, callback) {
    if (!msg.path) msg.path = '/org/freedesktop/DBus';
    if (!msg.destination) msg.destination = 'org.freedesktop.DBus';
    if (!msg['interface']) msg['interface'] = 'org.freedesktop.DBus';
    self.invoke(msg, callback);
  };

  this.mangle = function (path, iface, member) {
    const obj = {};
    if (typeof path === 'object') {
      // handle one argument case mangle(msg)
      obj.path = path.path;
      obj['interface'] = path['interface'];
      obj.member = path.member;
    } else {
      obj.path = path;
      obj['interface'] = iface;
      obj.member = member;
    }
    return JSON.stringify(obj);
  };

  this.sendSignal = function (path, iface, name, signature, args) {
    const signalMsg = {
      type: constants.messageType.signal,
      serial: self.serial++,
      interface: iface,
      path: path,
      member: name
    };
    if (signature) {
      signalMsg.signature = signature;
      signalMsg.body = args;
    }
    self.connection.message(signalMsg);
  };

  // Warning: errorName must respect the same rules as interface names (must contain a dot)
  this.sendError = function (msg, errorName, errorText) {
    const reply = {
      type: constants.messageType.error,
      serial: self.serial++,
      replySerial: msg.serial,
      destination: msg.sender,
      errorName: errorName,
      signature: 's',
      body: [errorText]
    };
    this.connection.message(reply);
  };

  this.sendReply = function (msg, signature, body) {
    const reply = {
      type: constants.messageType.methodReturn,
      serial: self.serial++,
      replySerial: msg.serial,
      destination: msg.sender,
      signature: signature,
      body: body
    };
    this.connection.message(reply);
  };

  // route reply/error
  this.connection.on('message', function (msg) {
    function invoke(impl, func, resultSignature) {
      Promise.resolve()
        .then(function () {
          return func.apply(impl, (msg.body || []).concat(msg));
        })
        .then(
          function (methodReturnResult) {
            const methodReturnReply = {
              type: constants.messageType.methodReturn,
              serial: self.serial++,
              destination: msg.sender,
              replySerial: msg.serial
            };
            if (methodReturnResult !== null) {
              methodReturnReply.signature = resultSignature;
              methodReturnReply.body = [methodReturnResult];
            }
            self.connection.message(methodReturnReply);
          },
          function (e) {
            self.sendError(
              msg,
              e.dbusName || 'org.freedesktop.DBus.Error.Failed',
              e.message || ''
            );
          }
        );
    }

    let handler;
    if (
      msg.type === constants.messageType.methodReturn ||
      msg.type === constants.messageType.error
    ) {
      handler = self.cookies[msg.replySerial];
      if (handler) {
        delete self.cookies[msg.replySerial];
        const props = {
          connection: self.connection,
          bus: self,
          message: msg,
          signature: msg.signature
        };
        let args = msg.body || [];
        if (msg.type === constants.messageType.methodReturn) {
          args = [null].concat(args); // first argument - no errors, null
          handler.apply(props, args); // body as array of arguments
        } else {
          handler.call(props, { name: msg.errorName, message: args }); // body as first argument
        }
      }
    } else if (msg.type === constants.messageType.signal) {
      self.signals.emit(self.mangle(msg), msg.body, msg.signature);
    } else {
      // methodCall

      if (stdDbusIfaces(msg, self)) return;

      // exported interfaces handlers
      let obj, iface, impl;
      if ((obj = self.exportedObjects[msg.path])) {
        if ((iface = obj[msg['interface']])) {
          // now we are ready to serve msg.member
          impl = iface[1];
          const func = impl[msg.member];
          if (!func) {
            self.sendError(
              msg,
              'org.freedesktop.DBus.Error.UnknownMethod',
              `Method "${msg.member}" on interface "${msg.interface}" doesn't exist`
            );
            return;
          }
          // TODO safety check here
          const resultSignature = iface[0].methods[msg.member][1];
          invoke(impl, func, resultSignature);
          return;
        } else {
          debug(`Interface ${msg.interface} is not supported`)
          // TODO: respond with standard dbus error
        }
      }
      // setMethodCall handlers
      handler = self.methodCallHandlers[self.mangle(msg)];
      if (handler) {
        invoke(null, handler[0], handler[1]);
      } else {
        self.sendError(
          msg,
          'org.freedesktop.DBus.Error.UnknownService',
          'Uh oh oh'
        );
      }
    }
  });

  this.setMethodCallHandler = function (objectPath, iface, member, handler) {
    const key = self.mangle(objectPath, iface, member);
    self.methodCallHandlers[key] = handler;
  };

  this.exportInterface = function (obj, path, iface) {
    let entry;
    if (!self.exportedObjects[path]) {
      entry = self.exportedObjects[path] = {};
    } else {
      entry = self.exportedObjects[path];
    }
    entry[iface.name] = [iface, obj];
    // monkey-patch obj.emit()
    if (typeof obj.emit === 'function') {
      const oldEmit = obj.emit;
      obj.emit = function () {
        const args = Array.prototype.slice.apply(arguments);
        const signalName = args[0];
        if (!signalName) throw new Error('Trying to emit undefined signal');

        //send signal to bus
        let signal;
        if (iface.signals && iface.signals[signalName]) {
          signal = iface.signals[signalName];
          const signalMsg = {
            type: constants.messageType.signal,
            serial: self.serial++,
            interface: iface.name,
            path: path,
            member: signalName
          };
          if (signal[0]) {
            signalMsg.signature = signal[0];
            signalMsg.body = args.slice(1);
          }
          self.connection.message(signalMsg);
          self.serial++;
        }
        // note that local emit is likely to be called before signal arrives
        // to remote subscriber
        oldEmit.apply(obj, args);
      };
    }
    // TODO: emit ObjectManager's InterfaceAdded
  };

  // register name
  if (opts.direct !== true) {
    this.invokeDbus({ member: 'Hello' }, function (err, name) {
      if (err) throw new Error(err);
      self.name = name;
    });
  } else {
    self.name = null;
  }

  function DBusObject(name, service) {
    this.name = name;
    this.service = service;
    this.as = function (name) {
      return this.proxy[name];
    };
  }

  function DBusService(name, bus) {
    this.name = name;
    this.bus = bus;
    this.getObject = function (name, callback) {
      if (name === undefined)
        return callback(new Error('Object name is null or undefined'));
      const obj = new DBusObject(name, this);
      introspectBus(obj, function (err, ifaces, nodes) {
        if (err) return callback(err);
        obj.proxy = ifaces;
        obj.nodes = nodes;
        callback(null, obj);
      });
    };

    this.getInterface = function (objName, ifaceName, callback) {
      this.getObject(objName, function (err, obj) {
        if (err) return callback(err);
        callback(null, obj.as(ifaceName));
      });
    };
  }

  this.getService = function (name) {
    return new DBusService(name, this);
  };

  this.getObject = function (path, name, callback) {
    const service = this.getService(path);
    return service.getObject(name, callback);
  };

  this.getInterface = function (path, objname, name, callback) {
    return this.getObject(path, objname, function (err, obj) {
      if (err) return callback(err);
      callback(null, obj.as(name));
    });
  };

  // TODO: refactor

  // bus meta functions
  this.addMatch = function (match, callback) {
    this.invokeDbus(
      { member: 'AddMatch', signature: 's', body: [match] },
      callback
    );
  };

  this.removeMatch = function (match, callback) {
    this.invokeDbus(
      { member: 'RemoveMatch', signature: 's', body: [match] },
      callback
    );
  };

  this.getId = function (callback) {
    this.invokeDbus({ member: 'GetId' }, callback);
  };

  this.requestName = function (name, flags, callback) {
    this.invokeDbus(
      { member: 'RequestName', signature: 'su', body: [name, flags] },
      function (err, name) {
        if (callback) callback(err, name);
      }
    );
  };

  this.releaseName = function (name, callback) {
    this.invokeDbus(
      { member: 'ReleaseName', signature: 's', body: [name] },
      callback
    );
  };

  this.listNames = function (callback) {
    this.invokeDbus({ member: 'ListNames' }, callback);
  };

  this.listActivatableNames = function (callback) {
    this.invokeDbus({ member: 'ListActivatableNames' }, callback);
  };

  this.updateActivationEnvironment = function (env, callback) {
    this.invokeDbus(
      {
        member: 'UpdateActivationEnvironment',
        signature: 'a{ss}',
        body: [env]
      },
      callback
    );
  };

  this.startServiceByName = function (name, flags, callback) {
    this.invokeDbus(
      { member: 'StartServiceByName', signature: 'su', body: [name, flags] },
      callback
    );
  };

  this.getConnectionUnixUser = function (name, callback) {
    this.invokeDbus(
      { member: 'GetConnectionUnixUser', signature: 's', body: [name] },
      callback
    );
  };

  this.getConnectionUnixProcessId = function (name, callback) {
    this.invokeDbus(
      { member: 'GetConnectionUnixProcessID', signature: 's', body: [name] },
      callback
    );
  };

  this.getNameOwner = function (name, callback) {
    this.invokeDbus(
      { member: 'GetNameOwner', signature: 's', body: [name] },
      callback
    );
  };

  this.nameHasOwner = function (name, callback) {
    this.invokeDbus(
      { member: 'NameHasOwner', signature: 's', body: [name] },
      callback
    );
  };
};
