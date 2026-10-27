import type { IndexingStatus } from "@ador/shared/chain";
import { chainIndexingSchema } from "@ador/shared/chain";
import { describe, expect, it, vi } from "vitest";

import { createIndexingOperation } from "../src/application/indexing.ts";

const context = {
  actorSession: null,
  actorUserId: null,
  correlationId: "123e4567-e89b-42d3-a456-426614174000",
};
const delay = { maxLagBlocks: 2 };
const reading = (tipHeight: number, indexedHeight = 100): IndexingStatus => ({
  chain: "bip122:00000008819873e925422c1ff0f99f7c",
  indexedHeight,
  observedAt: "2026-10-17T12:00:00.000Z",
  tipHeight,
});
const answer = (
  followed: Parameters<typeof createIndexingOperation>[0]["followed"],
) => createIndexingOperation({ delay, followed }).execute({}, context);

describe("the chain indexing route", () => {
  it("is public, takes no input, and answers in the shared contract", async () => {
    const operation = createIndexingOperation({ delay, followed: null });
    expect(operation).toMatchObject({
      access: { kind: "public" },
      method: "GET",
      path: "/api/v1/chain/indexing",
    });
    expect(operation.outputSchema).toBe(chainIndexingSchema);
  });

  it("says there is nothing to show where no chain is followed", async () => {
    expect(await answer(null)).toEqual({
      ok: true,
      value: { state: "none" },
    });
  });

  it.each([
    [100, "current", 0],
    [101, "catching-up", 1],
    [102, "catching-up", 2],
    [103, "delayed", 3],
    [99, "current", 0],
  ] as const)("reads the indexer at tip %i as %s", async (tip, health, lag) => {
    const result = await answer({
      displayName: "Bitcoin signet",
      indexing: async () => reading(tip),
      tipHeight: () => Promise.reject(new Error("not used")),
    });
    expect(result).toEqual({
      ok: true,
      value: {
        chain: "Bitcoin signet",
        health,
        indexedHeight: 100,
        lag,
        observedAt: "2026-10-17T12:00:00.000Z",
        state: "ok",
        tipHeight: tip,
      },
    });
    if (result.ok) chainIndexingSchema.parse(result.value);
  });

  it("reads the allowed lag from the policy it is given", async () => {
    const followed = {
      displayName: "Bitcoin signet",
      indexing: async () => reading(110),
      tipHeight: () => Promise.reject(new Error("not used")),
    };
    const lenient = createIndexingOperation({
      delay: { maxLagBlocks: 10 },
      followed,
    });
    expect(await lenient.execute({}, context)).toMatchObject({
      value: { health: "catching-up" },
    });
  });

  it("says the chain could not be asked, and not that the indexer is in sync or behind, when the node does not answer at all", async () => {
    const indexing = vi.fn(() => Promise.reject(new Error("the node is down")));
    const result = await answer({
      displayName: "Bitcoin signet",
      indexing,
      tipHeight: () => Promise.reject(new Error("the node is down")),
    });
    expect(result).toEqual({
      ok: true,
      value: { chain: "Bitcoin signet", state: "unavailable" },
    });
    expect(indexing).toHaveBeenCalledTimes(1);
  });

  it("still tells where the chain is when only its indexer could not be asked, without saying how far the indexer has read", async () => {
    const result = await answer({
      displayName: "Bitcoin signet",
      indexing: () => Promise.reject(new Error("the indexer is down")),
      tipHeight: async () => 328_178,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        chain: "Bitcoin signet",
        state: "unavailable",
        tipHeight: 328_178,
      },
    });
    if (result.ok) chainIndexingSchema.parse(result.value);
  });
});
