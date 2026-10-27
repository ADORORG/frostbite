"use client";

import { useMemo } from "react";

import { createChainStatusApi, type ChainStatusApi } from "../client/api.ts";
import { holdReading, type StatusPolling } from "../domain/freshness.ts";
import { NetworkPill } from "./network-pill.tsx";
import { usePolled } from "./use-polled.ts";
import { useFeeQuotes } from "./use-fee-quotes.ts";

// The lamp in the header: asks the platform how far the chain's indexer has read when the page opens and then every `polling.refreshMs`
// (not while the tab is hidden). Draws nothing until the first answer, so a page never flashes a state it does not know. When a later
// ask fails it keeps showing the last answer, marked as not renewed, until that is too old to be of use, and then says it does not know.
export function IndexingBadge({
  api: given,
  now = Date.now,
  polling,
  syncWindowBlocks,
}: {
  // Where the status comes from; the platform's own route unless a test supplies another.
  readonly api?: ChainStatusApi;
  readonly now?: () => number;
  readonly polling: StatusPolling;
  readonly syncWindowBlocks: number;
}) {
  const api = useMemo(() => given ?? createChainStatusApi(), [given]);
  const held = holdReading(
    usePolled((signal) => api.indexing(signal), "indexing", polling.refreshMs),
    (indexing) => (indexing.state === "ok" ? indexing.observedAt : null),
    now(),
    polling,
  );
  const market = useFeeQuotes({ api, now, polling });
  if (held.status === "loading") return null;
  return (
    <NetworkPill
      indexing={held.status === "held" ? held.data : null}
      indexingStale={held.status === "held" && held.stale}
      market={market}
      syncWindowBlocks={syncWindowBlocks}
    />
  );
}
