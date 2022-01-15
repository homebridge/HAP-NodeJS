// eslint-disable-next-line @typescript-eslint/ban-types,@typescript-eslint/no-explicit-any
export function once<T extends Function>(func: T): any {
  let called = false;

  return (...args: unknown[]) => {
    if (called) {
      throw new Error("This callback function has already been called by someone else; it can only be called one time.");
    } else {
      called = true;
      return func(...args);
    }
  };
}
