import { EventEmitter } from 'node:events'

import createDebug from 'debug'

import constants from './constants.js'
import { introspectBus } from './introspect.js'
import stdDbusIfaces from './stdifaces.js'

const debug = createDebug('HAP-NodeJS:DBus')

interface MethodReturnReply {
  type: number
  serial: number
  destination: string
  replySerial: number
  signature?: string
  body?: any[]
}

export class MessageBus {
  connection: any
  serial: number
  cookies: Record<string, any>
  methodCallHandlers: Record<string, any>
  signals: EventEmitter
  exportedObjects: Record<string, any>
  name: string | null | undefined

  constructor(conn: any, opts: any = {}) {
    this.connection = conn
    this.serial = 1
    this.cookies = {}
    this.methodCallHandlers = {}
    this.signals = new EventEmitter()
    this.exportedObjects = {}

    if (opts.direct !== true) {
      this.invokeDbus({ member: 'Hello' }, (err: string | undefined, name: string | null | undefined) => {
        if (err) {
          throw new Error(err)
        }
        this.name = name
      })
    } else {
      this.name = null
    }

    this.connection.on('message', (msg: any) => this.handleMessage(msg))
  }

  invoke(msg: any, callback: any) {
    if (!msg.type) {
      msg.type = constants.messageType.methodCall
    }
    msg.serial = this.serial++
    this.cookies[msg.serial] = callback
    this.connection.message(msg)
  }

  invokeDbus(msg: any, callback: any) {
    if (!msg.path) {
      msg.path = '/org/freedesktop/DBus'
    }
    if (!msg.destination) {
      msg.destination = 'org.freedesktop.DBus'
    }
    if (!msg.interface) {
      msg.interface = 'org.freedesktop.DBus'
    }
    this.invoke(msg, callback)
  }

  mangle(path: any, iface?: any, member?: any) {
    const obj: any = {}
    if (typeof path === 'object') {
      obj.path = path.path
      obj.interface = path.interface
      obj.member = path.member
    } else {
      obj.path = path
      obj.interface = iface
      obj.member = member
    }
    return JSON.stringify(obj)
  }

  sendError(msg: any, errorName: string, errorText: string) {
    const reply = {
      type: constants.messageType.error,
      serial: this.serial++,
      replySerial: msg.serial,
      destination: msg.sender,
      errorName,
      signature: 's',
      body: [errorText],
    }
    this.connection.message(reply)
  }

  handleMessage(msg: any) {
    const invoke = (impl: any, func: any, resultSignature: any) => {
      Promise.resolve()
        .then(() => func.apply(impl, (msg.body || []).concat(msg)))
        .then(
          (methodReturnResult) => {
            const methodReturnReply: MethodReturnReply = {
              type: constants.messageType.methodReturn,
              serial: this.serial++,
              destination: msg.sender,
              replySerial: msg.serial,
            }
            if (methodReturnResult !== null) {
              methodReturnReply.signature = resultSignature
              methodReturnReply.body = [methodReturnResult]
            }
            this.connection.message(methodReturnReply)
          },
          (e) => {
            this.sendError(
              msg,
              e.dbusName || 'org.freedesktop.DBus.Error.Failed',
              e.message || '',
            )
          },
        )
    }

    let handler
    if (msg.type === constants.messageType.methodReturn || msg.type === constants.messageType.error) {
      handler = this.cookies[msg.replySerial]
      if (handler) {
        delete this.cookies[msg.replySerial]
        const props = {
          connection: this.connection,
          bus: this,
          message: msg,
          signature: msg.signature,
        }
        let args = msg.body || []
        if (msg.type === constants.messageType.methodReturn) {
          args = [null].concat(args)
          handler.apply(props, args)
        } else {
          handler.call(props, { name: msg.errorName, message: args })
        }
      }
    } else if (msg.type === constants.messageType.signal) {
      this.signals.emit(this.mangle(msg), msg.body, msg.signature)
    } else {
      if (stdDbusIfaces(msg, this)) {
        return
      }

      const obj = this.exportedObjects[msg.path]
      let iface
      if (obj) {
        iface = obj[msg.interface]
        if (iface) {
          const impl = iface[1]
          const func = impl[msg.member]
          if (!func) {
            this.sendError(
              msg,
              'org.freedesktop.DBus.Error.UnknownMethod',
              `Method "${msg.member}" on interface "${msg.interface}" doesn't exist`,
            )
            return
          }
          const resultSignature = iface[0].methods[msg.member][1]
          invoke(impl, func, resultSignature)
          return
        } else {
          debug(`Interface ${msg.interface} is not supported`)
        }
      }

      handler = this.methodCallHandlers[this.mangle(msg)]
      if (handler) {
        invoke(null, handler[0], handler[1])
      } else {
        this.sendError(
          msg,
          'org.freedesktop.DBus.Error.UnknownService',
          'Uh oh oh',
        )
      }
    }
  }

  getService(name: string) {
    return new DBusService(name, this)
  }

  getObject(path: string, name: string, callback: any) {
    const service = this.getService(path)
    return service.getObject(name, callback)
  }

  getInterface(path: string, objname: string, name: string, callback: any) {
    return this.getObject(path, objname, (err: any, obj: any) => {
      if (err) {
        return callback(err)
      }
      callback(null, obj.as(name))
    })
  }

  addMatch(match: string, callback: any) {
    this.invokeDbus(
      { member: 'AddMatch', signature: 's', body: [match] },
      callback,
    )
  }

  removeMatch(match: string, callback: any) {
    this.invokeDbus(
      { member: 'RemoveMatch', signature: 's', body: [match] },
      callback,
    )
  }
}

export class DBusObject {
  name: string
  service: any
  proxy: Record<string, any> | undefined
  nodes: string[] | undefined

  constructor(name: string, service: any) {
    this.name = name
    this.service = service
  }

  as(name: string): string | undefined {
    return this.proxy?.[name]
  }
}

class DBusService {
  name: string
  bus: any

  constructor(name: string, bus: any) {
    this.name = name
    this.bus = bus
  }

  getObject(name: string, callback: any) {
    if (name === undefined) {
      return callback(new Error('Object name is null or undefined'))
    }
    const obj = new DBusObject(name, this)
    introspectBus(obj, (err: any, ifaces: any, nodes: any) => {
      if (err) {
        return callback(err)
      }
      obj.proxy = ifaces
      obj.nodes = nodes
      callback(null, obj)
    })
  }

  getInterface(objName: string, ifaceName: string, callback: any) {
    this.getObject(objName, (err: any, obj: any) => {
      if (err) {
        return callback(err)
      }
      callback(null, obj.as(ifaceName))
    })
  }
}
