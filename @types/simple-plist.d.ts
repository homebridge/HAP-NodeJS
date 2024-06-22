declare module "simple-plist" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function readFileSync(path: string): Record<string, any>;
}
