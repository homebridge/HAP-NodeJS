import { Accessory } from "../Accessory";
import { Bridge } from "../Bridge";
import { ControllerIdentifier, ControllerServiceMap, SerializableController, StateChangeDelegate } from "../controller";
import * as uuid from "../util/uuid";
import { ControllerStorage } from "./ControllerStorage";
import { HAPStorage } from "./HAPStorage";

interface State {
  first?: string;
  second?: string;
}

// restores its state in two steps and reports a state change in between, like a controller whose
// characteristic updates during deserialize trigger its own change listeners
class SteppedController implements SerializableController<ControllerServiceMap, State> {
  state: State = {};
  protected stateChangeDelegate?: StateChangeDelegate;

  controllerId(): ControllerIdentifier {
    return "stepped";
  }

  constructServices(): ControllerServiceMap {
    return {};
  }

  initWithServices(): void | ControllerServiceMap {
    return undefined;
  }

  configureServices(): void {
    // nothing to configure
  }

  handleControllerRemoved(): void {
    // nothing to clean up
  }

  serialize(): State | undefined {
    return { ...this.state };
  }

  deserialize(serialized: State): void {
    this.state.first = serialized.first;
    this.stateChangeDelegate?.();
    this.state.second = serialized.second;
  }

  setupStateChangeDelegate(delegate?: StateChangeDelegate): void {
    this.stateChangeDelegate = delegate;
  }

  handleFactoryReset(): void {
    this.state = {};
  }
}

// can't read its stored data and reports the reset, like the adaptive lighting controller
class UnreadableController extends SteppedController {
  controllerId(): ControllerIdentifier {
    return "unreadable";
  }

  deserialize(): void {
    throw new Error("unreadable");
  }

  handleFactoryReset(): void {
    super.handleFactoryReset();
    this.stateChangeDelegate?.();
  }
}

describe("ControllerStorage", () => {
  test("state changes reported while restoring do not overwrite the stored data", () => {
    const accessory = new Accessory("Test", uuid.generate("controller-storage"));
    const storage = new ControllerStorage(accessory);
    const controller = new SteppedController();
    storage.trackController(controller);

    // @ts-expect-error: private access
    storage.init([{ type: "stepped", controllerData: { data: { first: "a", second: "b" } } }]);

    expect(controller.state).toEqual({ first: "a", second: "b" });
    // @ts-expect-error: private access
    expect(storage.controllerData.stepped.data).toEqual({ first: "a", second: "b" });

    controller.state.second = "c";
    // @ts-expect-error: private access
    storage.handleStateChange(controller);
    // @ts-expect-error: private access
    expect(storage.controllerData.stepped.data).toEqual({ first: "a", second: "c" });
    // @ts-expect-error: private access
    clearTimeout(storage.queuedSaveTimeout);
  });

  test("the reset after unreadable stored data is saved", () => {
    const accessory = new Accessory("Test", uuid.generate("controller-storage-reset"));
    const storage = new ControllerStorage(accessory);
    const controller = new UnreadableController();
    storage.trackController(controller);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    // @ts-expect-error: private access
    storage.init([{ type: "unreadable", controllerData: { data: { first: "a", second: "b" } } }]);

    expect(warn).toHaveBeenCalledTimes(1);
    // @ts-expect-error: private access
    expect(storage.controllerData.unreadable.data).toEqual({});
    warn.mockRestore();
    // @ts-expect-error: private access
    clearTimeout(storage.queuedSaveTimeout);
  });

  describe("removing a bridged accessory", () => {
    const storedData = (username: string, accessoryUUID: string) => HAPStorage.storage().setItemSync(ControllerStorage.persistKey(username), {
      accessories: {
        [accessoryUUID]: [
          {
            type: "stepped",
            controllerData: {
              data: { first: "a", second: "b" },
            },
          },
        ],
      },
    });

    test("unlinks its storage from the bridge", () => {
      const bridge = new Bridge("Bridge", uuid.generate("controller-storage-unlink-bridge"));
      const accessory = new Accessory("Child", uuid.generate("controller-storage-unlink-child"));
      bridge.addBridgedAccessory(accessory);
      bridge.removeBridgedAccessory(accessory);

      // @ts-expect-error: private access
      expect(bridge.controllerStorage.linkedAccessories).toEqual([]);
      // @ts-expect-error: private access
      expect(accessory.controllerStorage.parent).toBeUndefined();
    });

    test("a state change on the removed accessory does not schedule a save it cannot do", () => {
      const bridge = new Bridge("Bridge", uuid.generate("controller-storage-orphan-bridge"));
      bridge.controllerStorage.load("AA:BB:CC:00:00:04");
      const accessory = new Accessory("Child", uuid.generate("controller-storage-orphan-child"));
      const controller = new SteppedController();
      accessory.controllerStorage.trackController(controller);
      bridge.addBridgedAccessory(accessory);
      bridge.removeBridgedAccessory(accessory);
      // @ts-expect-error: private access
      clearTimeout(bridge.controllerStorage.queuedSaveTimeout);

      // @ts-expect-error: private access
      accessory.controllerStorage.handleStateChange(controller);
      // @ts-expect-error: private access
      expect(accessory.controllerStorage.queuedSaveTimeout).toBeUndefined();
    });

    test("the same accessory can be bridged again after the bridge was published", () => {
      const bridge = new Bridge("Bridge", uuid.generate("controller-storage-readd-bridge"));
      bridge.controllerStorage.load("AA:BB:CC:00:00:01");
      const accessory = new Accessory("Child", uuid.generate("controller-storage-readd-child"));
      bridge.addBridgedAccessory(accessory);
      bridge.removeBridgedAccessory(accessory);

      expect(() => bridge.addBridgedAccessory(accessory)).not.toThrow();
      // @ts-expect-error: private access
      expect(bridge.controllerStorage.linkedAccessories).toEqual([accessory.controllerStorage]);
      // @ts-expect-error: private access
      clearTimeout(bridge.controllerStorage.queuedSaveTimeout);
    });

    test("the same accessory bridged again before the bridge was published does not break loading", () => {
      const bridge = new Bridge("Bridge", uuid.generate("controller-storage-readd-early-bridge"));
      const accessory = new Accessory("Child", uuid.generate("controller-storage-readd-early-child"));
      bridge.addBridgedAccessory(accessory);
      bridge.removeBridgedAccessory(accessory);
      bridge.addBridgedAccessory(accessory);

      expect(() => bridge.controllerStorage.load("AA:BB:CC:00:00:02")).not.toThrow();
    });

    test("a replacement with the same UUID restores the stored controller data", () => {
      const username = "AA:BB:CC:00:00:03";
      const accessoryUUID = uuid.generate("controller-storage-replace-child");
      storedData(username, accessoryUUID);

      const bridge = new Bridge("Bridge", uuid.generate("controller-storage-replace-bridge"));
      const old = new Accessory("Child", accessoryUUID);
      bridge.addBridgedAccessory(old);
      bridge.removeBridgedAccessory(old);

      const replacement = new Accessory("Child", accessoryUUID);
      const controller = new SteppedController();
      replacement.controllerStorage.trackController(controller);
      bridge.addBridgedAccessory(replacement);
      bridge.controllerStorage.load(username);

      expect(controller.state).toEqual({ first: "a", second: "b" });
    });
  });

  test("controller data cleared on an accessory bridged after publish is not saved again", () => {
    const username = "AA:BB:CC:00:00:05";
    const accessoryUUID = uuid.generate("controller-storage-restored-child");
    HAPStorage.storage().setItemSync(ControllerStorage.persistKey(username), {
      accessories: {
        [accessoryUUID]: [
          {
            type: "stepped",
            controllerData: {
              data: { first: "a", second: "b" },
            },
          },
        ],
      },
    });

    const bridge = new Bridge("Bridge", uuid.generate("controller-storage-restored-bridge"));
    bridge.controllerStorage.purgeUnidentifiedAccessoryData = false; // what publish() does for a bridge without accessories
    bridge.controllerStorage.load(username);

    const accessory = new Accessory("Child", accessoryUUID);
    const controller = new SteppedController();
    accessory.controllerStorage.trackController(controller);
    bridge.addBridgedAccessory(accessory);
    expect(controller.state).toEqual({ first: "a", second: "b" });

    accessory.controllerStorage.purgeControllerData(controller); // e.g. the last pairing was removed
    // @ts-expect-error: private access
    clearTimeout(bridge.controllerStorage.queuedSaveTimeout);
    bridge.controllerStorage.save();

    expect(HAPStorage.storage().getItem(ControllerStorage.persistKey(username))).toBeUndefined();
  });
});
