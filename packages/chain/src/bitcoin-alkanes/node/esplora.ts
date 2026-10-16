import type { JsonValue } from "@ador/shared/chain";

import { NodeUnavailableError } from "./errors.ts";
import { isRecord, listOf, recordOf, textOf, wholeNumberOf } from "./json.ts";
import type { JsonRpc } from "./transport.ts";

export interface NodeUtxo {
  readonly confirmed: boolean;
  readonly txid: string;
  readonly value: bigint;
  readonly vout: number;
}

export interface NodeTransaction {
  readonly blockHash: string | null;
  readonly blockHeight: number | null;
  readonly confirmed: boolean;
  readonly outputs: number;
}

export interface ChainTip {
  readonly hash: string;
  readonly height: number;
}

const hexTxid = /^[0-9a-f]{64}$/u;

// The Bitcoin side of a node, over Esplora's JSON-RPC names.
export interface EsploraClient {
  // Sends a signed transaction; the answer is its id.
  broadcast(hex: string): Promise<string>;
  // Fee rate in satoshis per virtual byte for confirmation within `target` blocks (the nearest estimate at or above it).
  feeRate(target: number): Promise<number>;
  // The transaction as the node sees it, or null when it has never heard of it.
  transaction(txid: string): Promise<NodeTransaction | null>;
  tip(): Promise<ChainTip>;
  utxos(address: string): Promise<readonly NodeUtxo[]>;
}

function utxoOf(value: JsonValue): NodeUtxo {
  const entry = recordOf(value, "unspent output");
  const status = recordOf(entry["status"] ?? null, "unspent output status");
  if (typeof status["confirmed"] !== "boolean") {
    throw new NodeUnavailableError("The node's unspent output has no status.");
  }
  return {
    confirmed: status["confirmed"],
    txid: textOf(entry["txid"], "unspent output id"),
    value: BigInt(wholeNumberOf(entry["value"], "unspent output value")),
    vout: wholeNumberOf(entry["vout"], "unspent output index"),
  };
}

export function createEsploraClient(rpc: JsonRpc): EsploraClient {
  return {
    broadcast: async (hex) => {
      const txid = textOf(
        await rpc.call("esplora_broadcast", [hex]),
        "broadcast answer",
      );
      if (!hexTxid.test(txid)) {
        throw new NodeUnavailableError(
          "The node's broadcast answer is not a transaction id.",
        );
      }
      return txid;
    },
    feeRate: async (target) => {
      const estimates = recordOf(
        await rpc.call("esplora_fee-estimates", []),
        "fee estimates",
      );
      const choice = Object.entries(estimates)
        .map(([blocks, rate]) => [Number(blocks), rate] as const)
        .filter(
          ([blocks, rate]) =>
            blocks >= target && typeof rate === "number" && rate > 0,
        )
        .sort((a, b) => a[0] - b[0])[0];
      const rate = choice?.[1];
      if (typeof rate !== "number") {
        throw new NodeUnavailableError(
          "The node has no fee estimate for the target.",
        );
      }
      return rate;
    },
    // A transaction the node does not know is answered with plain text, not an error.
    transaction: async (txid) => {
      const answer = await rpc.call("esplora_tx", [txid]);
      if (!isRecord(answer)) return null;
      const status = recordOf(answer["status"] ?? null, "transaction status");
      const confirmed = status["confirmed"] === true;
      return {
        blockHash: confirmed
          ? textOf(status["block_hash"], "block hash")
          : null,
        blockHeight: confirmed
          ? wholeNumberOf(status["block_height"], "block height")
          : null,
        confirmed,
        outputs: listOf(answer["vout"] ?? null, "transaction outputs").length,
      };
    },
    tip: async () => ({
      hash: textOf(await rpc.call("esplora_blocks:tip:hash", []), "tip hash"),
      height: wholeNumberOf(
        await rpc.call("esplora_blocks:tip:height", []),
        "tip height",
      ),
    }),
    utxos: async (address) =>
      listOf(
        await rpc.call("esplora_address::utxo", [address]),
        "unspent outputs",
      ).map(utxoOf),
  };
}
