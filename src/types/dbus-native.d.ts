declare module "@homebridge/dbus-native" {
  import { EventEmitter } from "events";
  import { Socket } from "net";

  function systemBus(): MessageBus;

  export class MessageBus {
    connection: BusConnection;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
    public invoke(message: any, callback: any): void;
  }

  export class BusConnection extends EventEmitter {
    public stream: Socket;
  }
}
