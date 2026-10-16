// Why a transaction could not be built, as a code the caller can act on.
export class BuildRefusedError extends Error {
  constructor(
    readonly code:
      | "fee-above-limit"
      | "insufficient-funds"
      | "invalid-request"
      | "unsupported-operation",
    message: string,
  ) {
    super(message);
    this.name = "BuildRefusedError";
  }
}
