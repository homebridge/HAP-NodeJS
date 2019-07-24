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
export * from './types';

export function init(storagePath: string) {
  // initialize our underlying storage system, passing on the directory if needed
  if (typeof storagePath !== 'undefined')
    storage.initSync({ dir: storagePath });
  else
    storage.initSync(); // use whatever is default
}
export { Address } from './types';
export { Source } from './types';
export { VideoCodec } from './types';
export { AudioCodec } from './types';
export { VideoInfo } from './types';
export { AudioInfo } from './types';
export { SessionIdentifier } from './types';
export { StreamVideoParams } from './types';
export { Resolution } from './types';
export { StreamAudioParams } from './types';
