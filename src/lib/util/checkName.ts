/**
 * Checks that supplied field meets Apple HomeKit naming rules
 * https://developer.apple.com/design/human-interface-guidelines/homekit#Help-people-choose-useful-names
 * @private Private API
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function checkName(displayName: string, name: string, value: any): void {
  const validHK = /^[a-zA-Z0-9\s'-.]+$/;   // Ensure only letter, numbers, apostrophe, or dash
  const startWith = /^[a-zA-Z0-9]/;       // Ensure only letters or numbers are at the beginning of string
  const endWith = /[a-zA-Z0-9]$/;         // Ensure only letters or numbers are at the end of string

  if (!validHK.test(value) || !startWith.test(value) || !endWith.test(value)) {
    console.warn("HAP-NodeJS WARNING: The accessory '" + displayName + "' is getting published with the characteristic '" +
      name + "'" + " not following HomeKit naming rules ('" + value + "'). " +
      "Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. " +
      "This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  }
}