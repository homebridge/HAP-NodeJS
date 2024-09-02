import { describe, expect, it } from 'vitest'

import { EventTriggerOption } from '../camera/index.js'
import { createCameraControllerOptions } from './CameraController.spec.js'
import { DoorbellController } from './DoorbellController.js'

describe('doorbellController', () => {
  it('event trigger options', () => {
    const controller = new DoorbellController(createCameraControllerOptions())

    // @ts-expect-error: protected access
    const options = controller.retrieveEventTriggerOptions()
    expect([...options].sort()).toEqual([EventTriggerOption.MOTION, EventTriggerOption.DOORBELL])

    controller.constructServices()
    controller.configureServices()

    expect(controller.recordingManagement).toBeTruthy()
    // @ts-expect-error: private access
    expect(controller.recordingManagement.eventTriggerOptions).toEqual(3)
  })
})
