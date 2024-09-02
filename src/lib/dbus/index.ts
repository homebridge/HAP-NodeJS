import { EventEmitter } from 'node:events'
import { createConnection as netCreateConnection } from 'node:net'
import process from 'node:process'

import createDebug from 'debug'

import { MessageBus } from './bus.js'
import clientHandshake from './handshake.js'
import { marshallMessage, unmarshallMessages } from './message.js'

const debug = createDebug('HAP-NodeJS:DBus')

class DBusConnection extends EventEmitter {
  stream: any
  _messages: any[]
  state: string
  guid: string | undefined

  constructor(opts: any = {}) {
    super()
    this._messages = []
    this.state = ''
    this.stream = this.createStream(opts)
    this.stream.setNoDelay()

    this.stream.on('error', (err: any) => {
      this.emit('error', err)
    })

    this.stream.on('end', () => {
      this.emit('end')
      this.message = function () {
        debug('Didn\'t write bytes to closed stream')
      }
    })

    clientHandshake(this.stream, opts, (error: any, guid: string) => {
      if (error) {
        return this.emit('error', error)
      }
      this.guid = guid
      this.emit('connect')
      unmarshallMessages(
        this.stream,
        (message: any) => {
          this.emit('message', message)
        },
        opts,
      )
    })

    this.once('connect', () => {
      this.state = 'connected'
      for (let i = 0; i < this._messages.length; ++i) {
        this.stream.write(marshallMessage(this._messages[i]))
      }
      this._messages.length = 0

      // no need to buffer once connected
      this.message = function (msg: any) {
        this.stream.write(marshallMessage(msg))
      }
    })
  }

  createStream(opts: any) {
    if (opts.stream) {
      return opts.stream
    }
    let host = opts.host
    let port = opts.port
    const socket = opts.socket
    if (socket) {
      return netCreateConnection(socket)
    }
    if (port) {
      return netCreateConnection(port, host)
    }

    const busAddress = opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS
    if (!busAddress) {
      throw new Error('unknown bus address')
    }

    const addresses = busAddress.split(';')
    for (let i = 0; i < addresses.length; ++i) {
      const address = addresses[i]
      const familyParams = address.split(':')
      const family = familyParams[0]
      const params: any = {}
      familyParams[1].split(',').map((p: string) => { // eslint-disable-line array-callback-return
        const keyVal = p.split('=')
        params[keyVal[0]] = keyVal[1]
      })

      try {
        switch (family.toLowerCase()) {
          case 'tcp':
            host = params.host || 'localhost'
            port = params.port
            return netCreateConnection(port, host)
          case 'unix':
            if (params.socket) {
              return netCreateConnection(params.socket)
            }
            if (params.path) {
              return netCreateConnection(params.path)
            }
            throw new Error('not enough parameters for \'unix\' connection - you need to specify \'socket\' or \'abstract\' or \'path\' parameter')
          default:
            throw new Error(`unknown address type:${family}`)
        }
      } catch (e) {
        if (i < addresses.length - 1) {
          debug(e.message)
        } else {
          throw e
        }
      }
    }
  }

  end() {
    this.stream.end()
    return this
  }

  message(msg: any) {
    this._messages.push(msg)
  }
}

function createClient(params: { busAddress: string }): MessageBus {
  const connection = new DBusConnection(params || {})
  return new MessageBus(connection, params || {})
}

export function systemBus(): MessageBus {
  return createClient({
    busAddress: process.env.DBUS_SYSTEM_BUS_ADDRESS || 'unix:path=/var/run/dbus/system_bus_socket',
  })
}
