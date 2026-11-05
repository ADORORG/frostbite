import { objectOf } from "./json.ts";
import { jsonValueSchema, type JsonValue } from "@frostbite/shared/chain";

export class BitcoindError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "BitcoindError";
  }
}

// The one Bitcoin Core call the tooling needs: a named JSON-RPC method with parameters, answered by its result.
export interface Bitcoind {
  call(method: string, params?: readonly JsonValue[]): Promise<JsonValue>;
}

export type FetchLike = (
  url: string,
  init: {
    readonly body: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly method: "POST";
  },
) => Promise<{ readonly json: () => Promise<unknown> }>;

export interface BitcoindOptions {
  readonly fetch?: FetchLike;
  readonly password: string;
  readonly url: string;
  readonly user: string;
  // The wallet the call is for, when the node has several.
  readonly wallet?: string;
}

// Bitcoin Core over JSON-RPC with basic authentication. Core answers a failed call with HTTP 500 and an `error` object, which is
// raised as a `BitcoindError` carrying Core's own code (for example -5, "not found").
export function createBitcoind(options: BitcoindOptions): Bitcoind {
  const send: FetchLike =
    options.fetch ?? ((url, init) => fetch(url, { ...init }));
  const url =
    options.wallet === undefined
      ? options.url
      : `${options.url.replace(/\/$/u, "")}/wallet/${options.wallet}`;
  const authorization = `Basic ${Buffer.from(`${options.user}:${options.password}`).toString("base64")}`;
  let nextId = 1;
  return {
    call: async (method, params = []) => {
      const id = nextId;
      nextId += 1;
      const response = await send(url, {
        body: JSON.stringify({ id, jsonrpc: "1.0", method, params }),
        headers: { authorization, "content-type": "application/json" },
        method: "POST",
      });
      const body = jsonValueSchema.parse(await response.json());
      const reply = objectOf(body);
      if (reply === null)
        throw new BitcoindError(-32700, "Bitcoin Core sent no JSON object.");
      const failure = reply["error"];
      if (failure !== null && failure !== undefined) {
        const detail = objectOf(failure);
        const code = detail?.["code"];
        const message = detail?.["message"];
        throw new BitcoindError(
          typeof code === "number" ? code : -1,
          typeof message === "string"
            ? message
            : "Bitcoin Core refused the call.",
        );
      }
      return reply["result"] ?? null;
    },
  };
}
