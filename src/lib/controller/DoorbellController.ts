import { EventTriggerOption } from "../camera";
import { Characteristic } from "../Characteristic";
import type { Doorbell } from "../definitions";
import { Service } from "../Service";
import { CameraController, CameraControllerOptions, CameraControllerServiceMap } from "./CameraController";
import { ControllerServiceMap } from "./Controller";

/**
 * Options which are additionally supplied for a {@link DoorbellController}.
 */
export interface DoorbellOptions {
    /**
     * Name used to for the {@link Service.Doorbell} service.
     */
    name?: string;

    /**
     * This property may be used to supply an external {@link Service.Doorbell}.
     * This is particularly handy when one is migrating from an existing implementation
     * to a `DoorbellController` and want to avoid loosing users automation by removing and deleting the service.
     *
     * NOTE: You are responsible for managing the service yourself (e.g. creation, restoring, adding to accessory, ...)
     */
    externalDoorbellService?: Service
}

/**
 * The `DoorbellController` to efficiently manage doorbell implementations with HAP-NodeJS.
 *
 * NOTICE: We subclass from the CameraController here and deliberately do not introduce/set an
 * own/custom ControllerType for Doorbells, as Cameras and Doorbells are pretty much the same thing
 * and would collide otherwise.
 * As the possibility exists, both the CameraController and DoorbellController are written to support migration
 * from one to another. Meaning a serialized CameraController can be initialized as a DoorbellController
 * (on startup in {@link initWithServices}) and vice versa.
 */
export class DoorbellController extends CameraController {
    private doorbellService?: Doorbell;
    private doorbellServiceExternallySupplied: boolean = false;
    /**
     * Temporary storage. Erased after init.
     */
    private doorbellOptions?: DoorbellOptions;

    /**
     * Initializes a new `DoorbellController`.
     * @param options - The {@link CameraControllerOptions} and optional {@link DoorbellOptions}.
     */
    constructor(options: CameraControllerOptions & DoorbellOptions) {
        super(options);
        this.doorbellOptions = {
            name: options.name,
            externalDoorbellService: options.externalDoorbellService,
        }
    }

    /**
     * Call this method to signal a doorbell button press.
     */
    public ringDoorbell() {
        this.doorbellService!.updateCharacteristic(Characteristic.ProgrammableSwitchEvent, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
    }

    constructServices(): CameraControllerServiceMap {
        if (this.doorbellOptions?.externalDoorbellService) {
            this.doorbellService = this.doorbellOptions.externalDoorbellService;
            this.doorbellServiceExternallySupplied = true;
        } else {
            this.doorbellService = new Service.Doorbell(this.doorbellOptions?.name ?? "", "");
        }
        this.doorbellService.setPrimaryService();

        const serviceMap = super.constructServices();
        if (!this.doorbellServiceExternallySupplied) {
            serviceMap.doorbell = this.doorbellService;
        }
        return serviceMap;
    }

    initWithServices(serviceMap: CameraControllerServiceMap): void | CameraControllerServiceMap {
        const result = super._initWithServices(serviceMap);

        if (this.doorbellOptions?.externalDoorbellService) {
            this.doorbellService = this.doorbellOptions.externalDoorbellService;
            this.doorbellServiceExternallySupplied = true;

            if (result.serviceMap.doorbell) {
                delete result.serviceMap.doorbell;
                result.updated = true;
            }
        } else {
            this.doorbellService = result.serviceMap.doorbell;

            if (!this.doorbellService) { // see NOTICE above
                this.doorbellService = new Service.Doorbell(this.doorbellOptions?.name ?? "", "");

                result.serviceMap.doorbell = this.doorbellService;
                result.updated = true;
            }
        }

        this.doorbellService.setPrimaryService();

        if (result.updated) {
            return result.serviceMap
        }
    }

    protected migrateFromDoorbell(serviceMap: ControllerServiceMap): boolean {
        return false;
    }

    protected retrieveEventTriggerOptions(): Set<EventTriggerOption> {
        let result = super.retrieveEventTriggerOptions();
        result.add(EventTriggerOption.DOORBELL);
        return result;
    }

    handleControllerRemoved() {
        super.handleControllerRemoved();

        this.doorbellService = undefined;
    }

    configureServices(): void {
        super.configureServices();

        this.doorbellService!.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
          .onGet(() => null); // a value of null represent nothing is pressed

        this.doorbellOptions = undefined;
    }
}
