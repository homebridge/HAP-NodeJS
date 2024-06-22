/**
 * A simple clone function that also allows you to pass an "extend" object whose properties will be
 * added to the cloned copy of the original object passed.
 * @group Utils
 */
export function clone<T extends object, U>(object: T, extend?: U): T & U {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloned = {} as Record<any, any>;

  for (const [ key, value ] of Object.entries(object)) {
    cloned[key] = value;
  }

  if (extend) {
    for (const [ key, value ] of Object.entries(extend)) {
      cloned[key] = value;
    }
  }

  return cloned;
}
