import { Characteristic } from "../Characteristic";
import { HAPStatus } from "../HAPServer";
import { Service } from "../Service";
import * as tlv from "../util/tlv";
import { AdaptiveLightingController, AdaptiveLightingControllerMode } from "./AdaptiveLightingController";

const EPOCH_MILLIS_2001_01_01 = Date.UTC(2001, 0, 1);
const HOUR = 3600000;

interface CurveEntry {
  temperature: number
  adjustmentFactor: number
  transitionOffset: number
  duration?: number
}

function createController(mode = AdaptiveLightingControllerMode.AUTOMATIC) {
  const lightbulb = new Service.Lightbulb("Light");
  lightbulb.addCharacteristic(Characteristic.ColorTemperature);
  lightbulb.getCharacteristic(Characteristic.Brightness).value = 50;

  const controller = new AdaptiveLightingController(lightbulb, { controllerMode: mode });
  controller.configureServices();

  let iid = 1;
  for (const characteristic of lightbulb.characteristics) {
    characteristic.iid = iid++;
  }

  return { lightbulb, controller };
}

function curve(length: number, temperature = 200): CurveEntry[] {
  return Array.from({ length }, (_, index) => ({
    temperature: temperature + index * 10,
    adjustmentFactor: -0.5,
    transitionOffset: index === 0
      ? 0
      : HOUR,
    duration: 0,
  }));
}

function buildUpdateTransition(lightbulb: Service, startMillis: number, entries: CurveEntry[], updateInterval = 60000): string {
  const startTime = Buffer.alloc(8);
  startTime.writeBigUInt64LE(BigInt(startMillis - EPOCH_MILLIS_2001_01_01));
  const parameters = tlv.encode(0x01, Buffer.alloc(16, 0xAB), 0x02, startTime);

  const transitionEntries = entries.map((entry) => {
    let buffer = tlv.encode(
      0x01, tlv.writeFloat32LE(entry.adjustmentFactor),
      0x02, tlv.writeFloat32LE(entry.temperature),
      0x03, tlv.writeVariableUIntLE(entry.transitionOffset),
    );
    if (entry.duration !== undefined) {
      buffer = Buffer.concat([
        buffer,
        tlv.encode(0x04, tlv.writeVariableUIntLE(entry.duration)),
      ]);
    }
    return buffer;
  });
  const transitionCurve = tlv.encode(
    0x01, transitionEntries,
    0x02, tlv.writeVariableUIntLE(lightbulb.getCharacteristic(Characteristic.Brightness).iid!),
    0x03, tlv.encode(0x01, tlv.writeUInt32(10), 0x02, tlv.writeUInt32(100)),
  );

  const updateIntervalBuffer = Buffer.alloc(2);
  updateIntervalBuffer.writeUInt16LE(updateInterval);
  const notifyIntervalThreshold = Buffer.alloc(4);
  notifyIntervalThreshold.writeUInt32LE(600000);

  const configuration = tlv.encode(
    0x01, tlv.writeVariableUIntLE(lightbulb.getCharacteristic(Characteristic.ColorTemperature).iid!),
    0x02, parameters,
    0x03, 1,
    0x05, transitionCurve,
    0x06, updateIntervalBuffer,
    0x08, notifyIntervalThreshold,
  );

  return tlv.encode(0x02, tlv.encode(0x01, configuration)).toString("base64");
}

async function writeTransitionControl(lightbulb: Service, value: string): Promise<unknown> {
  return lightbulb.getCharacteristic(Characteristic.CharacteristicValueTransitionControl).handleSetRequest(value);
}

describe("adaptiveLightingController", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should stay active when the curve is renewed with a shorter curve", async () => {
    const { lightbulb, controller } = createController();
    const start = Date.now();

    await writeTransitionControl(lightbulb, buildUpdateTransition(lightbulb, start, curve(10)));
    jest.setSystemTime(start + 8.5 * HOUR);
    expect(controller.getCurrentAdaptiveLightingTransitionPoint()).toBeDefined();

    // the home hub renews the schedule with a curve which starts now
    await writeTransitionControl(lightbulb, buildUpdateTransition(lightbulb, Date.now(), curve(5, 300)));

    expect(controller.isAdaptiveLightingActive()).toBeTruthy();
    expect(controller.getCurrentAdaptiveLightingTransitionPoint()?.lowerBound.temperature).toBe(300);
    controller.disableAdaptiveLighting();
  });

  describe("control point errors", () => {
    it("should reject a read for another characteristic without disabling adaptive lighting", async () => {
      const { lightbulb, controller } = createController();
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        await writeTransitionControl(lightbulb, buildUpdateTransition(lightbulb, Date.now(), curve(5)));

        const brightnessIID = lightbulb.getCharacteristic(Characteristic.Brightness).iid!;
        const read = tlv.encode(0x01, tlv.encode(0x01, tlv.writeVariableUIntLE(brightnessIID))).toString("base64");

        await expect(writeTransitionControl(lightbulb, read)).rejects.toBe(HAPStatus.INVALID_VALUE_IN_REQUEST);
        expect(controller.isAdaptiveLightingActive()).toBeTruthy();
      } finally {
        warn.mockRestore();
        controller.disableAdaptiveLighting();
      }
    });

    it("should name the light in the warning and keep the raw value out of it", async () => {
      const { lightbulb } = createController();
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        // an update request which is missing everything but the characteristic iid and the transition flag
        const iid = lightbulb.getCharacteristic(Characteristic.ColorTemperature).iid!;
        const value = tlv.encode(0x02, tlv.encode(0x01, tlv.encode(0x01, tlv.writeVariableUIntLE(iid), 0x03, 1))).toString("base64");

        await expect(writeTransitionControl(lightbulb, value)).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);

        const messages = warn.mock.calls.map(call => String(call[0]));
        expect(messages.length).toBeGreaterThan(0);
        for (const message of messages) {
          expect(message.startsWith("[Light]")).toBeTruthy();
          expect(message).not.toContain(value);
        }
      } finally {
        warn.mockRestore();
      }
    });
  });
});
