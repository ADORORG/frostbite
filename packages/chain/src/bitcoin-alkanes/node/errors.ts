// The node cannot be reached, answered too slowly, or answered something that is not JSON-RPC.
export class NodeUnavailableError extends Error {
  readonly code = "node-unavailable";
  constructor(message: string) {
    super(message);
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
