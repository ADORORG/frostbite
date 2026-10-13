import type { ErrorCode } from "./protocol.ts";

// A call the host refuses, with the protocol's code for why. Thrown inside a handler and turned into the answer.
export class Refusal extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
