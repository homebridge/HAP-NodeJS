import { TLVErrorCode } from "../lib/HAPServer";

/**
 * Encapsulates a {@link TLVErrorCode} in an error object.
 *
 * @example
 * ```ts
 * throw new TLVError(TLVErrorCode.INVALID_REQUEST);
 * ```
 */
export class TLVError extends Error {
  public errorCode: TLVErrorCode;

  constructor(errorCode: TLVErrorCode) {
    super("TLV Error Code: " + errorCode);

    Object.setPrototypeOf(this, TLVError.prototype);

    this.errorCode = errorCode;
  }
}
