import { HAPHTTPCode, HAPStatus } from "../HAPServer";

/**
 * Encapsulates a {@link HAPHTTPCode} and a {@link HAPStatus}
 * of a failed http request.
 *
 * @example
 * ```ts
 * throw new HAPHTTPError(HAPHTTPCode.BAD_REQUEST, HAPStatus.INVALID_VALUE_IN_REQUEST);
 * ```
 */
export class HAPHTTPError extends Error {
  public httpStatusCode: HAPHTTPCode;
  public hapStatusCode: HAPStatus;

  constructor(http: HAPHTTPCode, hap: HAPStatus) {
    super("HAP HTTP Error: code: " + http + " status: " + hap);

    Object.setPrototypeOf(this, HAPHTTPError.prototype);

    this.httpStatusCode = http;
    this.hapStatusCode = hap;
  }
}
