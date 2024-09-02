/**
 * Function wrapper to ensure a function/callback is only called once.
 *
 * @group Utils
 */
export function once<T extends Function>(func: T): T { // eslint-disable-line ts/no-unsafe-function-type
  let called = false

  return ((...args: unknown[]) => {
    if (called) {
      throw new Error('This callback function has already been called by someone else; it can only be called one time.')
    } else {
      called = true
      return func(...args)
    }
  }) as unknown as T
}
