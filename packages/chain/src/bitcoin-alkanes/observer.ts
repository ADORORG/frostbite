import type { ChainRef, Observation, TransactionRef } from "@ador/shared/chain";

import type { ChainObserver } from "../ports.ts";
import { formatAlkaneId } from "./node/alkane-id.ts";
import { servedChain, type ServedChain } from "./chains.ts";
import type { TransactionOptions } from "./options.ts";

// Where the protostone of a claim sits: after every real output and the one that carries it (output index = number of outputs + 1).
function protostoneOutput(outputs: number): number {
  return outputs + 1;
}

// Watches a transaction on both layers. Bitcoin says whether it is in a block; the Alkanes indexer says whether the call it made
// ran. A transaction in a block the indexer has not reached is still pending, and one the indexer ran but could not execute has
// reverted, so "confirmed" is only ever said of a claim that really happened.
export function createObserver(
  chains: ReadonlyMap<ChainRef, ServedChain>,
  options: Pick<TransactionOptions, "now" | "providerId">,
): ChainObserver {
  return {
    observe: async (ref: TransactionRef): Promise<Observation> => {
      const { node } = servedChain(chains, ref.chain);
      const observedAt = options.now().toISOString();
      const base = { observedAt, provider: options.providerId, ref };
      const transaction = await node.transaction(ref.id);
      if (transaction === null)
        return { ...base, confirmations: 0, status: "not-found" };
      // A transaction in no block has no block hash or height.
      if (transaction.blockHash === null || transaction.blockHeight === null) {
        return { ...base, confirmations: 0, status: "pending" };
      }
      const { blockHash, blockHeight } = transaction;
      const block = { chain: ref.chain, hash: blockHash, height: blockHeight };
      const [tip, indexed] = await Promise.all([
        node.tip(),
        node.indexedHeight(),
      ]);
      const confirmations = Math.max(1, tip.height - blockHeight + 1);
      if (indexed < blockHeight)
        return { ...base, block, confirmations, status: "pending" };
      const { created, outcome } = await node.trace(
        ref.id,
        protostoneOutput(transaction.outputs),
      );
      return {
        ...base,
        block,
        confirmations,
        ...(outcome === "success" && created.length > 0
          ? { created: created.map(formatAlkaneId) }
          : {}),
        status: outcome === "success" ? "confirmed" : "reverted",
      };
    },
  };
}
