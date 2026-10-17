import { executeHttpOperation } from "@ador/http";
import { chainIndexingSchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { createIndexingOperation } from "../src/application/indexing.ts";

const request = {
  actorSession: null,
  actorUserId: null,
  headers: {},
  method: "GET",
  rawInput: {},
};
const reading = (tipHeight: number) => ({
  chain: "bip122:00000008819873e925422c1ff0f99f7c",
  indexedHeight: 100,
  observedAt: "2026-10-17T12:00:00.000Z",
  tipHeight,
});

describe("the chain indexing route through the shared HTTP boundary", () => {
  it("answers anyone, with no session, in the shared contract", async () => {
    const operation = createIndexingOperation({
      delay: { maxLagBlocks: 2 },
      followed: {
        displayName: "Bitcoin signet",
        indexing: async () => reading(103),
      },
    });
    const response = await executeHttpOperation(operation, request, {
      createCorrelationId: () => "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(response.status).toBe(200);
    expect(chainIndexingSchema.parse(response.body)).toMatchObject({
      health: "delayed",
      lag: 3,
      state: "ok",
    });
  });

  it("answers 200 with unavailable, not an error, when the chain cannot be asked", async () => {
    const operation = createIndexingOperation({
      delay: { maxLagBlocks: 2 },
      followed: {
        displayName: "Bitcoin signet",
        indexing: () => Promise.reject(new Error("the node is down")),
      },
    });
    const response = await executeHttpOperation(operation, request, {
      createCorrelationId: () => "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      chain: "Bitcoin signet",
      state: "unavailable",
    });
  });

  it("refuses input it does not take", async () => {
    const operation = createIndexingOperation({
      delay: { maxLagBlocks: 2 },
      followed: null,
    });
    const response = await executeHttpOperation(
      operation,
      { ...request, rawInput: { chain: "x" } },
      { createCorrelationId: () => "123e4567-e89b-42d3-a456-426614174000" },
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
