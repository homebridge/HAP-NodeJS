import { CameraRecordingOptions, EventTriggerOption } from "../camera";
import { Characteristic } from "../Characteristic";
import type { Doorbell } from "../definitions";
import { Service } from "../Service";
import { CameraController, CameraControllerOptions, CameraControllerServiceMap } from "./CameraController";
import { ControllerServiceMap } from "./Controller";

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
export class DoorbellController extends CameraController { // TODO optional name characteristic
    private doorbellService?: Doorbell;

    constructor(options: CameraControllerOptions) {
        super(options);
    }

    /**
     * Call this method to signal a doorbell button press.
     */
    public ringDoorbell() {
        this.doorbellService!.updateCharacteristic(Characteristic.ProgrammableSwitchEvent, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
    }

    constructServices(): CameraControllerServiceMap {
        this.doorbellService = new Service.Doorbell('', '');
        this.doorbellService.setPrimaryService();

        const serviceMap = super.constructServices();
        serviceMap.doorbell = this.doorbellService;
        return serviceMap;
    }

    initWithServices(serviceMap: CameraControllerServiceMap): void | CameraControllerServiceMap {
        const updatedServiceMap = super.initWithServices(serviceMap);

        this.doorbellService = serviceMap.doorbell;
        if (!this.doorbellService) { // see NOTICE above
            this.doorbellService = new Service.Doorbell('', '');
            this.doorbellService.setPrimaryService();

            serviceMap.doorbell = this.doorbellService;
            return serviceMap;
        }

        return updatedServiceMap;
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
    }

}
