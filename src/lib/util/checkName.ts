import { CharacteristicValue, Nullable } from "../../types";

/**
 * Checks that supplied field meets Apple HomeKit naming rules
 * https://developer.apple.com/design/human-interface-guidelines/homekit#Help-people-choose-useful-names
 * @private Private API
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function checkName(displayName: string, name: string, value: Nullable<CharacteristicValue>): void {

  // Ensure the string starts and ends with a Unicode letter or number and allow any combination of letters, numbers, spaces, and apostrophes in the middle.
  if (typeof value === "string" && !(new RegExp(/^[\p{L}\p{N}][\p{L}\p{N} ']*[\p{L}\p{N}]$/u)).test(value)) {
    console.warn("HAP-NodeJS WARNING: The accessory '" + displayName + "' is getting published with the characteristic '" +
      name + "'" + " not following HomeKit naming rules ('" + value + "'). " +
      "Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. " +
      "This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  }
}
