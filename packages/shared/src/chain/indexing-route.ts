import { z } from "zod";

import { indexingHealths } from "./indexing.ts";

// How far the rewards chain's indexer has read, as any page is told of it. Public: it is a fact about the chain, not about a person.
// `none`: the platform has no chain to follow, so nothing is shown. `unavailable`: there is one and it could not be asked, which is
// not the same as the indexer being behind. `ok`: the reading, with the platform's own verdict on it.
export const chainIndexingSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("none") }).strict(),
  z
    .object({
      chain: z.string().min(1).max(64),
      state: z.literal("unavailable"),
      // The chain's tip, where only the indexer could not be asked.
      tipHeight: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      chain: z.string().min(1).max(64),
      health: z.enum(indexingHealths),
      indexedHeight: z.number().int().nonnegative(),
      lag: z.number().int().nonnegative(),
      observedAt: z.iso.datetime({ offset: true }),
      state: z.literal("ok"),
      tipHeight: z.number().int().nonnegative(),
    })
    .strict(),
]);

export const chainIndexingInputSchema = z.object({}).strict();

export const chainIndexingRoute = {
  method: "GET",
  operationId: "getChainIndexing",
  path: "/api/v1/chain/indexing",
} as const;

export type ChainIndexing = z.infer<typeof chainIndexingSchema>;
