import axios, { AxiosResponse } from "axios";
import { Agent } from "http";
import { Accessory } from "./Accessory";
import { HAPServer, HAPServerEventTypes, HAPStatus, IdentifyCallback, IsKnownHAPStatusError } from "./HAPServer";
import { AccessoryInfo } from "./model/AccessoryInfo";
import { awaitEventOnce } from "./util/promise-utils";

describe("HAPServer", () => {
  let accessoryInfo: AccessoryInfo;
  let httpAgent: Agent;

  beforeEach(() => {
    accessoryInfo = AccessoryInfo.create("AA:AA:AA:AA:AA:AA");
    // @ts-expect-error: private access
    accessoryInfo.setupID = Accessory._generateSetupID();
    accessoryInfo.displayName = "Outlet";
    accessoryInfo.category = 7;
    accessoryInfo.pincode = " 031-45-154";

    // used to do long living http connections without own tcp interface
    httpAgent = new Agent({
      keepAlive: true,
    });
  });

  describe(IsKnownHAPStatusError, () => {
    it("should approve all defined error codes", () => {
      // @ts-expect-error: forceConsistentCasingInFileNames compiler option
      const errorValues = Object.values(HAPStatus)
        .filter(error => typeof error === "number") // .values will actually include both the enum values and enum names
        .filter(error => error !== 0); // filter out HAPStatus.SUCCESS

      for (const error of errorValues) {
        // @ts-expect-error: type mismatch
        const result = IsKnownHAPStatusError(error);
        if (!result) {
          fail("IsKnownHAPStatusError does not return true for error code " + error);
        }
      }
    });

    it("should reject non defined error codes", () => {
      expect(IsKnownHAPStatusError(23)).toBe(false);
      expect(IsKnownHAPStatusError(-3)).toBe(false);
      expect(IsKnownHAPStatusError(-72037)).toBe(false);
      expect(IsKnownHAPStatusError(HAPStatus.SUCCESS)).toBe(false);
    });

    it("should reject invalid user input", () => {
      // @ts-expect-error: deliberate illegal input
      expect(IsKnownHAPStatusError("asdjw")).toBe(false);
      // @ts-expect-error: deliberate illegal input
      expect(IsKnownHAPStatusError({ "key": "value" })).toBe(false);
      // @ts-expect-error: deliberate illegal input
      expect(IsKnownHAPStatusError([])).toBe(false);
    });
  });

  test("simple unpaired identify", async () => {
    const server = new HAPServer(accessoryInfo);

    const listenPromise: Promise<[number, string]> = awaitEventOnce(server, HAPServerEventTypes.LISTENING);
    server.listen();
    const [port] = await listenPromise;

    const promise: Promise<IdentifyCallback> = awaitEventOnce(server, HAPServerEventTypes.IDENTIFY);

    const request: Promise<AxiosResponse<string>> = axios.post(`http://localhost:${port}/identify`, { httpAgent });

    const callback = await promise;
    callback(); // signal successful identify!

    const response = await request;
    expect(response.data).toBeFalsy();

    server.stop();
  });
});
