import { EventEmitter } from "events";

/**
 * @group Utils
 */
export function PromiseTimeout(timeout: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeout);
  });
}

/**
 * @group Utils
 */
export function awaitEventOnce<Obj extends EventEmitter, Event extends string, T>(element: Obj, event: Event, timeout?: number): Promise<T>;
/**
 * @group Utils
 */
export function awaitEventOnce<Obj extends EventEmitter, Event extends string>(element: Obj, event: Event, timeout?: number): Promise<void>;
// eslint-disable-next-line @typescript-eslint/ban-types
export function awaitEventOnce<Object extends EventEmitter, Event extends string, T>(element: Object, event: Event, timeout = 5000): Promise<void | T> {
  return new Promise<void | T>((resolve, reject) => {
    // eslint-disable-next-line prefer-const
    let timeoutId: NodeJS.Timeout;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveListener = (...args: any) => {
      clearTimeout(timeoutId);

      resolve(args.length ? (args.length === 1 ? args[0] : args) : undefined);
    };

    timeoutId = setTimeout(() => {
      element.removeListener(event, resolveListener);
      reject(new Error(`awaitEvent for event ${event} timed out!`));
    }, timeout);

    element.once(event, resolveListener);
  });
}

