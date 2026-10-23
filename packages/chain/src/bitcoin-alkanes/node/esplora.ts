import type { FeeRate, JsonValue } from "@ador/shared/chain";

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

const hexId = /^[0-9a-f]{64}$/u;

// The Bitcoin side of a node, over Esplora's JSON-RPC names.
export interface EsploraClient {
  // The hash of the block at `height` on the node's best chain: height 0 is the genesis block, which says which chain it is.
  blockHash(height: number): Promise<string>;
  // Sends a signed transaction; the answer is its id.
  broadcast(hex: string): Promise<string>;
  // Fee rate in satoshis per virtual byte for confirmation within `target` blocks (the nearest estimate at or above it).
  feeRate(target: number): Promise<number>;
  // The same for several targets from one look at the fee market.
  feeRates(targets: readonly number[]): Promise<readonly FeeRate[]>;
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

// One look at the node's fee estimates, answered for each target with the nearest estimate at or above it. A target the node has no
// estimate for stops the whole answer: a rate is never guessed.
async function feeRatesFor(
  rpc: JsonRpc,
  targets: readonly number[],
): Promise<readonly FeeRate[]> {
  const estimates = recordOf(
    await rpc.call("esplora_fee-estimates", []),
    "fee estimates",
  );
  const known = Object.entries(estimates)
    .map(([blocks, rate]) => [Number(blocks), rate] as const)
    .filter(
      ([blocks, rate]) =>
        Number.isInteger(blocks) && typeof rate === "number" && rate > 0,
    )
    .sort((a, b) => a[0] - b[0]);
  return targets.map((target) => {
    const choice = known.find(([blocks]) => blocks >= target);
    const rate = choice?.[1];
    if (typeof rate !== "number") {
      throw new NodeUnavailableError(
        "The node has no fee estimate for the target.",
      );
    }
    return { satPerVb: rate, targetBlocks: target };
  });
}

export function createEsploraClient(rpc: JsonRpc): EsploraClient {
  return {
    blockHash: async (height) => {
      const hash = textOf(
        await rpc.call("esplora_block-height", [height]),
        "block hash",
      );
      if (!hexId.test(hash)) {
        throw new NodeUnavailableError(
          "The node's block answer is not a block hash.",
        );
      }
      return hash;
    },
    broadcast: async (hex) => {
      const txid = textOf(
        await rpc.call("esplora_broadcast", [hex]),
        "broadcast answer",
      );
      if (!hexId.test(txid)) {
        throw new NodeUnavailableError(
          "The node's broadcast answer is not a transaction id.",
        );
      }
      return txid;
    },
    feeRate: async (target) => {
      const [only] = await feeRatesFor(rpc, [target]);
      if (only === undefined) {
        throw new NodeUnavailableError(
          "The node has no fee estimate for the target.",
        );
      }
      return only.satPerVb;
    },
    feeRates: (targets) => feeRatesFor(rpc, targets),
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
