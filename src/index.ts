import "source-map-support/register"; // registering node-source-map-support for typescript stack traces
import './lib/gen';
import * as accessoryLoader from './lib/AccessoryLoader';
import * as uuidFunctions from './lib/util/uuid';
import * as legacyTypes from './accessories/types';
import { HAPStorage } from "./lib/model/HAPStorage";

export const AccessoryLoader = accessoryLoader;
export const uuid = uuidFunctions;

export * from './lib/model/HAPStorage';
export * from './lib/Accessory';
export * from './lib/Bridge';
export * from './lib/Service';
export * from './lib/Characteristic';
export * from './lib/AccessoryLoader';
export * from './lib/camera';
export * from './lib/tv/AccessControlManagement';
export * from './lib/HAPServer';
export * from './lib/gen';
export * from './lib/datastream';
export * from './lib/controller';

export * from './lib/util/clone';
export * from './lib/util/once';
export * from './lib/util/tlv';
export * from './lib/util/hapStatusError';

export * from './types';
export const LegacyTypes = legacyTypes;

/**
 *
 * @param {string} storagePath
 * @deprecated the need to manually initialize the internal storage was removed. If you want to set a custom
 *  storage path location, please use {@link HAPStorage.setCustomStoragePath} directly.
 */
export function init(storagePath?: string) {
  console.log("DEPRECATED: The need to manually initialize HAP (by calling the init method) was removed. " +
    "If you want to set a custom storage path location, please ust HAPStorage.setCustomStoragePath directly. " +
    "This method will be removed in the next major update!");
  if (storagePath) {
    HAPStorage.setCustomStoragePath(storagePath);
  }
}
