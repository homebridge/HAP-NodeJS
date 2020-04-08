import { Status } from './lib/HAPServer';
import { Characteristic, CharacteristicProps } from './lib/Characteristic';

export type Nullable<T> = T | null;

export type WithUUID<T> = T & { UUID: string };

export interface ToHAPOptions {
  omitValues: boolean;
}

export type SessionIdentifier = string; // uuid string uniquely identifying every HAP connection
export type MacAddress = string; // format like 'XX:XX:XX:XX:XX:XX' with XX being a valid hexadecimal string

export type Callback = (...args: any[]) => void;
export type NodeCallback<T> = (err: Nullable<Error> | undefined, data?: T) => void;
export type VoidCallback = (err?: Nullable<Error>) => void;
export type PairingsCallback<T> = (err: number, data?: T) => void;
export type PrimitiveTypes = string | number | boolean;

type HAPProps =
  Pick<CharacteristicProps, 'perms' | 'format' | 'description' | 'unit' | 'maxValue' | 'minValue' | 'minStep' | 'maxLen'>
  & Pick<Characteristic, 'valid-values' | 'valid-values-range'>
export type HapCharacteristic = HAPProps & {
  iid: number;
  type: string;
  value: string | number | {} | null;
}
export type CharacteristicValue = PrimitiveTypes | PrimitiveTypes[] | { [key: string]: PrimitiveTypes };
export type CharacteristicChange = {
  newValue: CharacteristicValue;
  oldValue: CharacteristicValue;
  context?: any;
  characteristic: Characteristic;
};
export type HapService = {
  iid: number;
  type: string;

  characteristics: HapCharacteristic[];
  primary: boolean;
  hidden: boolean;
  linked: number[];
}

export type CharacteristicData = {
  aid: number;
  iid: number;
  v?: string;
  value?: string;
  s?: Status;
  status?: Status;
  e?: string;
  ev?: boolean;
  r?: boolean;
}
/**
 * @deprecated replaced by {@link AudioStreamingCodec}
 */
export type AudioCodec = {
  samplerate: number;
  type: string;
}
/**
 * @deprecated replaced by {@link H264CodecParameters}
 */
export type VideoCodec = {
  levels: number[];
  profiles: number[];
}
/**
 * @deprecated replaced by {@link AudioStreamingOptions}
 */
export type StreamAudioParams = {
  comfort_noise: boolean;
  codecs: AudioCodec[];
};
/**
 * @deprecated replaced by {@link VideoStreamingOptions}
 */
export type StreamVideoParams = {
  codec?: VideoCodec;
  resolutions: [number, number, number][]; // width, height, framerate
};
