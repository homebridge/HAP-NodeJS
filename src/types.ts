import { Status } from './lib/HAPServer';
import { HapCharacteristic } from './lib/Characteristic';

export type Nullable<T> = T | null;

export type WithUUID<T> = T & { UUID: string };

export interface ToHAPOptions {
  omitValues: boolean;
}

export type Callback = (...args: any[]) => void;
export type NodeCallback<T> = (err: Nullable<Error> | undefined, data?: T) => void;
export type VoidCallback = (err?: Nullable<Error>) => void;
export type PrimitiveTypes = string | number | boolean;

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
export type AudioCodec = {
  samplerate: number;
  type: string;
}
export type VideoCodec = {
  levels: number[];
  profiles: number[];
}
export type Source = {
  port: number;
  srtp_key: Buffer;
  srtp_salt: Buffer;
  targetAddress?: string;
  proxy_rtp?: number;
  proxy_rtcp?: number;
};
export type Address = {
  address: string;
  type: 'v4' | 'v6';
}
export type AudioInfo = {
  codec: string | number;
  channel: number;
  bit_rate: number;
  sample_rate: number;
  packet_time: number;
  pt: number;
  ssrc: number;
  max_bit_rate: number;
  rtcp_interval: number;
  comfort_pt: number;
};
export type VideoInfo = {
  profile: number;
  level: number;
  width: number;
  height: number;
  fps: number;
  ssrc: number;
  pt: number;
  max_bit_rate: number;
  rtcp_interval: number;
  mtu: number;
};
export type SessionIdentifier = Buffer | string;
export type StreamAudioParams = {
  comfort_noise: boolean;
  codecs: AudioCodec[];
};
export type Resolution = [number, number, number];
export type StreamVideoParams = {
  codec?: VideoCodec;
  resolutions: Resolution[];
};
