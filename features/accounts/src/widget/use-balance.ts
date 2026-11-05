"use client";

import { createExpiringStore } from "@frostbite/cache/expiring-store";
import { createRequester, sameOriginFetch } from "@frostbite/client-http";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { balanceReadingSchema } from "../balance/contract.ts";
import { createBalanceStore } from "../client/balance-store.ts";
import type { WalletConnection } from "../client/wallet-session.ts";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Whether the tab is showing, so a balance is not asked for in a background tab.
function usePageVisible(): boolean {
  // Read at the start, so a tab opened in the background asks for nothing before the first change is noticed. It decides when to
  // ask, never what is drawn, so the server and the first client render agree.
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

// The connected wallet's balance for the header: asked while a wallet is connected and the tab is showing (see the store), for the
// wallet that is connected now, and forgotten when it changes.
export function useBalance(input: {
  readonly intervalMs: number;
  readonly wallet: WalletConnection;
}) {
  const { intervalMs, wallet } = input;
  const visible = usePageVisible();
  const store = useMemo(
    () =>
      createBalanceStore({
        cache: createExpiringStore({
          maxAgeMs: intervalMs,
          now: () => new Date(),
          prefix: "frostbite:balance",
          schema: balanceReadingSchema,
          // Storage is the browser's: absent while rendering on the server, and possibly refused (a private window, blocked data).
          storage: browserStorage(),
        }),
        intervalMs,
        request: createRequester(sameOriginFetch),
      }),
    [intervalMs],
  );
  const { address, connected, network } = wallet;
  useEffect(() => {
    store.setTarget(connected ? { address, network } : null);
  }, [store, address, connected, network]);
  const active = wallet.connected && visible;
  useEffect(() => {
    store.setOpen(active);
    return () => store.setOpen(false);
  }, [store, active]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot,
  );
  return { ...snapshot, refresh: () => void store.refresh() };
}
