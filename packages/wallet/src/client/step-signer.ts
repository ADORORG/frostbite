"use client";

import { useMemo } from "react";

import { signWithWallet, type StepTransaction } from "../bridge/step-signer.ts";
import { useWalletConnection } from "./provider.tsx";

export interface StepWallet {
  // The connected wallet's address, or empty while none is.
  readonly address: string;
  // Present only while a wallet of an allowed kind is connected.
  readonly sign:
    | ((transaction: StepTransaction) => Promise<StepTransaction | null>)
    | undefined;
}

// The connected wallet as a signer of platform transactions, if it is one of the wallets the deployment allows for it (a policy
// list, not a guess about what a wallet can do).
export function useStepWallet(allowed: readonly string[]): StepWallet {
  const connection = useWalletConnection();
  const { address, connected, provider } = connection;
  const permitted =
    connected && provider !== null && allowed.includes(provider);
  return useMemo(
    () => ({
      address: connected ? address : "",
      sign: permitted
        ? (transaction) => signWithWallet(connection, transaction)
        : undefined,
    }),
    [address, connected, connection, permitted],
  );
}
