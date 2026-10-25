import { DBusError } from "dbus-native";
import { EventEmitter } from "events";
import { AvahiAdvertiser, CiaoAdvertiser, DBusInvokeError, PairingFeatureFlag, ResolvedAdvertiser, StatusFlag } from "./Advertiser";
import { AccessoryInfo } from "./model/AccessoryInfo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvokeHandler = (msg: any) => unknown;

const mockBuses: { connection: EventEmitter, invoke: jest.Mock }[] = [];
let mockInvokeHandler: InvokeHandler = () => undefined;

jest.mock("dbus-native", () => ({
  ...jest.requireActual("dbus-native"),
  systemBus: () => {
    const connection = Object.assign(new EventEmitter(), { stream: { destroy: jest.fn() } });
    process.nextTick(() => connection.emit("connect"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bus = { connection, invoke: jest.fn(async (msg: any) => mockInvokeHandler(msg)) };
    mockBuses.push(bus);
    return bus;
  },
}));

function dbusError(dbusName: string, message: string): DBusError {
  const error = new DBusError(message);
  error.dbusName = dbusName;
  return error;
}

describe(CiaoAdvertiser, () => {
  describe("ff and sf", () => {
    it("should correctly format pairing feature flags", () => {
      expect(CiaoAdvertiser.ff()).toEqual(0);
      expect(CiaoAdvertiser.ff(PairingFeatureFlag.SUPPORTS_HARDWARE_AUTHENTICATION)).toEqual(1);
      expect(CiaoAdvertiser.ff(PairingFeatureFlag.SUPPORTS_SOFTWARE_AUTHENTICATION)).toEqual(2);
      expect(CiaoAdvertiser.ff(
        PairingFeatureFlag.SUPPORTS_HARDWARE_AUTHENTICATION,
        PairingFeatureFlag.SUPPORTS_SOFTWARE_AUTHENTICATION,
      )).toEqual(3);
    });

    it("should correctly format status flags", () => {
      expect(CiaoAdvertiser.sf()).toEqual(0);

      expect(CiaoAdvertiser.sf(StatusFlag.NOT_PAIRED)).toEqual(1);
      expect(CiaoAdvertiser.sf(StatusFlag.NOT_JOINED_WIFI)).toEqual(2);
      expect(CiaoAdvertiser.sf(StatusFlag.PROBLEM_DETECTED)).toEqual(4);

      expect(CiaoAdvertiser.sf(StatusFlag.NOT_PAIRED, StatusFlag.NOT_JOINED_WIFI)).toEqual(3);
      expect(CiaoAdvertiser.sf(StatusFlag.NOT_PAIRED, StatusFlag.PROBLEM_DETECTED)).toEqual(5);
      expect(CiaoAdvertiser.sf(StatusFlag.NOT_JOINED_WIFI, StatusFlag.PROBLEM_DETECTED)).toEqual(6);

      expect(CiaoAdvertiser.sf(StatusFlag.NOT_PAIRED, StatusFlag.NOT_JOINED_WIFI, StatusFlag.PROBLEM_DETECTED)).toEqual(7);
    });
  });
});

describe(DBusInvokeError, () => {
  it("should take the D-Bus error name from a dbus-native DBusError", () => {
    const error = new DBusInvokeError(dbusError("org.freedesktop.DBus.Error.AccessDenied", "Access denied"));

    expect(error.errorName).toEqual("org.freedesktop.DBus.Error.AccessDenied");
    expect(error.message).toEqual("Access denied");
  });
});

describe("D-Bus advertisers", () => {
  beforeEach(() => {
    mockBuses.length = 0;
    mockInvokeHandler = () => undefined;
  });

  it("should listen for handlerError on every system bus it opens", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      new AvahiAdvertiser(AccessoryInfo.create("AA:BB:CC:DD:EE:FF"));
      new ResolvedAdvertiser(AccessoryInfo.create("AA:BB:CC:DD:EE:FF"));

      expect(mockBuses).toHaveLength(2);
      for (const bus of mockBuses) {
        expect(bus.connection.listenerCount("handlerError")).toEqual(1);
        bus.connection.emit("handlerError", new Error("Rejected send message"));
      }
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Rejected send message"));
    } finally {
      warn.mockRestore();
    }
  });

  it("should read MulticastDNS from systemd-resolved as a plain value", async () => {
    mockInvokeHandler = msg => msg.member === "Get" ? "yes" : undefined;
    await expect(ResolvedAdvertiser.isAvailable()).resolves.toBe(true);

    mockInvokeHandler = msg => msg.member === "Get" ? "no" : undefined;
    await expect(ResolvedAdvertiser.isAvailable()).resolves.toBe(false);
  });

  it("should point at the mDNS wiki when systemd-resolved refuses permission", async () => {
    mockInvokeHandler = () => {
      throw dbusError("org.freedesktop.DBus.Error.AccessDenied", "Access denied");
    };
    const advertiser = new ResolvedAdvertiser(AccessoryInfo.create("AA:BB:CC:DD:EE:FF"));
    advertiser.initPort(51826);

    await expect(advertiser.startAdvertising()).rejects.toThrow("Permissions issue");
  });
});
