import { EventEmitter as BaseEventEmitter } from "events";
import { Callback } from '../types';

export type Event<T> = T & (string | symbol);
export type EventMap = { [name: string]: Callback };

export class EventEmitter<T extends EventMap, K extends Event<keyof T> = Event<keyof T>> extends BaseEventEmitter implements TypedEventEmitter<T, K> {
  addListener(event: K, listener: T[K]): this {
    return super.addListener(event, listener);
  };

  on(event: K, listener: T[K]): this {
    return super.on(event, listener);
  }

  once(event: K, listener: T[K]): this {
    return super.once(event, listener);
  }

  removeListener(event: K, listener: T[K]): this {
    return super.removeListener(event, listener);
  }

  removeAllListeners(event?: K): this {
    return super.removeAllListeners(event);
  }

  setMaxListeners(n: number): this {
    return super.setMaxListeners(n);
  }

  getMaxListeners(): number {
    return super.getMaxListeners();
  }

  listeners(event: K): T[K] [] {
    return super.listeners(event) as T[K][];
  }

  emit(event: K, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  listenerCount(type: string): number {
    return super.listenerCount(type);
  }
}


export interface TypedEventEmitter<T extends EventMap, K extends Event<keyof T> = Event<keyof T>> extends BaseEventEmitter {
  addListener(event: K, listener: T[K]): this;

  on(event: K, listener: T[K]): this;

  once(event: K, listener: T[K]): this;

  removeListener(event: K, listener: T[K]): this;

  removeAllListeners(event?: K): this;

  setMaxListeners(n: number): this;

  getMaxListeners(): number;

  listeners(event: K): T[K][];

  emit(event: K, ...args: any[]): boolean;

  listenerCount(type: string): number;
}
