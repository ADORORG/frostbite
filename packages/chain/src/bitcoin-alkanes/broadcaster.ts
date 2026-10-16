import { Psbt } from "bitcoinjs-lib";
import type {
  BroadcastOutcome,
  ChainRef,
  SignedTransaction,
} from "@ador/shared/chain";

import type { Broadcaster } from "../ports.ts";
import { servedChain, type ServedChain } from "./chains.ts";
import { psbtFormat } from "./format.ts";
import { NodeRejectedError, NodeUnavailableError } from "./node/errors.ts";
import { toHex } from "./node/hex.ts";

// Messages a node gives when it already has the transaction (Bitcoin Core's mempool and chain rejections for a repeat). Sending
// the same signed transaction twice is then a success, not a failure.
const alreadyKnown =
  /already (?:in (?:block ?chain|the mempool)|known)|txn-already|AlreadyInMempool/iu;

function finalTransaction(payload: string) {
  try {
    const psbt = Psbt.fromBase64(payload);
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

export function createBroadcaster(
  chains: ReadonlyMap<ChainRef, ServedChain>,
): Broadcaster {
  return {
    broadcast: async (signed: SignedTransaction): Promise<BroadcastOutcome> => {
      if (signed.format !== psbtFormat) {
        return {
          kind: "rejected",
          reason:
            "The signed transaction is not in a format this adapter sends.",
        };
      }
      const transaction = finalTransaction(signed.payload);
      if (transaction === null) {
        return {
          kind: "rejected",
          reason: "The signed transaction is not fully signed.",
        };
      }
      const { node } = servedChain(chains, signed.chain);
      // The id is known before anything is sent, so a send that fails halfway can still be followed up by it.
      const ref = { chain: signed.chain, id: transaction.getId() };
      try {
        await node.broadcast(toHex(transaction.toBuffer()));
        return { kind: "accepted", ref };
      } catch (error) {
        if (error instanceof NodeRejectedError) {
          return alreadyKnown.test(error.message)
            ? { kind: "accepted", ref }
            : { kind: "rejected", reason: error.message };
        }
        if (error instanceof NodeUnavailableError)
          return { kind: "ambiguous", ref };
        throw error;
      }
    },
  };
}
