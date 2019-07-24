import { EventEmitter as BaseEventEmitter } from "events";

export class EventEmitter<Event extends string | symbol, Listener extends (...args: any[]) => void> extends BaseEventEmitter {
  addListener(event: Event, listener: Listener): this {
    return super.addListener(event, listener);
  };

  on(event: Event, listener: Listener): this {
    return super.on(event, listener);
  }

  once(event: Event, listener: Listener): this {
    return super.once(event, listener);
  }

  removeListener(event: Event, listener: Listener): this {
    return super.removeListener(event, listener);
  }

  removeAllListeners(event?: Event): this {
    return super.removeAllListeners(event);
  }

  setMaxListeners(n: number): this {
    return super.setMaxListeners(n);
  }

  getMaxListeners(): number {
    return super.getMaxListeners();
  }

  listeners(event: Event): Listener[] {
    return super.listeners(event) as Listener[];
  }

  emit(event: Event, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  listenerCount(type: string): number {
    return super.listenerCount(type);
  }
}
