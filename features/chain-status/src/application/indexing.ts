import type { HttpOperation } from "@ador/http";
import {
  chainIndexingInputSchema,
  chainIndexingRoute,
  chainIndexingSchema,
  indexingHealth,
  lagOf,
  type ChainIndexing,
} from "@ador/shared/chain";

import type { ChainStatusConfig } from "../config.ts";

// How far the followed chain's indexer has read, with the platform's verdict on it. Public, because it says nothing about anyone. A chain
// that cannot be asked is reported as such (`unavailable`), never as in sync and never as behind.
export function createIndexingOperation(
  config: Pick<ChainStatusConfig, "delay"> & {
    readonly followed: Pick<
      NonNullable<ChainStatusConfig["followed"]>,
      "displayName" | "indexing" | "tipHeight"
    > | null;
  },
): HttpOperation<Record<string, never>, ChainIndexing> {
  return {
    access: { kind: "public" },
    applicationErrors: [],
    execute: async () => {
      const { followed } = config;
      if (followed === null) return { ok: true, value: { state: "none" } };
      try {
        const status = await followed.indexing();
        return {
          ok: true,
          value: {
            chain: followed.displayName,
            health: indexingHealth(status, config.delay),
            indexedHeight: status.indexedHeight,
            lag: lagOf(status),
            observedAt: status.observedAt,
            state: "ok",
            tipHeight: status.tipHeight,
          },
        };
      } catch {
        // The indexer could not be asked; the chain's tip may still be, and is told on its own.
        const tipHeight = await followed.tipHeight().catch(() => null);
        return {
          ok: true,
          value: {
            chain: followed.displayName,
            state: "unavailable",
            ...(tipHeight === null ? {} : { tipHeight }),
          },
        };
      }
    },
    idempotency: "none",
    input: "none",
    inputSchema: chainIndexingInputSchema,
    method: chainIndexingRoute.method,
    cache: { kind: "no-store" },
    operationId: chainIndexingRoute.operationId,
    outputSchema: chainIndexingSchema,
    path: chainIndexingRoute.path,
  };
}
