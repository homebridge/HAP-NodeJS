/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "node-persist" {

  export interface InitOptions {
    dir?: string; // default 'persist'
    stringify?: typeof JSON.stringify, // default JSON.stringify
    parse?: typeof JSON.parse, // default JSON.parse
    encoding?: string, // default 'utf8'
    logging?: boolean | ((message: string) => void),
    ttl?: false | number, // can be a number in MILLISECONDS
    expiredInterval?: number, // default 2 * 60 * 1000 (2 minutes)
    forgiveParseErrors?: boolean, // default false
    writeQueue?: boolean, // default true
    writeQueueIntervalMs?: number, // default 1000
    writeQueueWriteOnlyLast?: boolean, // default true
    maxFileDescriptors?: number, // default Infinity
  }

  export class LocalStorage {

    constructor(options?: InitOptions);

    initSync(options?: InitOptions): void;
    init(options?: InitOptions): Promise<void>;
    getItem(key: string): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    setItem(key: string, value: any): Promise<void>;
    removeItem(key: string): Promise<void>;

  }

  export function initSync(options?: InitOptions): void;
  export function init(options?: InitOptions): Promise<void>;
  export function create(options?: InitOptions): LocalStorage;
  export function getItem(key: string): Promise<any>;
  export function setItem(key: string, data: any): Promise<void>;
  export function removeItem(key: string): Promise<void>;

}
