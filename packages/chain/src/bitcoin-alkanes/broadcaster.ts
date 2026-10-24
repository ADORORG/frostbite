import type {
  BroadcastOutcome,
  ChainRef,
  SignedTransaction,
} from "@ador/shared/chain";

import type { Broadcaster } from "../ports.ts";
import { servedChain, type ServedChain } from "./chains.ts";
import { bundleFormat } from "./admin/bundle.ts";
import { psbtFormat } from "./format.ts";
import { NodeRejectedError, NodeUnavailableError } from "./node/errors.ts";
import { toHex } from "./node/hex.ts";
import { transactionsOf } from "./signed-transactions.ts";

// Messages a node gives when it already has the transaction (Bitcoin Core's mempool and chain rejections for a repeat). Sending
// the same signed transaction twice is then a success, not a failure.
const alreadyKnown =
  /already (?:in (?:block ?chain|the mempool)|known)|txn-already|AlreadyInMempool/iu;

export function createBroadcaster(
  chains: ReadonlyMap<ChainRef, ServedChain>,
): Broadcaster {
  return {
    broadcast: async (signed: SignedTransaction): Promise<BroadcastOutcome> => {
      if (signed.format !== psbtFormat && signed.format !== bundleFormat) {
        return {
          kind: "rejected",
          reason:
            "The signed transaction is not in a format this adapter sends.",
        };
      }
      const transactions = transactionsOf(signed);
      const last = transactions?.[transactions.length - 1];
      if (transactions === null || last === undefined) {
        return {
          kind: "rejected",
          reason: "The signed transaction is not fully signed.",
        };
      }
      const { node } = servedChain(chains, signed.chain);
      // The id is known before anything is sent, so a send that fails halfway can still be followed up by it.
      const ref = { chain: signed.chain, id: last.getId() };
      try {
        for (const transaction of transactions) {
          try {
            await node.broadcast(toHex(transaction.toBuffer()));
          } catch (error) {
            // A transaction the node already has is sent: a repeat of this call, or of half of it, carries on to the next.
            if (
              !(error instanceof NodeRejectedError) ||
              !alreadyKnown.test(error.message)
            ) {
              throw error;
            }
          }
        }
        return { kind: "accepted", ref };
      } catch (error) {
        if (error instanceof NodeRejectedError) {
          return { kind: "rejected", reason: error.message };
        }
        if (error instanceof NodeUnavailableError)
          return { kind: "ambiguous", ref };
        throw error;
      }
    },
  };
}
