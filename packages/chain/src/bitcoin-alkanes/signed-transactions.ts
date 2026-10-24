import { Psbt, type Transaction } from "bitcoinjs-lib";
import type { SignedTransaction } from "@ador/shared/chain";

import type { TransactionPart } from "../ports.ts";

import { bundleFormat, decodeBundle } from "./admin/bundle.ts";

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
export function transactionsOf(
  signed: SignedTransaction,
): Transaction[] | null {
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

// The ids of those transactions for a person to follow, named by what each does: a pair is the commit and the reveal, a single one is
// just the transaction. Empty for a payload that is not fully signed.
export function transactionParts(
  signed: SignedTransaction,
): readonly TransactionPart[] {
  const transactions = transactionsOf(signed) ?? [];
  const roles =
    signed.format === bundleFormat
      ? (["commit", "reveal"] as const)
      : (["transaction"] as const);
  return transactions.flatMap((transaction, index) => {
    const role = roles[index];
    return role === undefined ? [] : [{ id: transaction.getId(), role }];
  });
}
