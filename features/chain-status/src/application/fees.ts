import type { HttpOperation } from "@ador/http";
import {
  chainFeesInputSchema,
  chainFeesRoute,
  chainFeesSchema,
  feeSpeeds,
  quotesFor,
  targetBlocksOf,
  type ChainFees,
} from "@ador/shared/chain";

import type { ChainStatusConfig } from "../config.ts";

// What it costs to be confirmed at each speed on the followed chain, with where the chain is. Public, because it says nothing about
// anyone. A chain that cannot be asked, or that quotes nothing for a speed, is reported as unavailable: a rate is never guessed, and a
// stale one is never passed off as current.
export function createFeesOperation(
  config: Pick<ChainStatusConfig, "exampleVbytes" | "feeSpeeds" | "followed">,
): HttpOperation<Record<string, never>, ChainFees> {
  return {
    access: { kind: "public" },
    applicationErrors: [],
    execute: async () => {
      const { exampleVbytes, feeSpeeds: policy, followed } = config;
      if (followed === null) return { ok: true, value: { state: "none" } };
      try {
        const [status, rates] = await Promise.all([
          followed.indexing(),
          followed.feeRates(
            feeSpeeds.map((speed) => targetBlocksOf(policy, speed)),
          ),
        ]);
        const quotes = quotesFor(policy, rates, {
          exampleVbytes,
          maxFeeSats: followed.maxFeeSats,
        });
        if (quotes === null)
          return {
            ok: true,
            value: { chain: followed.displayName, state: "unavailable" },
          };
        return {
          ok: true,
          value: {
            chain: followed.displayName,
            maxFeeSats: followed.maxFeeSats,
            observedAt: status.observedAt,
            quotes,
            state: "ok",
            tipHeight: status.tipHeight,
          },
        };
      } catch {
        return {
          ok: true,
          value: { chain: followed.displayName, state: "unavailable" },
        };
      }
    },
    idempotency: "none",
    input: "none",
    inputSchema: chainFeesInputSchema,
    method: chainFeesRoute.method,
    operationId: chainFeesRoute.operationId,
    outputSchema: chainFeesSchema,
    path: chainFeesRoute.path,
  };
}
