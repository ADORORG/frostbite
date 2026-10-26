import { ChainUnavailableError } from "../../ports.ts";

// The node cannot be reached, answered too slowly, answered something that is not JSON-RPC, or reads the chain through an index that
// is behind it (`reason: "behind"`).
export class NodeUnavailableError extends ChainUnavailableError {
  readonly code = "node-unavailable";
  constructor(
    message: string,
    reason: "behind" | "unreachable" = "unreachable",
  ) {
    super(message, reason);
    this.name = "NodeUnavailableError";
  }
}

// The node understood the request and refused it.
export class NodeRejectedError extends Error {
  readonly code = "node-rejected";
  constructor(message: string) {
    super(message);
    this.name = "NodeRejectedError";
  }
}
