import { jsonValueSchema, type JsonValue } from "@ador/shared/chain";

import { NodeRejectedError, NodeUnavailableError } from "./errors.ts";
import { isRecord } from "./json.ts";

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
  readonly json: () => Promise<JsonValue>;
  readonly ok: boolean;
  readonly status: number;
}>;

export interface JsonRpcOptions {
  readonly fetch: FetchLike;
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
          headers: { "content-type": "application/json" },
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
