declare module 'node-persist' {

  export interface InitOptions {
    dir?: string;
  }

  export class LocalStorage {

    constructor(options?: InitOptions);

    initSync(options?: InitOptions): void;
    getItem(key: string): any;
    setItemSync(key: string, value: any): void;
    removeItemSync(key: string): void

  }

  export function initSync(options?: InitOptions): void;
  export function create(options?: InitOptions): LocalStorage;
  export function getItem(key: string): any;
  export function setItemSync(key: string, data: any): void;
  export function persistSync(): void;
  export function removeItemSync(key: string): void;

}
