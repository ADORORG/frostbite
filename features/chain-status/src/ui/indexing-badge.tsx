"use client";

import { useResource } from "@ador/client-react";
import { useEffect, useMemo } from "react";

import { createChainStatusApi, type ChainStatusApi } from "../client/api.ts";
import { ChainStatusPanel } from "./chain-status-panel.tsx";
import { IndexingLamp } from "./indexing-lamp.tsx";
import { useFeeQuotes } from "./use-fee-quotes.ts";

// The lamp in the header: asks the platform how far the chain's indexer has read when the page opens and then every `refreshMs`
// (not while the tab is hidden). Draws nothing until the first answer, so a page never flashes a state it does not know. When a later
// ask fails it keeps showing the last answer's age honestly by saying the status is unknown.
export function IndexingBadge({
  api: given,
  exampleVbytes,
  refreshMs,
}: {
  // Where the status comes from; the platform's own route unless a test supplies another.
  readonly api?: ChainStatusApi;
  // The size of an everyday transaction, for the example cost in the fee panel.
  readonly exampleVbytes: number;
  readonly refreshMs: number;
}) {
  const api = useMemo(() => given ?? createChainStatusApi(), [given]);
  const { reload, state } = useResource(
    (signal) => api.indexing(signal),
    "indexing",
    () => "unreachable" as const,
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) reload();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [reload, refreshMs]);
  const market = useFeeQuotes({ api, refreshMs });
  if (state.status === "loading") return null;
  return (
    <div className="chain-status-bar">
      <IndexingLamp indexing={state.status === "ready" ? state.data : null} />
      <ChainStatusPanel exampleVbytes={exampleVbytes} market={market} />
    </div>
  );
}
