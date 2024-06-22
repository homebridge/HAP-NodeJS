import "source-map-support/register"; // registering node-source-map-support for typescript stack traces
import "./lib/definitions"; // must be loaded before Characteristic and Service class
import createDebug from "debug";
import { HAPStorage } from "./lib/model/HAPStorage";

/**
 * @group Utils
 */
export * as AccessoryLoader from "./lib/AccessoryLoader";
/**
 * @group Utils
 */
export * as uuid from "./lib/util/uuid";
export * from "./lib/model/HAPStorage";
export * from "./lib/Accessory";
export * from "./lib/Bridge";
export * from "./lib/Service";
export * from "./lib/Characteristic";
export * from "./lib/AccessoryLoader";
export * from "./lib/camera";
export * from "./lib/tv/AccessControlManagement";
export * from "./lib/HAPServer";
export * from "./lib/datastream";
export * from "./lib/controller";
export * from "./lib/model/AccessoryInfo";

export * from "./lib/util/clone";
export * from "./lib/util/once";
export * from "./lib/util/tlv";
export * from "./lib/util/hapStatusError";
export * from "./lib/util/color-utils";
export * from "./lib/util/time";
export * from "./lib/util/eventedhttp";

export * from "./types";
/**
 * @group Utils
 */
export * as LegacyTypes from "./accessories/types";

const debug = createDebug("HAP-NodeJS:Advertiser");

/**
 * This method can be used to retrieve the current running library version of the HAP-NodeJS framework.
 * @returns The SemVer version string.
 *
 * @group Utils
 */
export function HAPLibraryVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require("../package.json");
  return packageJson.version;
}

function printInit() {
  debug("Initializing HAP-NodeJS v%s ...", HAPLibraryVersion());
}
printInit();

/**
 *
 * @param {string} storagePath
 * @deprecated the need to manually initialize the internal storage was removed. If you want to set a custom
 *  storage path location, please use {@link HAPStorage.setCustomStoragePath} directly.
 *
 *  @group Utils
 */
export function init(storagePath?: string): void {
  console.log("DEPRECATED: The need to manually initialize HAP (by calling the init method) was removed. " +
    "If you want to set a custom storage path location, please ust HAPStorage.setCustomStoragePath directly. " +
    "This method will be removed in the next major update!");
  if (storagePath) {
    HAPStorage.setCustomStoragePath(storagePath);
  }
}

import * as Services from "./lib/definitions/ServiceDefinitions";
import * as Characteristics from "./lib/definitions/CharacteristicDefinitions";

/**
 * This namespace doesn't actually exist and is only used to generate documentation for all Service and Characteristic Definitions.
 *
 * Please access them via the static properties provided in {@link Service} and {@link Characteristic}.
 *
 * @group Utils
 */
export declare namespace _definitions { // eslint-disable-line @typescript-eslint/no-namespace
  export {
    Services,
    Characteristics,
  };
}
