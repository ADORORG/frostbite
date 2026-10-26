import { jsonValueSchema, type JsonValue } from "@ador/shared/chain";

import { NodeRejectedError, NodeUnavailableError } from "./errors.ts";
import { isRecord } from "./json.ts";

// How the gateway says its indexer is behind the chain: "metashrew: no backend in sync (served 327982, chain tip 328088): ...".
const indexBehind = /no backend in sync \(served (\d+), chain tip (\d+)\)/u;

export interface JsonRpc {
  call(method: string, params: readonly JsonValue[]): Promise<JsonValue>;
}

// Just what the transport needs of `fetch`, so tests and other runtimes can supply their own.
export type FetchLike = (
  url: string,
  init: {
    readonly body: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly method: "POST";
    readonly signal: AbortSignal;
  },
) => Promise<{
  // `unknown` is what a response body is; `createJsonRpc` validates it as JSON before anything reads it.
  readonly json: () => Promise<unknown>;
  readonly ok: boolean;
  readonly status: number;
}>;

export interface JsonRpcOptions {
  readonly fetch: FetchLike;
  // Sent with every call, for a gateway that wants a key in a header. `content-type` is always the transport's own.
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly url: string;
}

export function createJsonRpc(options: JsonRpcOptions): JsonRpc {
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error(
      "The node timeout must be a positive whole number of milliseconds.",
    );
  }
  let nextId = 1;
  return {
    call: async (method, params) => {
      const id = nextId;
      nextId += 1;
      let body: JsonValue;
      try {
        const response = await options.fetch(options.url, {
          body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
          headers: { ...options.headers, "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (!response.ok) {
          throw new NodeUnavailableError(
            `The node answered HTTP ${response.status}.`,
          );
        }
        body = jsonValueSchema.parse(await response.json());
      } catch (error) {
        if (error instanceof NodeUnavailableError) throw error;
        throw new NodeUnavailableError(
          `The node could not be reached for ${method}.`,
        );
      }
      if (!isRecord(body) || body["id"] !== id) {
        throw new NodeUnavailableError(
          "The node's answer is not a JSON-RPC response.",
        );
      }
      const failure = body["error"];
      if (failure !== undefined) {
        const message = isRecord(failure) ? failure["message"] : undefined;
        const behind =
          typeof message === "string" ? indexBehind.exec(message) : null;
        if (behind !== null) {
          // Not a refusal of the request: the gateway has no index that has read the chain to its tip, so nothing that needs the index
          // can be answered until one has. Said as what it is, with how far behind it is.
          throw new NodeUnavailableError(
            `The network's Alkanes index is behind the chain (it has read to block ${behind[1] ?? "?"}; the chain is at ${behind[2] ?? "?"}). It clears when the index catches up.`,
            "behind",
          );
        }
        throw new NodeRejectedError(
          typeof message === "string" ? message : `The node refused ${method}.`,
        );
      }
      const result = body["result"];
      if (result === undefined) {
        throw new NodeUnavailableError("The node's answer has no result.");
      }
      return result;
    },
  };
}
