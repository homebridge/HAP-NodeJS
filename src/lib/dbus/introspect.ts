// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import { Parser } from 'xml2js'

export function introspectBus (obj, callback) {
  const bus = obj.service.bus;
  bus.invoke(
    {
      destination: obj.service.name,
      path: obj.name,
      interface: 'org.freedesktop.DBus.Introspectable',
      member: 'Introspect'
    },
    function (err, xml) {
      processXML(err, xml, obj, callback);
    }
  );
}

const processXML = function (err, xml, obj, callback) {
  if (err) return callback(err);
  const parser = new Parser();
  parser.parseString(xml, function (err, result) {
    if (err) return callback(err);
    if (!result.node) throw new Error('No root XML node');
    result = result.node; // unwrap the root node
    // If no interface, try first sub node?
    if (!result.interface) {
      if (result.node && result.node.length > 0 && result.node[0]['$']) {
        const subObj = Object.assign(obj, {});
        if (subObj.name.slice(-1) !== '/') subObj.name += '/';
        subObj.name += result.node[0]['$'].name;
        return introspectBus(subObj, callback);
      }
      return callback(new Error('No such interface found'));
    }
    const proxy = {};
    const nodes = [];
    let ifaceName, method, property, iface, arg, signature, currentIface;
    const ifaces = result['interface'];
    const xmlnodes = result['node'] || [];

    for (let n = 1; n < xmlnodes.length; ++n) {
      // Start at 1 because we want to skip the root node
      nodes.push(xmlnodes[n]['$']['name']);
    }

    for (let i = 0; i < ifaces.length; ++i) {
      iface = ifaces[i];
      ifaceName = iface['$'].name;
      currentIface = proxy[ifaceName] = new DBusInterface(obj, ifaceName);

      for (let m = 0; iface.method && m < iface.method.length; ++m) {
        method = iface.method[m];
        signature = '';
        const methodName = method['$'].name;
        for (let a = 0; method.arg && a < method.arg.length; ++a) {
          arg = method.arg[a]['$'];
          if (arg.direction === 'in') signature += arg.type;
        }
        // add method
        currentIface.$createMethod(methodName, signature);
      }
      for (let p = 0; iface.property && p < iface.property.length; ++p) {
        property = iface.property[p];
        currentIface.$createProp(
          property['$'].name,
          property['$'].type,
          property['$'].access
        );
      }
      // TODO: introspect signals
    }
    callback(null, proxy, nodes);
  });
};

function DBusInterface(parent_obj, ifname) {
  // Since methods and props presently get added directly to the object, to avoid collision with existing names we must use $ naming convention as $ is invalid for dbus member names
  // https://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-names
  this.$parent = parent_obj; // parent DbusObject
  this.$name = ifname; // string interface name
  this.$methods = {}; // dictionary of methods (exposed for test), should we just store signature or use object to store more info?
  //this.$signals = {};
  this.$properties = {};
  this.$callbacks = [];
  this.$sigHandlers = [];
}

DBusInterface.prototype.$getSigHandler = function (callback) {
  let index;
  if ((index = this.$callbacks.indexOf(callback)) === -1) {
    index = this.$callbacks.push(callback) - 1;
    this.$sigHandlers[index] = function (messageBody) {
      callback.apply(null, messageBody);
    };
  }
  return this.$sigHandlers[index];
};

DBusInterface.prototype.addListener = DBusInterface.prototype.on = function (signame, callback) {
  // http://dbus.freedesktop.org/doc/api/html/group__DBusBus.html#ga4eb6401ba014da3dbe3dc4e2a8e5b3ef
  // An example is "type='signal',sender='org.freedesktop.DBus', interface='org.freedesktop.DBus',member='Foo', path='/bar/foo',destination=':452345.34'" ...
  const bus = this.$parent.service.bus;
  const signalFullName = bus.mangle(this.$parent.name, this.$name, signame);
  if (!bus.signals.listeners(signalFullName).length) {
    // This is the first time, so call addMatch
    const match = getMatchRule(this.$parent.name, this.$name, signame);
    bus.addMatch(
      match,
      function (err) {
        if (err) throw new Error(err);
        bus.signals.on(signalFullName, this.$getSigHandler(callback));
      }.bind(this)
    );
  } else {
    // The match is already there, just add event listener
    bus.signals.on(signalFullName, this.$getSigHandler(callback));
  }
};

DBusInterface.prototype.removeListener = DBusInterface.prototype.off = function (signame, callback) {
  const bus = this.$parent.service.bus;
  const signalFullName = bus.mangle(this.$parent.name, this.$name, signame);
  bus.signals.removeListener(signalFullName, this.$getSigHandler(callback));
  if (!bus.signals.listeners(signalFullName).length) {
    // There is no event handlers for this match
    const match = getMatchRule(this.$parent.name, this.$name, signame);
    bus.removeMatch(
      match,
      function (err) {
        if (err) throw new Error(err);
        // Now it is safe to empty these arrays
        this.$callbacks.length = 0;
        this.$sigHandlers.length = 0;
      }.bind(this)
    );
  }
};

DBusInterface.prototype.$createMethod = function (mName, signature) {
  this.$methods[mName] = signature;
  this[mName] = function () {
    this.$callMethod(mName, arguments);
  };
};

DBusInterface.prototype.$callMethod = function (mName, args) {
  const bus = this.$parent.service.bus;
  if (!Array.isArray(args)) args = Array.from(args); // Array.prototype.slice.apply(args)
  const callback = typeof args[args.length - 1] === 'function' ? args.pop() : function () {};
  const msg = {
    destination: this.$parent.service.name,
    path: this.$parent.name,
    interface: this.$name,
    member: mName
  };
  if (this.$methods[mName] !== '') {
    msg.signature = this.$methods[mName];
    msg.body = args;
  }
  bus.invoke(msg, callback);
};

DBusInterface.prototype.$createProp = function (propName, propType, propAccess) {
  this.$properties[propName] = { type: propType, access: propAccess };
  Object.defineProperty(this, propName, {
    enumerable: true,
    get: () => (callback) => this.$readProp(propName, callback),
    set: function (val) {
      this.$writeProp(propName, val);
    }
  });
};

DBusInterface.prototype.$readProp = function (propName, callback) {
  const bus = this.$parent.service.bus;
  bus.invoke(
    {
      destination: this.$parent.service.name,
      path: this.$parent.name,
      interface: 'org.freedesktop.DBus.Properties',
      member: 'Get',
      signature: 'ss',
      body: [this.$name, propName]
    },
    function (err, val) {
      if (err) {
        callback(err);
      } else {
        const signature = val[0];
        if (signature.length === 1) {
          callback(err, val[1][0]);
        } else {
          callback(err, val[1]);
        }
      }
    }
  );
};

DBusInterface.prototype.$writeProp = function (propName, val) {
  const bus = this.$parent.service.bus;
  bus.invoke({
    destination: this.$parent.service.name,
    path: this.$parent.name,
    interface: 'org.freedesktop.DBus.Properties',
    member: 'Set',
    signature: 'ssv',
    body: [this.$name, propName, [this.$properties[propName].type, val]]
  });
};

function getMatchRule(objName, ifName, signame) {
  return `type='signal',path='${objName}',interface='${ifName}',member='${signame}'`;
}
