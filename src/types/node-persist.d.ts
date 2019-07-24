declare module 'node-persist' {
  export function create(): any;

  export function initSync(opts?: { dir: string }): void;
  export function getItem(key: string): any;
  export function setItemSync(key: string, data: any): void;
  export function persistSync(): void;
  export function removeItemSync(key: string): void;
}
