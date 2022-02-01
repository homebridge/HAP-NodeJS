// eslint-disable-next-line @typescript-eslint/ban-types
export function once<T extends Function>(func: T): T {
  let called = false;

  return ((...args: unknown[]) => {
    if (called) {
      throw new Error("This callback function has already been called by someone else; it can only be called one time.");
    } else {
      called = true;
      return func(...args);
    }
  }) as unknown as T;
}
