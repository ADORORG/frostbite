"use client";

import { createRequester, sameOriginFetch } from "@ador/client-http";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { createBalanceStore } from "../client/balance-store.ts";
import type { WalletConnection } from "../client/wallet-session.ts";

// The connected wallet's balance for the menu: asked only while the menu is open (see the store), for the wallet that
// is connected now, and forgotten when it changes.
export function useBalance(input: {
  readonly intervalMs: number;
  readonly open: boolean;
  readonly wallet: WalletConnection;
}) {
  const { intervalMs, open, wallet } = input;
  const store = useMemo(
    () =>
      createBalanceStore({
        intervalMs,
        request: createRequester(sameOriginFetch),
      }),
    [intervalMs],
  );
  const { address, connected, network } = wallet;
  useEffect(() => {
    store.setTarget(connected ? { address, network } : null);
  }, [store, address, connected, network]);
  useEffect(() => {
    store.setOpen(open);
    return () => store.setOpen(false);
  }, [store, open]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot,
  );
  return { ...snapshot, refresh: () => void store.refresh() };
}
