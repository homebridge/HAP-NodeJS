import storage from 'node-persist';

import './lib/gen';
import * as accessoryLoader from './lib/AccessoryLoader';
import * as uuidFunctions from './lib/util/uuid';

export const AccessoryLoader = accessoryLoader;
export const uuid = uuidFunctions;

export * from './lib/Accessory.js';
export * from './lib/Bridge.js';
export * from './lib/Camera.js';
export * from './lib/Service.js';
export * from './lib/Characteristic.js';
export * from './lib/AccessoryLoader.js';
export * from './lib/StreamController.js';
export * from './lib/HAPServer';
export * from './lib/gen';

export * from './lib/util/chacha20poly1305';
export * from './lib/util/clone';
export * from './lib/util/encryption';
export * from './lib/util/hkdf';
export * from './lib/util/once';
export * from './lib/util/tlv';

export * from './types';

export function init(storagePath: string) {
  // initialize our underlying storage system, passing on the directory if needed
  if (typeof storagePath !== 'undefined')
    storage.initSync({ dir: storagePath });
  else
    storage.initSync(); // use whatever is default
}
