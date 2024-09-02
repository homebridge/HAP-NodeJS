import type { DBusObject } from './bus'

import { Parser } from 'xml2js'

const processXML = function (err: any, xml: string, obj: any, callback: any) {
  if (err) {
    return callback(err)
  }
  const parser = new Parser()
  parser.parseString(xml, (err, result) => {
    if (err) {
      return callback(err)
    }
    if (!result.node) {
      throw new Error('No root XML node')
    }
    result = result.node // unwrap the root node
    // If no interface, try first sub node?
    if (!result.interface) {
      if (result.node && result.node.length > 0 && result.node[0].$) {
        const subObj = Object.assign(obj, {})
        if (subObj.name.slice(-1) !== '/') {
          subObj.name += '/'
        }
        subObj.name += result.node[0].$.name
        return introspectBus(subObj, callback)
      }
      return callback(new Error('No such interface found'))
    }
    const proxy: { [key: string]: DBusInterface } = {}
    const nodes = []
    let ifaceName, method, property, iface, arg, signature, currentIface
    const ifaces = result.interface
    const xmlnodes = result.node || []

    for (let n = 1; n < xmlnodes.length; ++n) {
      // Start at 1 because we want to skip the root node
      nodes.push(xmlnodes[n].$.name)
    }

    for (let i = 0; i < ifaces.length; ++i) {
      iface = ifaces[i]
      ifaceName = iface.$.name
      currentIface = proxy[ifaceName] = new DBusInterface(obj, ifaceName)

      for (let m = 0; iface.method && m < iface.method.length; ++m) {
        method = iface.method[m]
        signature = ''
        const methodName = method.$.name
        for (let a = 0; method.arg && a < method.arg.length; ++a) {
          arg = method.arg[a].$
          if (arg.direction === 'in') {
            signature += arg.type
          }
        }
        // add method
        currentIface.$createMethod(methodName, signature)
      }
      for (let p = 0; iface.property && p < iface.property.length; ++p) {
        property = iface.property[p]
        currentIface.$createProp(
          property.$.name,
          property.$.type,
          property.$.access,
        )
      }
      // TODO: introspect signals
    }
    callback(null, proxy, nodes)
  })
}

export function introspectBus(obj: DBusObject, callback: (err: any, ifaces: any, nodes: any) => any) {
  const bus = obj.service.bus
  bus.invoke(
    {
      destination: obj.service.name,
      path: obj.name,
      interface: 'org.freedesktop.DBus.Introspectable',
      member: 'Introspect',
    },
    (err: any, xml: string) => {
      processXML(err, xml, obj, callback)
    },
  )
}

function getMatchRule(objName: string, ifName: string, signame: string) {
  return `type='signal',path='${objName}',interface='${ifName}',member='${signame}'`
}

export class DBusInterface {
  $parent: any
  $name: string
  $methods: { [key: string]: string }
  $properties: { [key: string]: { type: string, access: string } }
  $callbacks: any[]
  $sigHandlers: any[]

  constructor(parent_obj: any, ifname: string) {
    this.$parent = parent_obj
    this.$name = ifname
    this.$methods = {}
    this.$properties = {}
    this.$callbacks = []
    this.$sigHandlers = []
  }

  [key: string]: any; // Index signature

  $getSigHandler(callback: any) {
    let index = this.$callbacks.indexOf(callback)
    if (index === -1) {
      index = this.$callbacks.push(callback) - 1
      this.$sigHandlers[index] = (messageBody: any) => {
        callback(...messageBody)
      }
    }
    return this.$sigHandlers[index]
  }

  on(signame: string, callback: any) {
    const bus = this.$parent.service.bus
    const signalFullName = bus.mangle(this.$parent.name, this.$name, signame)
    if (!bus.signals.listeners(signalFullName).length) {
      const match = getMatchRule(this.$parent.name, this.$name, signame)
      bus.addMatch(match, (err: any) => {
        if (err) {
          throw new Error(err)
        }
        bus.signals.on(signalFullName, this.$getSigHandler(callback))
      })
    } else {
      bus.signals.on(signalFullName, this.$getSigHandler(callback))
    }
  }

  addListener(signame: string, callback: any) {
    this.on(signame, callback)
  }

  removeListener(signame: string, callback: any) {
    this.off(signame, callback)
  }

  off(signame: string, callback: any) {
    const bus = this.$parent.service.bus
    const signalFullName = bus.mangle(this.$parent.name, this.$name, signame)
    bus.signals.removeListener(signalFullName, this.$getSigHandler(callback))
    if (!bus.signals.listeners(signalFullName).length) {
      const match = getMatchRule(this.$parent.name, this.$name, signame)
      bus.removeMatch(match, (err: any) => {
        if (err) {
          throw new Error(err)
        }
        this.$callbacks.length = 0
        this.$sigHandlers.length = 0
      })
    }
  }

  $createMethod(mName: string, signature: string) {
    this.$methods[mName] = signature
    this[mName] = (...args: any[]) => {
      this.$callMethod(mName, args)
    }
  }

  $callMethod(mName: string, args: any[]) {
    const bus = this.$parent.service.bus
    if (!Array.isArray(args)) {
      args = Array.from(args)
    }
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : () => {}
    const msg: any = {
      destination: this.$parent.service.name,
      path: this.$parent.name,
      interface: this.$name,
      member: mName,
    }
    if (this.$methods[mName] !== '') {
      msg.signature = this.$methods[mName]
      msg.body = args
    }
    bus.invoke(msg, callback)
  }

  $createProp(propName: string, propType: string, propAccess: string) {
    this.$properties[propName] = { type: propType, access: propAccess }
    Object.defineProperty(this, propName, {
      enumerable: true,
      get: () => (callback: any) => this.$readProp(propName, callback), // eslint-disable-line unicorn/consistent-function-scoping
      set: (val) => {
        this.$writeProp(propName, val)
      },
    })
  }

  $readProp(propName: string, callback: any) {
    const bus = this.$parent.service.bus
    bus.invoke(
      {
        destination: this.$parent.service.name,
        path: this.$parent.name,
        interface: 'org.freedesktop.DBus.Properties',
        member: 'Get',
        signature: 'ss',
        body: [this.$name, propName],
      },
      (err: any, val: any) => {
        if (err) {
          callback(err)
        } else {
          const signature = val[0]
          if (signature.length === 1) {
            callback(err, val[1][0])
          } else {
            callback(err, val[1])
          }
        }
      },
    )
  }

  $writeProp(propName: string, val: any) {
    const bus = this.$parent.service.bus
    bus.invoke({
      destination: this.$parent.service.name,
      path: this.$parent.name,
      interface: 'org.freedesktop.DBus.Properties',
      member: 'Set',
      signature: 'ssv',
      body: [this.$name, propName, [this.$properties[propName].type, val]],
    })
  }
}
