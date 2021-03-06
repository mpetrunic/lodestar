import {LodestarError} from "@chainsafe/lodestar-utils";

export enum AttesterSlashingErrorCode {
  SLASHING_ALREADY_EXISTS = "ATTESTATION_SLASHING_ERROR_SLASHING_ALREADY_EXISTS",
  INVALID_SLASHING = "ATTESTATION_SLASHING_ERROR_INVALID_SLASHING",
}
export type AttesterSlashingErrorType =
  | {code: AttesterSlashingErrorCode.SLASHING_ALREADY_EXISTS}
  | {code: AttesterSlashingErrorCode.INVALID_SLASHING};

export class AttesterSlashingError extends LodestarError<AttesterSlashingErrorType> {
  constructor(type: AttesterSlashingErrorType) {
    super(type);
  }
}
