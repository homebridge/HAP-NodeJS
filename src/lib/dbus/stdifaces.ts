import type { MessageBus } from './bus'

import constants from './constants.js'
import parseSignature from './signature.js'

interface PropertiesReply {
  type: number
  serial: number
  replySerial: number
  destination: string
  signature?: string
  body?: any[]
}

interface PeerReply {
  type: number
  serial: number
  replySerial: number
  destination: string
  signature?: string
  body?: any[]
}

// TODO: use xmlbuilder

const xmlHeader
  = '<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"\n'
  + '    "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">'
let stdIfaces: string

export default function (msg: any, bus: MessageBus): number {
  let obj
  if (msg.interface === 'org.freedesktop.DBus.Introspectable' && msg.member === 'Introspect') {
    if (msg.path === '/') {
      msg.path = ''
    }

    const resultXml = [xmlHeader]
    const nodes = {}
    // TODO: this is not very efficient for large number of exported objects
    // need to build objects tree as they are exported and walk this tree on introspect request
    for (const path in bus.exportedObjects) {
      if (path.indexOf(msg.path) === 0) {
        // objects path starts with requested
        const introspectableObj = bus.exportedObjects[msg.path]
        if (introspectableObj) {
          // @ts-expect-error - dynamic property
          nodes[msg.path] = introspectableObj
        } else {
          if (path[msg.path.length] !== '/') {
            continue
          }
          const localPath = path.slice(msg.path.length)
          const pathParts = localPath.split('/')
          const localName = pathParts[1]

          // @ts-expect-error - dynamic property
          nodes[localName] = null
        }
      }
    }

    const length = Object.keys(nodes).length
    if (length === 0) {
      resultXml.push('<node/>')
    } else if (length === 1) {
      // @ts-expect-error - dynamic property
      obj = nodes[Object.keys(nodes)[0]]
      if (obj) {
        resultXml.push('<node>')
        for (const ifaceNode in obj) {
          resultXml.push(interfaceToXML(obj[ifaceNode][0]))
        }
        resultXml.push(stdIfaces)
        resultXml.push('</node>')
      } else {
        resultXml.push(
          `<node>\n  <node name="${Object.keys(nodes)[0]}"/>\n  </node>`,
        )
      }
    } else {
      resultXml.push('<node>')
      for (const name in nodes) {
        // @ts-expect-error - dynamic property
        if (nodes[name] === null) {
          resultXml.push(`  <node name="${name}" />`)
        } else {
          // @ts-expect-error - dynamic property
          obj = nodes[name]
          resultXml.push(`  <node name="${name}" >`)
          for (const ifaceName in obj) {
            resultXml.push(interfaceToXML(obj[ifaceName][0]))
          }
          resultXml.push(stdIfaces)
          resultXml.push('  </node>')
        }
      }
      resultXml.push('</node>')
    }

    const introspectableReply = {
      type: constants.messageType.methodReturn,
      serial: bus.serial++,
      replySerial: msg.serial,
      destination: msg.sender,
      signature: 's',
      body: [resultXml.join('\n')],
    }
    bus.connection.message(introspectableReply)
    return 1
  } else if (msg.interface === 'org.freedesktop.DBus.Properties') {
    const interfaceName = msg.body[0]
    const propertiesObj = bus.exportedObjects[msg.path]
    // TODO: !propertiesObj -> UnknownObject  http://www.freedesktop.org/wiki/Software/DBusBindingErrors
    if (!propertiesObj || !propertiesObj[interfaceName]) {
      // TODO:
      bus.sendError(
        msg,
        'org.freedesktop.DBus.Error.UnknownMethod',
        'Uh oh oh',
      )
      return 1
    }
    const impl = propertiesObj[interfaceName][1]

    const propertiesReply: PropertiesReply = {
      type: constants.messageType.methodReturn,
      serial: bus.serial++,
      replySerial: msg.serial,
      destination: msg.sender,
    }
    if (msg.member === 'Get' || msg.member === 'Set') {
      const propertyName = msg.body[1]
      const propType = propertiesObj[interfaceName][0].properties[propertyName]
      if (msg.member === 'Get') {
        const propValue = impl[propertyName]
        propertiesReply.signature = 'v'
        propertiesReply.body = [[propType, propValue]]
      } else {
        impl[propertyName] = 1234 // TODO: read variant and set property value
      }
    } else if (msg.member === 'GetAll') {
      propertiesReply.signature = 'a{sv}'
      const props = []
      for (const p in propertiesObj[interfaceName][0].properties) {
        const propertySignature = propertiesObj[interfaceName][0].properties[p]
        props.push([p, [propertySignature, impl[p]]])
      }
      propertiesReply.body = [props]
    }
    bus.connection.message(propertiesReply)
    return 1
  } else if (msg.interface === 'org.freedesktop.DBus.Peer') {
    // TODO: implement bus.replyTo(srcMsg, signature, body) method
    const peerReply: PeerReply = {
      type: constants.messageType.methodReturn,
      serial: bus.serial++,
      replySerial: msg.serial,
      destination: msg.sender,
    }
    if (msg.member === 'Ping') {
      // empty body
    } else if (msg.member === 'GetMachineId') {
      peerReply.signature = 's'
      peerReply.body = ['This is a machine id. TODO: implement']
    }
    bus.connection.message(peerReply)
    return 1
  }
  return 0
};

// TODO: move to introspect.js
function interfaceToXML(iface: any) {
  const result = []
  const dumpArgs = function (argsSignature: any, argsNames: any, direction: string) {
    if (!argsSignature) {
      return
    }
    const args = parseSignature(argsSignature)
    args.forEach((arg: any, num: number) => {
      const argName = argsNames ? argsNames[num] : direction + num
      const dirStr = direction === 'signal' ? '' : `" direction="${direction}`
      result.push(
        `      <arg type="${dumpSignature([
          arg,
        ])}" name="${argName}${dirStr}" />`,
      )
    })
  }
  result.push(`  <interface name="${iface.name}">`)
  if (iface.methods) {
    for (const methodName in iface.methods) {
      const method = iface.methods[methodName]
      result.push(`    <method name="${methodName}">`)
      dumpArgs(method[0], method[2], 'in')
      dumpArgs(method[1], method[3], 'out')
      result.push('    </method>')
    }
  }
  if (iface.signals) {
    for (const signalName in iface.signals) {
      const signal = iface.signals[signalName]
      result.push(`    <signal name="${signalName}">`)
      dumpArgs(signal[0], signal.slice(1), 'signal')
      result.push('    </signal>')
    }
  }
  if (iface.properties) {
    for (const propertyName in iface.properties) {
      // TODO: decide how to encode access
      result.push(
        `    <property name="${propertyName}" type="${iface.properties[propertyName]}" access="readwrite"/>`,
      )
    }
  }
  result.push('  </interface>')
  return result.join('\n')
}

function dumpSignature(s: any[]) {
  const result: string[] = []
  s.forEach((sig) => {
    result.push(sig.type + dumpSignature(sig.child))
    if (sig.type === '{') {
      result.push('}')
    }
    if (sig.type === '(') {
      result.push(')')
    }
  })
  return result.join('')
}
stdIfaces
  = '  <interface name="org.freedesktop.DBus.Properties">\n    <method name="Get">\n      <arg type="s" name="interface_name" direction="in"/>\n      <arg type="s" name="property_name" direction="in"/>\n      <arg type="v" name="value" direction="out"/>\n    </method>\n    <method name="GetAll">\n      <arg type="s" name="interface_name" direction="in"/>\n      <arg type="a{sv}" name="properties" direction="out"/>\n    </method>\n    <method name="Set">\n      <arg type="s" name="interface_name" direction="in"/>\n      <arg type="s" name="property_name" direction="in"/>\n      <arg type="v" name="value" direction="in"/>\n    </method>\n    <signal name="PropertiesChanged">\n      <arg type="s" name="interface_name"/>\n      <arg type="a{sv}" name="changed_properties"/>\n      <arg type="as" name="invalidated_properties"/>\n    </signal>\n  </interface>\n  <interface name="org.freedesktop.DBus.Introspectable">\n    <method name="Introspect">\n      <arg type="s" name="xml_data" direction="out"/>\n    </method>\n  </interface>\n  <interface name="org.freedesktop.DBus.Peer">\n    <method name="Ping"/>\n    <method name="GetMachineId">\n      <arg type="s" name="machine_uuid" direction="out"/>\n    </method>\n  </interface>'
