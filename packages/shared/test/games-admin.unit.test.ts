import { trackedStates, stageOf } from "../src/chain/index.ts";
import { describe, expect, it } from "vitest";

import {
  gameAdminActionSchema,
  gameAdminHref,
  gameAdminRoutes,
  gameAdminStepSchema,
  gameAdminStepStates,
  listGameAdminStepsResponseSchema,
  refreshGameAdminStepResponseSchema,
  startGameAdminStepInputSchema,
  startGameAdminStepResponseSchema,
  submitGameAdminStepResponseSchema,
} from "../src/games/index.ts";

const id = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const step = {
  createdAt: "2026-10-16T12:00:00.000Z",
  createdBy: "Ada",
  failureReason: null,
  gameId: "arcade",
  id,
  operation: "set-claims-paused",
  state: "awaiting-signature",
  submittedBy: null,
  summary: {
    chain: "simnet:one",
    contractId: "rewards-1",
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: "sim", baseUnits: "1" },
    paused: true,
  },
  toSign: {
    chain: "simnet:one",
    family: "simulated",
    format: "f",
    payload: "{}",
  },
  transactionId: null,
};

describe("the staff administration contract", () => {
  it("names the stages the lifecycle has, no more and no fewer", () => {
    expect([...gameAdminStepStates].sort()).toEqual(
      [...new Set(trackedStates.map(stageOf))].sort(),
    );
  });

  it("accepts a step, and refuses an extra field or a state it does not know", () => {
    expect(gameAdminStepSchema.parse(step)).toEqual(step);
    expect(() => gameAdminStepSchema.parse({ ...step, extra: 1 })).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...step, state: "minted" }),
    ).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...step, operation: "deploy" }),
    ).toThrow();
  });

  it("takes the two actions staff have, each with only its own fields", () => {
    expect(
      gameAdminActionSchema.parse({
        milestoneId: "first-win",
        operation: "define-milestone",
      }),
    ).toBeDefined();
    expect(
      gameAdminActionSchema.parse({
        operation: "set-claims-paused",
        paused: false,
      }),
    ).toBeDefined();
    expect(() =>
      gameAdminActionSchema.parse({ operation: "set-claims-paused" }),
    ).toThrow();
    expect(() =>
      gameAdminActionSchema.parse({
        milestoneId: "first-win",
        operation: "define-milestone",
        paused: true,
      }),
    ).toThrow();
    expect(() =>
      gameAdminActionSchema.parse({
        drawing: "",
        milestoneId: "first-win",
        operation: "define-milestone",
      }),
    ).toThrow();
  });

  it("answers each call with a result or a refusal, never both", () => {
    expect(
      startGameAdminStepResponseSchema.parse({
        resumed: false,
        status: "started",
        step,
      }),
    ).toBeDefined();
    expect(
      startGameAdminStepResponseSchema.parse({
        detail: "why",
        reason: "bad-drawing",
        status: "refused",
      }),
    ).toBeDefined();
    expect(() =>
      startGameAdminStepResponseSchema.parse({
        reason: "bad-drawing",
        status: "started",
      }),
    ).toThrow();
    expect(
      submitGameAdminStepResponseSchema.parse({ status: "submitted", step }),
    ).toBeDefined();
    expect(
      submitGameAdminStepResponseSchema.parse({
        reason: "expired",
        status: "refused",
      }),
    ).toBeDefined();
    expect(
      refreshGameAdminStepResponseSchema.parse({ status: "ok", step }),
    ).toBeDefined();
    expect(
      listGameAdminStepsResponseSchema.parse({ steps: [step] }).steps,
    ).toHaveLength(1);
    expect(() =>
      startGameAdminStepInputSchema.parse({
        action: { operation: "set-claims-paused", paused: true },
        gameId: "arcade",
      }),
    ).toThrow();
  });

  it("has four POST routes under one prefix, and a page address per game", () => {
    expect(Object.values(gameAdminRoutes).map((route) => route.method)).toEqual(
      ["POST", "POST", "POST", "POST"],
    );
    expect(
      new Set(Object.values(gameAdminRoutes).map((route) => route.path)).size,
    ).toBe(4);
    expect(gameAdminHref("arcade")).toBe("/admin/games/arcade");
  });
});
