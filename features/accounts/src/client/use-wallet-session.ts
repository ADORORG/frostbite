"use client";

import { createRequester, sameOriginFetch } from "@frostbite/client-http";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  createWalletSession,
  type WalletConnection,
  type WalletSession,
  type WalletSessionSnapshot,
} from "./wallet-session.ts";

// The wallet session for a React screen: what it may say now, and what the player can do. The connection library's
// state is handed in on every render; the session keeps the latest and asks the server who is signed in once.
export function useWalletSession(
  connection: WalletConnection,
): WalletSessionSnapshot & { readonly actions: WalletSession } {
  const session = useMemo(
    () => createWalletSession({ request: createRequester(sameOriginFetch) }),
    [],
  );
  useEffect(() => {
    session.setConnection(connection);
  });
  useEffect(() => {
    void session.refresh();
  }, [session]);
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  return { ...snapshot, actions: session };
}
