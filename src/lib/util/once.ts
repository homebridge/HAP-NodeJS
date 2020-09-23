export function once(func: Function) {
  let called = false;

  return (...args: any[]) => {
    if (called) {
      throw new Error("This callback function has already been called by someone else; it can only be called one time.");
    }
    else {
      called = true;
      return func(...args);
    }
  };
}
