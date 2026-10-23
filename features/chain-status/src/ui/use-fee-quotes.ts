"use client";

import { useResource } from "@ador/client-react";
import type { ChainFees } from "@ador/shared/chain";
import { useEffect, useMemo } from "react";

import { createChainStatusApi, type ChainStatusApi } from "../client/api.ts";

// What the page knows of the fee market: still loading, or the platform's answer (no chain, the chain could not be asked, or the
// quotes), or that the platform itself could not be reached. Asked when the page opens and then every `refreshMs` while the tab shows.
export type FeeMarket =
  | { readonly status: "loading" }
  | { readonly status: "unreachable" }
  | { readonly fees: ChainFees; readonly status: "answered" };

export function useFeeQuotes(options: {
  readonly api?: ChainStatusApi;
  readonly refreshMs: number;
}): FeeMarket {
  const { api: given, refreshMs } = options;
  const api = useMemo(() => given ?? createChainStatusApi(), [given]);
  const { reload, state } = useResource(
    (signal) => api.fees(signal),
    "fees",
    () => "unreachable" as const,
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) reload();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [reload, refreshMs]);
  if (state.status === "loading") return { status: "loading" };
  if (state.status === "error") return { status: "unreachable" };
  return { fees: state.data, status: "answered" };
}
