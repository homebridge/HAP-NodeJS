import { Characteristic } from "../Characteristic";
import * as tlv from "../util/tlv";
import { RemoteController } from "./RemoteController";

const Operation = {
  LIST: 0x01,
  ADD: 0x02,
  REMOVE: 0x03,
  UPDATE: 0x05,
};

function buttonTLV(buttonId: number, buttonType: number, buttonName?: string): Buffer {
  const buffer = tlv.encode(0x01, buttonId, 0x02, tlv.writeUInt16(buttonType));
  return buttonName
    ? Buffer.concat([
      buffer,
      tlv.encode(0x03, buttonName),
    ])
    : buffer;
}

function targetTLV(identifier: number, name?: string, buttons?: Buffer[]): Buffer {
  const buffers = [
    tlv.encode(0x01, tlv.writeUInt32(identifier)),
  ];
  if (name) {
    buffers.push(tlv.encode(0x02, name), tlv.encode(0x03, tlv.writeUInt16(0x18)));
  }
  if (buttons) {
    buffers.push(tlv.encode(0x04, Buffer.concat(buttons)));
  }
  return Buffer.concat(buffers);
}

function createController(): RemoteController {
  const controller = new RemoteController();
  controller.constructServices();
  controller.configureServices();
  return controller;
}

async function writeTargetControl(controller: RemoteController, operation: number, target?: Buffer): Promise<string> {
  const data = target
    ? tlv.encode(0x01, operation, 0x02, target)
    : tlv.encode(0x01, operation);
  // @ts-expect-error: private access
  const characteristic = controller.targetControlManagementService!.getCharacteristic(Characteristic.TargetControlList);
  return await characteristic.handleSetRequest(data.toString("base64")) as string;
}

function decodeTargetIdentifiers(response: string): number[] {
  const targets = tlv.decodeWithLists(Buffer.from(response, "base64"))[0x02] ?? [];
  return [targets].flat().map(target => tlv.readUInt32(tlv.decode(target)[0x01]));
}

describe("remoteController", () => {
  describe("target configurations", () => {
    it("should return the configured targets in the write response", async () => {
      const controller = createController();

      await writeTargetControl(controller, Operation.ADD, targetTLV(1, "Living Room", [
        buttonTLV(101, 1),
      ]));
      const response = await writeTargetControl(controller, Operation.ADD, targetTLV(2, "Bedroom", [
        buttonTLV(101, 1, "Menu"),
      ]));

      expect(decodeTargetIdentifiers(response)).toEqual([1, 2]);
      expect(decodeTargetIdentifiers(await writeTargetControl(controller, Operation.LIST))).toEqual([1, 2]);
    });

    it("should find a target by its name", async () => {
      const controller = createController();

      await writeTargetControl(controller, Operation.ADD, targetTLV(1, "Living Room", [
        buttonTLV(101, 1),
      ]));
      await writeTargetControl(controller, Operation.ADD, targetTLV(2, "Bedroom", [
        buttonTLV(101, 1),
      ]));

      expect(controller.getTargetIdentifierByName("Bedroom")).toBe(2);
      expect(controller.getTargetIdentifierByName("Kitchen")).toBeUndefined();
    });

    it("should serialize targets even when no target is active", async () => {
      const controller = createController();

      await writeTargetControl(controller, Operation.ADD, targetTLV(1, "Living Room", [
        buttonTLV(101, 1),
      ]));
      controller.setActiveIdentifier(0);

      expect(controller.serialize()?.targetConfigurations[1]?.targetName).toBe("Living Room");
    });
  });
});
