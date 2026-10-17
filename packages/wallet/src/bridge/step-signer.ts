import {
  walletRequests,
  withWalletSignatures,
} from "@ador/chain/wallet-signing";

import type { WalletConnectionClient } from "../client/connection-client.ts";

// A built transaction in the neutral form the platform hands out, and signed in the same form.
export interface StepTransaction {
  readonly chain: string;
  readonly family: string;
  readonly format: string;
  readonly payload: string;
}

// The one family whose transactions a connected wallet signs today. Another family adds its own mapping here, next to this one.
const bitcoinAlkanes = "bitcoin-alkanes";

export class WalletRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletRefusedError";
  }
}

// Has the connected wallet sign a built transaction: it is asked, one PSBT at a time, to sign only the inputs nobody has signed, and
// what it answers is put back into the transaction. Null when this family's transactions are not ones a wallet signs here. The
// platform checks the result against what it built before it sends anything.
export async function signWithWallet(
  wallet: Pick<WalletConnectionClient, "signPsbt">,
  transaction: StepTransaction,
): Promise<StepTransaction | null> {
  if (transaction.family !== bitcoinAlkanes) return null;
  const requests = walletRequests(transaction.format, transaction.payload);
  if (requests === null) return null;
  const answers: string[] = [];
  for (const { inputs, psbt } of requests)
    answers.push(await wallet.signPsbt(psbt, inputs));
  const payload = withWalletSignatures(
    transaction.format,
    transaction.payload,
    answers,
  );
  if (payload === null)
    throw new WalletRefusedError(
      "The wallet's answer did not fit the request.",
    );
  return { ...transaction, payload };
}
