import axios, { AxiosError, AxiosResponse } from "axios";
import { Agent } from "http";
import { Accessory } from "./Accessory";
import { HAPPairingHTTPCode, HAPServer, HAPServerEventTypes, HAPStatus, IdentifyCallback, IsKnownHAPStatusError } from "./HAPServer";
import { AccessoryInfo } from "./model/AccessoryInfo";
import { awaitEventOnce } from "./util/promise-utils";

describe("HAPServer", () => {
  let accessoryInfoUnpaired: AccessoryInfo;
  let httpAgent: Agent;
  let server: HAPServer | undefined;

  async function bindServer(server: HAPServer, port = 0, host = "localhost"): Promise<[port: number, string: string]> {
    const listenPromise: Promise<[number, string]> = awaitEventOnce(server, HAPServerEventTypes.LISTENING);
    server.listen(port, host);
    return await listenPromise;
  }

  beforeEach(() => {
    server = undefined;
    accessoryInfoUnpaired = AccessoryInfo.create("AA:AA:AA:AA:AA:AA");
    // @ts-expect-error: private access
    accessoryInfoUnpaired.setupID = Accessory._generateSetupID();
    accessoryInfoUnpaired.displayName = "Outlet";
    accessoryInfoUnpaired.category = 7;
    accessoryInfoUnpaired.pincode = " 031-45-154";

    // used to do long living http connections without own tcp interface
    httpAgent = new Agent({
      keepAlive: true,
    });
  });

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  test("simple unpaired identify", async () => {
    server = new HAPServer(accessoryInfoUnpaired);
    const [port] = await bindServer(server);

    const promise: Promise<IdentifyCallback> = awaitEventOnce(server, HAPServerEventTypes.IDENTIFY);

    const request: Promise<AxiosResponse<string>> = axios.post(`http://localhost:${port}/identify`, { httpAgent });

    const callback = await promise;
    callback(); // signal successful identify!

    const response = await request;
    expect(response.data).toBeFalsy();
  });

  // TODO test pair-setup

  // TODO test pair-verify

  // TODO test not paired pair-very


  test.each(["pairings", "accessories", "characteristics", "prepare", "resource"])(
    "request to \"/%s\" should be rejected in unverified state",
    async (route: string) => {
      const server = new HAPServer(accessoryInfoUnpaired);
      const [port] = await bindServer(server);

      try {
        const response = await axios.post(`http://localhost:${port}/${route}`, { httpAgent });
        fail(`Expected erroneous response, got ${response}`);
      } catch (error) {
        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response?.status).toBe(HAPPairingHTTPCode.CONNECTION_AUTHORIZATION_REQUIRED);
        expect(error.response?.data).toEqual({ status: HAPStatus.INSUFFICIENT_PRIVILEGES });
      }

      server.stop();
    },
  );

  // TODO test for each protected endpoint: access prevented (in paired and unpaired state!)
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
