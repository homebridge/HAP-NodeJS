import { EventTriggerOption } from "../camera";
import { createCameraControllerOptions } from "./CameraController.spec";
import { DoorbellController } from "./DoorbellController";

describe("DoorbellController", () => {
  test("event trigger options", () => {
    const controller = new DoorbellController(createCameraControllerOptions());

    // @ts-expect-error: protected access
    const options = controller.retrieveEventTriggerOptions();
    expect(new Array(...options).sort()).toEqual([EventTriggerOption.MOTION, EventTriggerOption.DOORBELL]);

    controller.constructServices();
    controller.configureServices();

    expect(controller.recordingManagement).toBeTruthy();
    // @ts-expect-error: private access
    expect(controller.recordingManagement.eventTriggerOptions).toEqual(3);
  });
});
