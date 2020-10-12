import { HAPStatus } from "../HAPServer";

/**
 * Throws a HAP status error that is sent back to HomeKit.
 * 
 * @example
 * ```ts
 * throw new HapStatusError(HAPStatus.OPERATION_TIMED_OUT);
 * ```
 */
export class HapStatusError extends Error {
  public hapStatus: HAPStatus;

  constructor(status: HAPStatus) {
    super('HAP Status Error: ' + status);

    Object.setPrototypeOf(this, HapStatusError.prototype);

    if (status >= HAPStatus.INSUFFICIENT_PRIVILEGES && status <= HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE) {
      this.hapStatus = status;
    } else {
      this.hapStatus = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
    }
  }
}

