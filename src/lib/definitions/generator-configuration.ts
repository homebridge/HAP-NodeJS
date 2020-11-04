import { GeneratedCharacteristic, GeneratedService } from "./generate-definitions";

export const CharacteristicHidden: Set<string> = new Set([
  "service-signature", // BLE
]);

export const CharacteristicNameOverrides: Map<string, string> = new Map([
  ["air-quality", "Air Quality"],
  ["app-matching-identifier", "App Matching Identifier"],
  ["cloud-relay.control-point", "Relay Control Point"],
  ["cloud-relay.current-state", "Relay State"],
  ["cloud-relay.enabled", "Relay Enabled"],
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
  ["tunneled-accessory.advertising", "Tunneled Accessory Advertising"],
  ["tunneled-accessory.connected", "Tunneled Accessory Connected"],
  ["water-level", "Water Level"],
]);

export const CharacteristicDeprecatedNames: Map<string, string> = new Map([ // keep in mind that the displayName will change
  ["list-pairings", "Pairing Pairings"],
]);

export const CharacteristicValidValuesOverride: Map<string, Record<string, string>> = new Map([
  ["closed-captions", { "0": "Disabled", "1": "Enabled" }],
  ["input-device-type", { "0": "Other", "1": "TV", "2": "Recording", "3": "Tuner", "4": "Playback", "5": "Audio System"}],
  ["input-source-type", { "0": "Other", "1": "Home Screen", "2": "Tuner", "3": "HDMI", "4": "Composite Video", "5": "S Video",
    "6": "Component Video", "7": "DVI", "8": "AirPlay", "9": "USB", "10": "Application" }],
  ["managed-network-enable", { "0": "Disabled", "1": "Enabled" }],
  ["manually-disabled", { "0": "Enabled", "1": "Disabled" }],
  ["media-state.current", { "0": "Play", "1": "Pause", "2": "Stop", "4": "LOADING", "5": "Interrupted" }],
  ["media-state.target", { "0": "Play", "1": "Pause", "2": "Stop" }],
  ["picture-mode", { "0": "Other", "1": "Standard", "2": "Calibrated", "3": "Calibrated Dark", "4": "Vivid", "5": "Game", "6": "Computer", "7": "Custom" }],
  ["power-mode-selection", { "0": "Show", "1": "Hide" }],
  ["recording-audio-active", { "0": "Disable", "1": "Enable"}],
  ["remote-key", { "0": "Rewind", "1": "Fast Forward", "2": "Next Track", "3": "Previous Track", "4": "Arrow Up", "5": "Arrow Down",
    "6": "Arrow Left", "7": "Arrow Right", "8": "Select", "9": "Back", "10": "Exit", "11": "Play Pause", "15": "Information" }],
  ["router-status", { "0": "Ready", "1": "Not Ready" }],
  ["siri-input-type", { "0": "Push Button Triggered Apple TV"}],
  ["sleep-discovery-mode", { "0": "Not Discoverable", "1": "Always Discoverable" }],
  ["visibility-state.current", { "0": "Shown", "1": "Hidden" }],
  ["visibility-state.target", { "0": "Shown", "1": "Hidden" }],
  ["volume-control-type", { "0": "None", "1": "Relative", "2": "Relative With Current", "3": "Absolute" }],
  ["volume-selector", { "0": "Increment", "1": "Decrement" }],
  ["wifi-satellite-status", { "0": "Unknown", "1": "Connected", "2": "Not Connected" }],
] as [string, Record<string, string>][]);

export const CharacteristicClassAdditions: Map<string, string[]> = new Map([
  ["humidifier-dehumidifier.state.target", ["/**\n   * @deprecated Removed in iOS 11. Use {@link HUMIDIFIER_OR_DEHUMIDIFIER} instead.\n   */\n  public static readonly AUTO = 0;"]]
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
  ["target-air-quality", { // some legacy characteristic, don't know where it comes from or where it was used
    id: "target-air-quality",
    UUID: "000000AE-0000-1000-8000-0026BB765291",
    name: "Target Air Quality",
    className: "TargetAirQuality",
    deprecatedNotice: "Removed and not used anymore",

    format: "uint8",
    properties: 7, // read, write, notify
    minValue: 0,
    maxValue: 2,
    validValues: {
      "0": "EXCELLENT",
      "1": "GOOD",
      "2": "FAIR",
    },
  }],
]);

export const ServiceNameOverrides: Map<string, string> = new Map([
  ["accessory-information", "Accessory Information"],
  ["camera-rtp-stream-management", "Camera RTP Stream Management"],
  ["fanv2", "Fanv2"],
  ["service-label", "Service Label"],
  ["smart-speaker", "Smart Speaker"],
  ["speaker", "Television Speaker"], // has some additional accessories
]);

export const ServiceDeprecatedNames: Map<string, string> = new Map([
  ["battery", "Battery Service"],
  ["camera-recording-management", "Camera Event Recording Management"],
  ["cloud-relay", "Relay"],
  ["slats", "Slat"],
  ["tunnel", "Tunneled BTLE Accessory Service"],
]);

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
  ["camera-control", {
    id: "camera-control",
    UUID: "00000111-0000-1000-8000-0026BB765291",
    name: "Camera Control",
    className: "CameraControl",
    deprecatedNotice: "This service has no usage anymore and will be ignored by iOS",

    requiredCharacteristics: ["on"],
    optionalCharacteristics: ["horizontal-tilt.current", "vertical-tilt.current", "horizontal-tilt.target", "vertical-tilt.target", "night-vision", "optical-zoom", "digital-zoom", "image-rotation", "image-mirroring", "name"]
  }
  ],
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
]);

export const ServiceSinceInformation: Map<string, string> = new Map([
  ["outlet", "13"],
]);
