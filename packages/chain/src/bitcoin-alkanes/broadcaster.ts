import { Psbt, type Transaction } from "bitcoinjs-lib";
import type {
  BroadcastOutcome,
  ChainRef,
  SignedTransaction,
} from "@ador/shared/chain";

import type { Broadcaster } from "../ports.ts";
import { servedChain, type ServedChain } from "./chains.ts";
import { bundleFormat, decodeBundle } from "./admin/bundle.ts";
import { psbtFormat } from "./format.ts";
import { NodeRejectedError, NodeUnavailableError } from "./node/errors.ts";
import { toHex } from "./node/hex.ts";

// Messages a node gives when it already has the transaction (Bitcoin Core's mempool and chain rejections for a repeat). Sending
// the same signed transaction twice is then a success, not a failure.
const alreadyKnown =
  /already (?:in (?:block ?chain|the mempool)|known)|txn-already|AlreadyInMempool/iu;

function finalTransaction(psbt: Psbt) {
  try {
    if (
      psbt.data.inputs.some(
        (input) =>
          input.finalScriptWitness === undefined &&
          input.finalScriptSig === undefined,
      )
    ) {
      psbt.finalizeAllInputs();
    }
    return psbt.extractTransaction();
  } catch {
    return null;
  }
}

// The transactions a signed payload holds, in the order they must be sent (a commit before its reveal); null if any is not fully
// signed. The last one is the transaction a caller follows.
function transactionsOf(signed: SignedTransaction): Transaction[] | null {
  const psbts =
    signed.format === bundleFormat
      ? decodeBundle(signed.payload)
      : parsePsbt(signed.payload);
  if (psbts === null) return null;
  const list = psbts instanceof Psbt ? [psbts] : [psbts.commit, psbts.reveal];
  const transactions = list.map(finalTransaction);
  return transactions.every((transaction) => transaction !== null)
    ? transactions
    : null;
}

function parsePsbt(payload: string): Psbt | null {
  try {
    return Psbt.fromBase64(payload);
  } catch {
    return null;
  }
}

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
