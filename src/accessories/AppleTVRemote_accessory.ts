import type { GStreamerOptions } from './gstreamer-audioProducer'

import { createServer } from 'node:http'

import escapeHTML from 'escape-html'

import { Accessory, ButtonState, ButtonType, Categories, RemoteController, uuid } from '../index.js'
import { GStreamerAudioProducer } from './gstreamer-audioProducer.js'

const remoteUUID = uuid.generate('hap-nodejs:accessories:remote')
const remote = exports.accessory = new Accessory('Remote', remoteUUID)

// @ts-expect-error: Core/BridgeCore API
remote.username = 'DB:AF:E0:5C:69:76'

// @ts-expect-error: Core/BridgeCore API
remote.pincode = '874-23-897'
remote.category = Categories.TARGET_CONTROLLER

// ----------------- for siri support -----------------
// CHANGE this to enable siri support. Read docs in 'gstreamer-audioProducer.ts' for necessary package dependencies
const siriSupport = false
const gstreamerOptions: Partial<GStreamerOptions> = { // any configuration regarding the producer can be made here
}
// ----------------------------------------------------

const controller = siriSupport
  ? new RemoteController(GStreamerAudioProducer, gstreamerOptions)
  : new RemoteController()
remote.configureController(controller)

/*
    This example plugin exposes a simple http api to interact with the remote and play around.
    The supported routes are listed below. The http server runs on port 8080 as default.
    This example should not be used except for testing as the http server is unsecured.

    /listTargets  -  list all currently configured apple tvs and their respective configuration
    /getActiveTarget  -  return the current target id of the controlled device
    /getActive  -  get the value of the active characteristic (active means the Apple TV for the activeTarget is listening)

    /press?button=<buttonId>&time=<timeInMS>  - presses a given button for a given time. Time is optional and defaults to 200ms
    /button?button=<buttonId>&state=<stateId>  - send a single button event
    /getTargetId?name=<name of Apple TV>  -   get the target identifier for the given name of the Apple TV
    /setActiveTarget?identifier=<id>  - set currently controlled Apple TV
 */

createServer((request, response) => {
  if (request.method !== 'GET') {
    response.writeHead(405, { 'Content-Type': 'text/html' })
    response.end('Method Not Allowed')
    return
  }

  const parsedUrl = new URL(request.url!, `http://${request.headers.host}`)
  const pathname = parsedUrl.pathname.substring(1)
  const query = Object.fromEntries(parsedUrl.searchParams.entries())

  if (pathname === 'setActiveTarget') {
    if (query === undefined || query.identifier === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end('Bad request. Must include \'identifier\' in query string!')
      return
    }

    const targetIdentifier = Number.parseInt(query.identifier as string, 10)
    if (!controller.isConfigured(targetIdentifier)) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end(`Bad request. No target found for given identifier ${targetIdentifier}`)
      return
    }

    controller.setActiveIdentifier(targetIdentifier)
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('OK')
  } else if (pathname === 'getActiveTarget') {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(`${controller.activeIdentifier}`)
  } else if (pathname === 'getTargetId') {
    if (query === undefined || query.name === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end('Bad request. Must include \'name\' in query string!')
      return
    }

    const targetIdentifier = controller.getTargetIdentifierByName(query.name as string)
    if (targetIdentifier === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end(`Bad request. No target found for given name ${escapeHTML(`${query.name}`)}`)
      return
    }

    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(`${targetIdentifier}`)
  } else if (pathname === 'button') {
    if (query === undefined || query.state === undefined || query.button === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end('Bad request. Must include \'state\' and \'button\' in query string!')
      return
    }

    const buttonState = Number.parseInt(query.state as string, 10)
    const button = Number.parseInt(query.button as string, 10)
    // @ts-expect-error: forceConsistentCasingInFileNames compiler option
    if (ButtonState[buttonState] === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end(`Bad request. Unknown button state ${escapeHTML(`${query.state}`)}`)
      return
    }
    // @ts-expect-error: forceConsistentCasingInFileNames compiler option
    if (ButtonType[button] === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end(`Bad request. Unknown button ${escapeHTML(`${query.button}`)}`)
      return
    }

    if (buttonState === ButtonState.UP) {
      controller.releaseButton(button)
    } else if (buttonState === ButtonState.DOWN) {
      controller.pushButton(button)
    }

    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('OK')
  } else if (pathname === 'press') {
    if (query === undefined || query.button === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end('Bad request. Must include \'button\' in query string!')
      return
    }

    let time = 200
    if (query.time !== undefined) {
      const parsedTime = Number.parseInt(query.time as string, 10)
      if (parsedTime) {
        time = parsedTime
      }
    }

    const button = Number.parseInt(query.button as string, 10)
    // @ts-expect-error: forceConsistentCasingInFileNames compiler option
    if (ButtonType[button] === undefined) {
      response.writeHead(400, { 'Content-Type': 'text/html' })
      response.end(`Bad request. Unknown button ${escapeHTML(`${query.button}`)}`)
      return
    }

    controller.pushAndReleaseButton(button, time)

    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('OK')
  } else if (pathname === 'listTargets') {
    const targets = controller.targetConfigurations

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(targets, undefined, 4))
  } else if (pathname === 'getActive') {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(controller.isActive() ? 'true' : 'false')
  } else {
    response.writeHead(404, { 'Content-Type': 'text/html' })
    response.end(`Not Found. No path found for ${escapeHTML(pathname)}`)
  }
}).listen(8080)
