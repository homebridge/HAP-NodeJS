/**
 * A simple clone function that also allows you to pass an "extend" object whose properties will be
 * added to the cloned copy of the original object passed.
 */
export function clone<T, U>(object: T, extend?: U): T & U {

  const cloned = {} as Record<any, any>;

  for (let key in object) {
    cloned[key] = object[key];
  }

  for (let key2 in extend) {
    cloned[key2] = extend[key2];
  }

  return cloned;
}
