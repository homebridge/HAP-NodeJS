import assert from "assert";
import { Access } from "../Characteristic";
import { GeneratedCharacteristic, GeneratedService } from "./generate-definitions";

const enum PropertyId {
  NOTIFY = 0x01,
  READ = 0x02,
  WRITE = 0x04,
  BROADCAST = 0x08, // BLE
  ADDITIONAL_AUTHORIZATION = 0x10,
  TIMED_WRITE = 0x20,
  HIDDEN = 0x40,
  WRITE_RESPONSE = 0x80,
}

export const CharacteristicHidden: Set<string> = new Set([
  "service-signature", // BLE
]);

export const CharacteristicNameOverrides: Map<string, string> = new Map([
  ["air-quality", "Air Quality"],
  ["app-matching-identifier", "App Matching Identifier"],
  ["density.voc", "VOC Density"],
  ["filter.reset-indication", "Reset Filter Indication"], // Filter Reset Change Indication
  ["light-level.current", "Current Ambient Light Level"],
  ["network-client-control", "Network Client Profile Control"],
  ["on", "On"],
  ["selected-stream-configuration", "Selected RTP Stream Configuration"],
  ["service-label-index", "Service Label Index"],
  ["service-label-namespace", "Service Label Namespace"],
  ["setup-stream-endpoint", "Setup Endpoints"],
  ["snr", "Signal To Noise Ratio"],
  ["supported-target-configuration", "Target Control Supported Configuration"],
  ["target-list", "Target Control List"],
  ["water-level", "Water Level"],
]);

// keep in mind that the displayName will change
export const CharacteristicDeprecatedNames: Map<string, string> = new Map([]);

export const CharacteristicValidValuesOverride: Map<string, Record<string, string>> = new Map([
  ["camera-operating-mode-indicator", { "0": "Disable", "1": "Enable" }],
  ["closed-captions", { "0": "Disabled", "1": "Enabled" }],
  ["event-snapshots-active", { "0": "Disable", "1": "Enable" }],
  ["homekit-camera-active", { "0": "Off", "1": "On" }],
  ["input-device-type", { "0": "Other", "1": "TV", "2": "Recording", "3": "Tuner", "4": "Playback", "5": "Audio System" }],
  ["input-source-type", { "0": "Other", "1": "Home Screen", "2": "Tuner", "3": "HDMI", "4": "Composite Video", "5": "S Video",
    "6": "Component Video", "7": "DVI", "8": "AirPlay", "9": "USB", "10": "Application" }],
  ["managed-network-enable", { "0": "Disabled", "1": "Enabled" }],
  ["manually-disabled", { "0": "Enabled", "1": "Disabled" }],
  ["media-state.current", { "0": "Play", "1": "Pause", "2": "Stop", "4": "LOADING", "5": "Interrupted" }],
  ["media-state.target", { "0": "Play", "1": "Pause", "2": "Stop" }],
  ["periodic-snapshots-active", { "0": "Disable", "1": "Enable" }],
  ["picture-mode", { "0": "Other", "1": "Standard", "2": "Calibrated", "3": "Calibrated Dark", "4": "Vivid", "5": "Game", "6": "Computer", "7": "Custom" }],
  ["power-mode-selection", { "0": "Show", "1": "Hide" }],
  ["recording-audio-active", { "0": "Disable", "1": "Enable" }],
  ["remote-key", { "0": "Rewind", "1": "Fast Forward", "2": "Next Track", "3": "Previous Track", "4": "Arrow Up", "5": "Arrow Down",
    "6": "Arrow Left", "7": "Arrow Right", "8": "Select", "9": "Back", "10": "Exit", "11": "Play Pause", "15": "Information" }],
  ["router-status", { "0": "Ready", "1": "Not Ready" }],
  ["security-system.alarm-type", { "0": "No Alarm", "1": "Unknown" }],
  ["siri-input-type", { "0": "Push Button Triggered Apple TV" }],
  ["sleep-discovery-mode", { "0": "Not Discoverable", "1": "Always Discoverable" }],
  ["third-party-camera-active", { "0": "Off", "1": "On" }],
  ["visibility-state.current", { "0": "Shown", "1": "Hidden" }],
  ["visibility-state.target", { "0": "Shown", "1": "Hidden" }],
  ["volume-control-type", { "0": "None", "1": "Relative", "2": "Relative With Current", "3": "Absolute" }],
  ["volume-selector", { "0": "Increment", "1": "Decrement" }],
  ["wifi-satellite-status", { "0": "Unknown", "1": "Connected", "2": "Not Connected" }],
] as [string, Record<string, string>][]);

export const CharacteristicClassAdditions: Map<string, string[]> = new Map([]);

export const CharacteristicOverriding: Map<string, (generated: GeneratedCharacteristic) => void> = new Map([
  ["rotation.speed", generated => {
    generated.units = "percentage";
  }],
  ["temperature.current", generated => {
    generated.minValue = -270;
  }],
  ["characteristic-value-transition-control", generated => {
    generated.properties |= PropertyId.WRITE_RESPONSE;
  }],
  ["setup-data-stream-transport", generated => {
    generated.properties |= PropertyId.WRITE_RESPONSE;
  }],
  ["data-stream-hap-transport", generated => {
    generated.properties |= PropertyId.WRITE_RESPONSE;
  }],
  ["lock-mechanism.last-known-action", generated => {
    assert(generated.maxValue === 8, "LockLastKnownAction seems to have changed in metadata!");
    generated.maxValue = 10;
    generated.validValues!["9"] = "SECURED_PHYSICALLY";
    generated.validValues!["10"] = "UNSECURED_PHYSICALLY";
  }],
  ["configured-name", generated => {
    // the write permission on the configured name characteristic is actually optional and should only be supported
    // if a HomeKit controller should be able to change the name (e.g. for a TV Input).
    // As of legacy compatibility we just add that permission and tackle that problem later in a TVController (or something).
    generated.properties |= PropertyId.WRITE;
  }],
  ["is-configured", generated => {
    // write permission on is configured is optional (out of history it was present with HAP-NodeJS)
    // if the HomeKit controller is able to change the configured state, it can be set to write.
    generated.properties |= PropertyId.WRITE;
  }],
  ["display-order", generated => {
    // write permission on display order is optional (out of history it was present with HAP-NodeJS)
    // if the HomeKit controller is able to change the configured state, it can be set to write.
    generated.properties |= PropertyId.WRITE;
  }],
  ["button-event", generated => {
    generated.adminOnlyAccess = [Access.NOTIFY];
  }],
  ["target-list", generated => {
    generated.adminOnlyAccess = [Access.READ, Access.WRITE];
  }],
  ["slat.state.current", generated => {
    generated.maxValue = 2;
  }],
  ["event-snapshots-active", generated => {
    generated.format = "uint8";
    generated.minValue = 0;
    generated.maxValue = 1;
    generated.properties &= ~PropertyId.TIMED_WRITE;
  }],
  ["homekit-camera-active", generated => {
    generated.format = "uint8";
    generated.minValue = 0;
    generated.maxValue = 1;
    generated.properties &= ~PropertyId.TIMED_WRITE;
  }],
  ["periodic-snapshots-active", generated => {
    generated.format = "uint8";
    generated.properties &= ~PropertyId.TIMED_WRITE;
  }],
  ["third-party-camera-active", generated => {
    generated.format = "uint8";
  }],
  ["input-device-type", generated => {
    // @ts-expect-error: undefined access
    generated.validValues[6] = null;
  }],
  ["pairing-features", generated => {
    generated.properties &= ~PropertyId.WRITE;
  }],
  ["picture-mode", generated => {
    // @ts-expect-error: undefined access
    generated.validValues[8] = null;
    // @ts-expect-error: undefined access
    generated.validValues[9] = null;
    // @ts-expect-error: undefined access
    generated.validValues[10] = null;
    // @ts-expect-error: undefined access
    generated.validValues[11] = null;
    // @ts-expect-error: undefined access
    generated.validValues[12] = null;
    // @ts-expect-error: undefined access
    generated.validValues[13] = null;
  }],
  ["remote-key", generated => {
    // @ts-expect-error: undefined access
    generated.validValues[12] = null;
    // @ts-expect-error: undefined access
    generated.validValues[13] = null;
    // @ts-expect-error: undefined access
    generated.validValues[14] = null;
    // @ts-expect-error: undefined access
    generated.validValues[16] = null;
  }],
  ["service-label-namespace", generated => {
    generated.maxValue = 1;
  }],
  ["siri-input-type", generated => {
    generated.maxValue = 0;
  }],
  ["visibility-state.current", generated => {
    generated.maxValue = 1;
  }],
  ["active-identifier", generated => {
    generated.minValue = undefined;
  }],
  ["identifier", generated => {
    generated.minValue = undefined;
  }],
  ["access-code-control-point", generated => {
    generated.properties |= PropertyId.WRITE_RESPONSE;
  }],
  ["nfc-access-control-point", generated => {
    generated.properties |= PropertyId.WRITE_RESPONSE;
  }],
]);

export const CharacteristicManualAdditions: Map<string, GeneratedCharacteristic> = new Map([
  ["diagonal-field-of-view", {
    id: "diagonal-field-of-view",
    UUID: "00000224-0000-1000-8000-0026BB765291",
    name: "Diagonal Field Of View",
    className: "DiagonalFieldOfView",
    since: "13.2",
    format: "float",
    units: "arcdegrees",
    properties: 3, // notify, paired read
    minValue: 0,
    maxValue: 360,
  }],
  ["version", { // don't know why, but version has notify permission even if it shouldn't have one
    id: "version",
    UUID: "00000037-0000-1000-8000-0026BB765291",
    name: "Version",
    className: "Version",
    format: "string",
    properties: 2, // paired read
    maxLength: 64,
  }],
  ["relay-control-point", {
    id: "relay-control-point",
    UUID: "0000005E-0000-1000-8000-0026BB765291",
    name: "Relay Control Point",
    className: "RelayControlPoint",
    deprecatedNotice: "Removed",
    format: "tlv8",
    properties: 7, // read, write, notify
  }],
  ["relay-enabled", {
    id: "relay-enabled",
    UUID: "0000005B-0000-1000-8000-0026BB765291",
    name: "Relay Enabled",
    className: "RelayEnabled",
    deprecatedNotice: "Removed",
    format: "bool",
    properties: 7, // read, write, notify
  }],
  ["relay-state", {
    id: "relay-state",
    UUID: "0000005C-0000-1000-8000-0026BB765291",
    name: "Relay State",
    className: "RelayState",
    deprecatedNotice: "Removed",
    format: "uint8",
    properties: 3, // read, notify
    stepValue: 1,
    minValue: 0,
    maxValue: 5,
  }],
  ["tunnel-connection-timeout", {
    id: "tunnel-connection-timeout",
    UUID: "00000061-0000-1000-8000-0026BB765291",
    name: "Tunnel Connection Timeout",
    className: "TunnelConnectionTimeout",
    deprecatedNotice: "Removed",
    format: "int",
    properties: 7, // read, write, notify
  }],
  ["tunneled-accessory-advertising", {
    id: "tunneled-accessory-advertising",
    UUID: "00000060-0000-1000-8000-0026BB765291",
    name: "Tunneled Accessory Advertising",
    className: "TunneledAccessoryAdvertising",
    deprecatedNotice: "Removed",
    format: "bool",
    properties: 7, // read, write, notify
  }],
  ["tunneled-accessory-connected", {
    id: "tunneled-accessory-connected",
    UUID: "00000059-0000-1000-8000-0026BB765291",
    name: "Tunneled Accessory Connected",
    className: "TunneledAccessoryConnected",
    deprecatedNotice: "Removed",
    format: "bool",
    properties: 7, // read, write, notify
  }],
  ["tunneled-accessory-state-number", {
    id: "tunneled-accessory-state-number",
    UUID: "00000058-0000-1000-8000-0026BB765291",
    name: "Tunneled Accessory State Number",
    className: "TunneledAccessoryStateNumber",
    deprecatedNotice: "Removed",
    format: "int",
    properties: 3, // read, notify
  }],
]);

export const ServiceNameOverrides: Map<string, string> = new Map([
  ["accessory-information", "Accessory Information"],
  ["camera-rtp-stream-management", "Camera RTP Stream Management"],
  ["fanv2", "Fanv2"],
  ["service-label", "Service Label"],
  ["smart-speaker", "Smart Speaker"],
  ["speaker", "Television Speaker"], // has some additional accessories
  ["nfc-access", "NFC Access"],
]);

export const ServiceDeprecatedNames: Map<string, string> = new Map([]);

interface CharacteristicConfigurationOverride {
  addedRequired?: string[],
  removedRequired?: string[],
  addedOptional?: string[],
  removedOptional?: string[],
}

export const ServiceCharacteristicConfigurationOverrides: Map<string, CharacteristicConfigurationOverride> = new Map([
  ["accessory-information", { addedRequired: ["firmware.revision"], removedOptional: ["firmware.revision"] }],
  ["camera-operating-mode", { addedOptional: ["diagonal-field-of-view"] }],
]);

export const ServiceManualAdditions: Map<string, GeneratedService> = new Map([
  ["og-speaker", { // the normal speaker is considered to be the "TelevisionSpeaker"
    id: "og-speaker",
    UUID: "00000113-0000-1000-8000-0026BB765291",
    name: "Speaker",
    className: "Speaker",
    since: "10",
    requiredCharacteristics: ["mute"],
    optionalCharacteristics: ["active", "volume"],
  }],
  ["cloud-relay", {
    id: "cloud-relay",
    UUID: "0000005A-0000-1000-8000-0026BB765291",
    name: "Cloud Relay",
    className: "CloudRelay",
    deprecatedNotice: "Removed",
    requiredCharacteristics: [
      "relay-control-point",
      "relay-state",
      "relay-enabled",
    ],
  }],
  ["tunnel", {
    id: "tunnel",
    UUID: "00000056-0000-1000-8000-0026BB765291",
    name: "Tunnel",
    className: "Tunnel",
    deprecatedNotice: "Removed",
    requiredCharacteristics: [
      "accessory.identifier",
      "tunnel-connection-timeout",
      "tunneled-accessory-advertising",
      "tunneled-accessory-connected",
      "tunneled-accessory-state-number",
    ],
  }],
]);

export const CharacteristicSinceInformation: Map<string, string> = new Map([
  ["activity-interval", "14"],
  ["cca-energy-detect-threshold", "14"],
  ["cca-signal-detect-threshold", "14"],
  ["characteristic-value-active-transition-count", "14"],
  ["characteristic-value-transition-control", "14"],
  ["current-transport", "14"],
  ["data-stream-hap-transport", "14"],
  ["data-stream-hap-transport-interrupt", "14"],
  ["event-retransmission-maximum", "14"],
  ["event-transmission-counters", "14"],
  ["heart-beat", "14"],
  ["mac-retransmission-maximum", "14"],
  ["mac-retransmission-counters", "14"],
  ["operating-state-response", "14"],
  ["ping", "14"],
  ["receiver-sensitivity", "14"],
  ["rssi", "14"],
  ["setup-transfer-transport", "13.4"],
  ["sleep-interval", "14"],
  ["snr", "14"],
  ["supported-characteristic-value-transition-configuration", "14"],
  ["supported-diagnostics-snapshot", "14"],
  ["supported-transfer-transport-configuration", "13.4"],
  ["transmit-power", "14"],
  ["transmit-power-maximum", "14"],
  ["transfer-transport-management", "13.4"],
  ["video-analysis-active", "14"],
  ["wake-configuration", "13.4"],
  ["wifi-capabilities", "14"],
  ["wifi-configuration-control", "14"],
  ["access-code-control-point", "15"],
  ["access-code-supported-configuration", "15"],
  ["configuration-state", "15"],
  ["hardware-finish", "15"],
  ["nfc-access-control-point", "15"],
  ["nfc-access-supported-configuration", "15"],
]);

export const ServiceSinceInformation: Map<string, string> = new Map([
  ["outlet", "13"],
  ["access-code", "15"],
  ["nfc-access", "15"],
]);
