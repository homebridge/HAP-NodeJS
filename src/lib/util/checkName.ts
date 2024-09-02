import type { CharacteristicValue, Nullable } from '../../types'

/**
 * Checks that supplied field meets Apple HomeKit naming rules
 * https://developer.apple.com/design/human-interface-guidelines/homekit#Help-people-choose-useful-names
 * @private
 */

export function checkName(displayName: string, name: string, value: Nullable<CharacteristicValue>): void {
  // Ensure the string starts and ends with a Unicode letter or number and allow any combination of letters, numbers, spaces, and apostrophes in the middle.
  if (typeof value === 'string' && !/^[\p{L}\p{N}][\p{L}\p{N} ']*[\p{L}\p{N}]$/u.test(value)) {
    console.warn(`HAP-NodeJS WARNING: The accessory '${displayName}' has an invalid '${name}' characteristic ('${value}'). Please use only `
    + `alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent `
    + `the accessory from being added in the Home App or cause unresponsiveness.`)
  }
}
