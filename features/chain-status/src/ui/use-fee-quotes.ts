"use client";

import type { ChainFees } from "@frostbite/shared/chain";
import { useMemo } from "react";

import { holdReading, type StatusPolling } from "../domain/freshness.ts";
import { createChainStatusApi, type ChainStatusApi } from "../client/api.ts";
import { usePolled } from "./use-polled.ts";

// What the page knows of the fee market: still loading, or the platform's answer (no chain, the chain could not be asked, or the
// quotes), or that the platform itself could not be reached. Asked when the page opens and then every `refreshMs` while the tab shows.
export type FeeMarket =
  | { readonly status: "loading" }
  | { readonly status: "unreachable" }
  // `stale`: the answer is the last good one, which the platform could not renew.
  | {
      readonly fees: ChainFees;
      readonly stale: boolean;
      readonly status: "answered";
    };

export function useFeeQuotes(options: {
  readonly api?: ChainStatusApi;
  readonly now?: () => number;
  readonly polling: StatusPolling;
}): FeeMarket {
  const { api: given, now = Date.now, polling } = options;
  const api = useMemo(() => given ?? createChainStatusApi(), [given]);
  const held = holdReading(
    usePolled((signal) => api.fees(signal), "fees", polling.refreshMs),
    (fees) => (fees.state === "ok" ? fees.observedAt : null),
    now(),
    polling,
  );
  return held.status === "held"
    ? { fees: held.data, stale: held.stale, status: "answered" }
    : held;
}
