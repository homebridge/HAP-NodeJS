declare module "@homebridge/dbus-native" {
  import { EventEmitter } from "events";

  function systemBus(): SystemBus;

  export class SystemBus {
    connection: EventEmitter

    public invoke(message: any, callback: any): void;
  }
}
