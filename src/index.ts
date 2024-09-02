import 'source-map-support/register.js' // registering node-source-map-support for typescript stack traces
import './lib/definitions/index.js' // must be loaded before Characteristic and Service class
import { createRequire } from 'node:module'

import createDebug from 'debug'

import * as Characteristics from './lib/definitions/CharacteristicDefinitions.js'
import * as Services from './lib/definitions/ServiceDefinitions.js'

/**
 * @group Utils
 */
export * as LegacyTypes from './accessories/types.js'
export * from './lib/Accessory.js'
export * from './lib/Bridge.js'
export * from './lib/camera/index.js'
export * from './lib/Characteristic.js'
export * from './lib/controller/index.js'
export * from './lib/datastream/index.js'
export * from './lib/HAPServer.js'
export * from './lib/model/AccessoryInfo.js'
export * from './lib/model/HAPStorage.js'
export * from './lib/Service.js'
export * from './lib/tv/AccessControlManagement.js'

export * from './lib/util/clone.js'
export * from './lib/util/color-utils.js'
export * from './lib/util/eventedhttp.js'
export * from './lib/util/hapStatusError.js'
export * from './lib/util/once.js'
export * from './lib/util/time.js'
export * from './lib/util/tlv.js'

/**
 * @group Utils
 */
export * as uuid from './lib/util/uuid.js'
export * from './types.js'

const require = createRequire(import.meta.url)
const debug = createDebug('HAP-NodeJS:Advertiser')

/**
 * This method can be used to retrieve the current running library version of the HAP-NodeJS framework.
 * @returns The SemVer version string.
 *
 * @group Utils
 */
export function HAPLibraryVersion(): string {
  const packageJson = require('../package.json')
  return packageJson.version
}

function printInit() {
  debug('Initializing HAP-NodeJS v%s ...', HAPLibraryVersion())
}
printInit()

/**
 * This namespace doesn't actually exist and is only used to generate documentation for all Service and Characteristic Definitions.
 *
 * Please access them via the static properties provided in {@link Service} and {@link Characteristic}.
 *
 * @group Utils
 */
export { Characteristics, Services }
