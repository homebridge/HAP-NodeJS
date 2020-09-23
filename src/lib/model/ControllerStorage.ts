import {MacAddress} from "../../types";
import util from "util";
import createDebug from "debug";
import {ControllerType, SerializableController} from "../controller";
import {Accessory} from "../Accessory";
import { HAPStorage } from "./HAPStorage";

const debug = createDebug("HAP-NodeJS:ControllerStorage");

interface StorageLayout {
    accessories: Record<string, StoredControllerData[]>, // indexed by accessory UUID
}

interface StoredControllerData {
    type: ControllerType,
    controllerData: ControllerData,
}

interface ControllerData {
    data: any,
    /*
    This property and the exact sequence this property is accessed solves the following problems:
      - Orphaned ControllerData won't be there forever and gets cleared at some point
      - When storage is loaded, there is no fixed time frame after which Controllers need to be configured
     */
    purgeOnNextLoad?: boolean,
}

export class ControllerStorage {

    private readonly accessoryUUID: string;
    private initialized: boolean = false;

    // ----- properties only set in parent storage object ------
    private username?: MacAddress;
    private fileCreated: boolean = false;
    purgeUnidentifiedAccessoryData: boolean = true;
    // ---------------------------------------------------------

    private trackedControllers: SerializableController[] = []; // used to track controllers before data was loaded from disk
    private controllerData: Record<ControllerType, ControllerData> = {};
    private restoredAccessories?: Record<string, StoredControllerData[]>; // indexed by accessory UUID

    private parent?: ControllerStorage;
    private linkedAccessories?: ControllerStorage[]; // indexed by accessory UUID

    public constructor(accessory: Accessory) {
        this.accessoryUUID = accessory.UUID;
    }

    public linkAccessory(accessory: Accessory) {
        if (!this.linkedAccessories) {
            this.linkedAccessories = [];
        }

        const storage = accessory.controllerStorage;
        this.linkedAccessories.push(storage);
        storage.parent = this;

        const saved = this.restoredAccessories && this.restoredAccessories[accessory.UUID];
        if (this.initialized) {
            storage.init(saved);
        }
    }

    public trackController(controller: SerializableController) {
        controller.setupStateChangeDelegate(this.handleStateChange.bind(this, controller)); // setup delegate

        if (!this.initialized) { // track controller if data isn't loaded yet
            this.trackedControllers.push(controller);
        } else {
            this.restoreController(controller);
        }
    }

    public purgeControllerData(controller: SerializableController) {
        delete this.controllerData[controller.controllerType];

        if (this.initialized) {
            setTimeout(() => this.save(), 0);
        }
    }

    private handleStateChange(controller: SerializableController) {
        const serialized = controller.serialize();

        if (!serialized) { // can be undefined when controller wishes to delete data
            delete this.controllerData[controller.controllerType];
        } else {
            let controllerData = this.controllerData[controller.controllerType];

            if (!controllerData) {
                this.controllerData[controller.controllerType] = {
                    data: serialized,
                };
            } else {
                controllerData.data = serialized;
            }
        }

        if (this.initialized) { // only save if data was loaded
            // run save data "async", as handleStateChange call will probably always be caused by a http request
            // this should improve our response time
            setTimeout(() => this.save(), 0);
        }
    }


    private restoreController(controller: SerializableController) {
        if (!this.initialized) {
            throw new Error("Illegal state. Controller data wasn't loaded yet!");
        }

        const controllerData = this.controllerData[controller.controllerType];
        if (controllerData) {
            controller.deserialize(controllerData.data);
            controllerData.purgeOnNextLoad = false;
        }
    }

    /**
     * Called when this particular Storage object is feed with data loaded from disk.
     * This method is only called once.
     *
     * @param data - array of {@link StoredControllerData}. undefined if nothing was stored on disk for this particular storage object
     */
    private init(data?: StoredControllerData[]) {
        if (this.initialized) {
            throw new Error(`ControllerStorage for accessory ${this.accessoryUUID} was already initialized!`);
        }
        this.initialized = true;

        // storing data into our local controllerData Record
        data && data.forEach(saved => this.controllerData[saved.type] = saved.controllerData);

        const restoredControllers: ControllerType[] = [];
        this.trackedControllers.forEach(controller => {
            this.restoreController(controller);
            restoredControllers.push(controller.controllerType);
        });
        this.trackedControllers = []; // clear tracking list

        Object.entries(this.controllerData).forEach(([type, data]) => {
            if (data.purgeOnNextLoad) {
                delete this.controllerData[type];
                return;
            }

            if (!restoredControllers.includes(type)) {
                data.purgeOnNextLoad = true;
            }
        });
    }

    public load(username: MacAddress) { // will be called once accessory gets published
        if (this.username) {
            throw new Error("ControllerStorage was already loaded!");
        }
        this.username = username;

        const key = ControllerStorage.persistKey(username);
        const saved: StorageLayout | undefined = HAPStorage.storage().getItem(key);

        let ownData;
        if (saved) {
            this.fileCreated = true;

            ownData = saved.accessories[this.accessoryUUID];
            delete saved.accessories[this.accessoryUUID];
        }

        this.init(ownData);

        if (this.linkedAccessories) {
            this.linkedAccessories.forEach(linkedStorage => {
                const savedData = saved && saved.accessories[linkedStorage.accessoryUUID];
                linkedStorage.init(savedData);

                if (saved) {
                    delete saved.accessories[linkedStorage.accessoryUUID];
                }
            });
        }

        if (saved && Object.keys(saved.accessories).length > 0) {
            if (!this.purgeUnidentifiedAccessoryData) {
                this.restoredAccessories = saved.accessories; // save data for controllers which aren't linked yet
            } else {
                debug("Purging unidentified controller data for bridge %s", username);
            }
        }
    }

    public save() {
        if (this.parent) {
            this.parent.save();
            return;
        }

        if (!this.initialized) {
            throw new Error("ControllerStorage has not yet been loaded!");
        }
        if (!this.username) {
            throw new Error("Cannot save controllerData for a storage without a username!");
        }

        const accessories: Record<string, Record<ControllerType, ControllerData>> = {
            [this.accessoryUUID]: this.controllerData,
        };
        if (this.linkedAccessories) { // grab data from all linked storage objects
            this.linkedAccessories.forEach(accessory => accessories[accessory.accessoryUUID] = accessory.controllerData);
        }

        const accessoryData: Record<string, StoredControllerData[]> = this.restoredAccessories || {};
        Object.entries(accessories).forEach(([uuid, controllerData]) => {
            const entries = Object.entries(controllerData);

            if (entries.length > 0) {
                accessoryData[uuid] = entries.map(([type, data]) => ({
                    type: type,
                    controllerData: data,
                }));
            }
        });

        const key = ControllerStorage.persistKey(this.username);
        if (Object.keys(accessoryData).length > 0) {
            const saved: StorageLayout = {
                accessories: accessoryData,
            };

            this.fileCreated = true;
            HAPStorage.storage().setItemSync(key, saved);
        } else if (this.fileCreated) {
            this.fileCreated = false;
            HAPStorage.storage().removeItemSync(key);
        }
    }

    static persistKey(username: MacAddress) {
        return util.format("ControllerStorage.%s.json", username.replace(/:/g, "").toUpperCase());
    }

    static remove(username: MacAddress) {
        const key = ControllerStorage.persistKey(username);
        HAPStorage.storage().removeItemSync(key);
    }

}
