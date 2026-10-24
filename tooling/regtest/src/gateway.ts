import type { JsonValue } from "@ador/shared/chain";

import { objectOf } from "./json.ts";
import { BitcoindError, type Bitcoind } from "./bitcoind.ts";

// The platform reads a chain through one JSON-RPC URL that answers Esplora's names (the Bitcoin side) and Metashrew's (the Alkanes
// indexer). On regtest there is no such public endpoint, so this answers the same names from a local Bitcoin Core and a local
// indexer. It answers only what the platform asks for (`packages/chain/src/bitcoin-alkanes/node`), and says so for anything else.
export class GatewayError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "GatewayError";
  }
}

export interface GatewayDependencies {
  readonly bitcoin: Bitcoind;
  // Fee rates in satoshis per virtual byte by confirmation target, as Esplora answers them. Regtest has no fee market, so they are
  // given, not estimated.
  readonly feeEstimates: Readonly<Record<string, number>>;
  // The indexer's own JSON-RPC (Metashrew), asked with the method and parameters unchanged.
  readonly indexer: (
    method: string,
    params: readonly JsonValue[],
  ) => Promise<JsonValue>;
}

export type Gateway = (
  method: string,
  params: readonly JsonValue[],
) => Promise<JsonValue>;

const satoshisPerBitcoin = 100_000_000;
// Bitcoin Core's code for "no such transaction".
const notFound = -5;

function record(value: JsonValue | undefined): Record<string, JsonValue> {
  const found = objectOf(value);
  if (found === null)
    throw new GatewayError(
      -32603,
      "Bitcoin Core answered something else than an object.",
    );
  return { ...found };
}

function list(value: JsonValue | undefined): JsonValue[] {
  if (!Array.isArray(value))
    throw new GatewayError(
      -32603,
      "Bitcoin Core answered something else than a list.",
    );
  return value;
}

function text(value: JsonValue | undefined, what: string): string {
  if (typeof value !== "string" || value === "")
    throw new GatewayError(-32602, `${what} must be text.`);
  return value;
}

function whole(value: JsonValue | undefined, what: string): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new GatewayError(-32603, `${what} is not a whole number.`);
  return value;
}

export function createGateway(dependencies: GatewayDependencies): Gateway {
  const { bitcoin, feeEstimates, indexer } = dependencies;

  // The transaction as Esplora shows it: its outputs and where it was confirmed. One Core does not know is answered with plain
  // text, which is how Esplora answers too.
  async function transaction(txid: string): Promise<JsonValue> {
    let raw: Record<string, JsonValue>;
    try {
      raw = record(await bitcoin.call("getrawtransaction", [txid, true]));
    } catch (error) {
      if (error instanceof BitcoindError && error.code === notFound)
        return "Transaction not found";
      throw error;
    }
    const blockHash = raw["blockhash"];
    const status: Record<string, JsonValue> =
      typeof blockHash === "string"
        ? {
            block_hash: blockHash,
            block_height: whole(
              record(await bitcoin.call("getblockheader", [blockHash]))[
                "height"
              ],
              "block height",
            ),
            confirmed: true,
          }
        : { confirmed: false };
    return { status, txid, vout: list(raw["vout"]) };
  }

  // The unspent outputs of an address that are in a block. (Core scans its set of unspent outputs; an output still in the mempool
  // is not in it, so a flow that spends a fresh output mines first.)
  async function unspent(address: string): Promise<JsonValue> {
    const scan = record(
      await bitcoin.call("scantxoutset", ["start", [`addr(${address})`]]),
    );
    return list(scan["unspents"]).map((entry) => {
      const found = record(entry);
      const amount = found["amount"];
      if (typeof amount !== "number")
        throw new GatewayError(-32603, "An unspent output has no amount.");
      return {
        status: {
          block_height: whole(found["height"], "output height"),
          confirmed: true,
        },
        txid: text(found["txid"], "output id"),
        value: Math.round(amount * satoshisPerBitcoin),
        vout: whole(found["vout"], "output index"),
      };
    });
  }

  // The local indexer answers a view asked "at latest" with nothing for what was indexed recently (the hosted ones answer it
  // properly), so a view is asked at the height the indexer has reached, which it answers.
  async function atIndexedHeight(
    params: readonly JsonValue[],
  ): Promise<readonly JsonValue[]> {
    if (params[2] !== "latest") return params;
    return [
      params[0] ?? null,
      params[1] ?? null,
      Number(await indexer("metashrew_height", [])),
    ];
  }

  return async (method, params) => {
    switch (method) {
      case "esplora_blocks:tip:height":
        return bitcoin.call("getblockcount");
      case "esplora_blocks:tip:hash":
        return bitcoin.call("getbestblockhash");
      case "esplora_fee-estimates":
        return { ...feeEstimates };
      case "sendrawtransaction":
        return bitcoin.call("sendrawtransaction", [
          text(params[0], "The transaction"),
        ]);
      case "esplora_tx":
        return transaction(text(params[0], "The transaction id"));
      case "esplora_address::utxo":
        return unspent(text(params[0], "The address"));
      case "metashrew_height":
        // The indexer answers a number; the platform reads the height as text, as the public endpoint gives it.
        return String(await indexer(method, params));
      case "metashrew_view":
        return indexer(method, await atIndexedHeight(params));
      default:
        throw new GatewayError(
          -32601,
          `The gateway does not answer ${method}.`,
        );
    }
  };
}
