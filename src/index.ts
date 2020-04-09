/// <reference path="../@types/bonjour-hap.d.ts" />
/// <reference path="../@types/fast-srp-hap.d.ts" />
/// <reference path="../@types/node-persist.d.ts" />
import storage from 'node-persist';

import './lib/gen';
import * as accessoryLoader from './lib/AccessoryLoader';
import * as uuidFunctions from './lib/util/uuid';
import * as legacyTypes from './accessories/types';

export const AccessoryLoader = accessoryLoader;
export const uuid = uuidFunctions;

export * from './lib/Accessory';
export * from './lib/Bridge';
export * from './lib/Camera';
export * from './lib/Service';
export * from './lib/Characteristic';
export * from './lib/AccessoryLoader';
export * from './lib/StreamController';
export * from './lib/HAPServer';
export * from './lib/gen';
export * from './lib/datastream';
export * from './lib/HomeKitRemoteController';

export * from './lib/util/chacha20poly1305';
export * from './lib/util/clone';
export * from './lib/util/encryption';
export * from './lib/util/hkdf';
export * from './lib/util/once';
export * from './lib/util/tlv';

export * from './types';
export const LegacyTypes = legacyTypes;

export function init(storagePath?: string) {
  // initialize our underlying storage system, passing on the directory if needed
  if (typeof storagePath !== 'undefined')
    storage.initSync({ dir: storagePath });
  else
    storage.initSync(); // use whatever is default
}
