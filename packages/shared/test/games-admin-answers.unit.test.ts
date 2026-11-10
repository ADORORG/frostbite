import { describe, expect, it } from "vitest";

import {
  listGameAdminStepsResponseSchema,
  listGameAdminTemplatesInputSchema,
  listGameAdminTemplatesResponseSchema,
  refreshGameAdminStepResponseSchema,
  startGameAdminStepInputSchema,
  startGameAdminStepResponseSchema,
  submitGameAdminStepResponseSchema,
} from "../src/games/index.ts";
import { adminStep } from "./support/admin-step.ts";

const step = adminStep;

// What each staff call answers with, and how each answer is refused when it is not one of the shapes the platform sends.
describe("the staff administration answers", () => {
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
    const empty = {
      contract: null,
      drawingCeiling: 16_384,
      drawingLimits: {
        maxAttributeLength: 4096,
        maxDepth: 8,
        maxElements: 200,
      },
      steps: [step],
      templatesReady: false,
    };
    expect(listGameAdminStepsResponseSchema.parse(empty).steps).toHaveLength(1);
    expect(
      listGameAdminStepsResponseSchema.parse({
        ...empty,
        contract: { address: "2:7", maxDrawingBytes: 4096 },
        templatesReady: true,
      }).contract?.address,
    ).toBe("2:7");
    expect(() =>
      listGameAdminStepsResponseSchema.parse({ steps: [step] }),
    ).toThrow();
    expect(() =>
      listGameAdminStepsResponseSchema.parse({ ...empty, drawingCeiling: 0 }),
    ).toThrow();
    expect(
      listGameAdminTemplatesResponseSchema.parse({
        publishable: [{ id: "game-rewards", version: "1.0.0" }],
        published: [
          {
            address: "4:100",
            publishedAt: "2026-10-16T12:00:00.000Z",
            templateRef: "game-rewards@1.0.0",
          },
        ],
        steps: [step],
      }).published,
    ).toHaveLength(1);
    expect(listGameAdminTemplatesInputSchema.parse({})).toEqual({});
    expect(() => listGameAdminTemplatesInputSchema.parse({ x: 1 })).toThrow();
    expect(() =>
      startGameAdminStepInputSchema.parse({
        action: { operation: "set-claims-paused", paused: true },
        gameId: "arcade",
      }),
    ).toThrow();
    for (const reason of [
      "address-taken",
      "already-created",
      "already-published",
      "template-not-published",
      "unknown-template",
    ]) {
      expect(
        startGameAdminStepResponseSchema.parse({ reason, status: "refused" }),
      ).toBeDefined();
    }
  });
});
