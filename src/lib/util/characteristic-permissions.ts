import type { Perms } from "../Characteristic";

const VALID_PERMISSIONS: ReadonlySet<unknown> = new Set([
  "pr",
  "pw",
  "ev",
  "aa",
  "tw",
  "hd",
  "wr",
]);

export function validatePerms(perms: readonly unknown[]): perms is readonly Perms[] {
  return perms.every(permission => VALID_PERMISSIONS.has(permission));
}
