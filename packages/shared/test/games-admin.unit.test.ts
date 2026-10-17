import { trackedStates, stageOf } from "../src/chain/index.ts";
import { describe, expect, it } from "vitest";

import {
  gameAdminActionSchema,
  gameAdminHref,
  gameAdminRoutes,
  gameAdminStepSchema,
  gameAdminStepStates,
  listGameAdminTemplatesInputSchema,
  listGameAdminTemplatesResponseSchema,
  listGameAdminStepsResponseSchema,
  refreshGameAdminStepResponseSchema,
  startGameAdminStepInputSchema,
  startGameAdminStepResponseSchema,
  submitGameAdminStepResponseSchema,
} from "../src/games/index.ts";
import { adminStep } from "./support/admin-step.ts";

const step = adminStep;

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
      gameAdminStepSchema.parse({ ...step, operation: "reboot" }),
    ).toThrow();
  });

  it("takes the four actions staff have, each with only its own fields", () => {
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

  it("takes publishing a template and creating a game's contract, with only their own fields", () => {
    const publish = {
      address: "4:100",
      operation: "publish-template",
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    };
    expect(gameAdminActionSchema.parse(publish)).toEqual(publish);
    expect(
      gameAdminActionSchema.parse({
        maxDrawingBytes: 4096,
        operation: "deploy",
      }),
    ).toBeDefined();
    for (const bad of [
      { ...publish, address: " " },
      { ...publish, templateVersion: undefined },
      { ...publish, paused: true },
      { maxDrawingBytes: 0, operation: "deploy" },
      { maxDrawingBytes: 1.5, operation: "deploy" },
      { maxDrawingBytes: 2_000_000, operation: "deploy" },
      { operation: "deploy" },
    ]) {
      expect(() => gameAdminActionSchema.parse(bad)).toThrow();
    }
  });

  it("publishes a template for no game, and every other step for one", () => {
    const wallet = "tb1qwallet";
    const publish = {
      address: "4:100",
      operation: "publish-template",
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    };
    expect(
      startGameAdminStepInputSchema.parse({
        action: publish,
        gameId: null,
        wallet,
      }).gameId,
    ).toBeNull();
    expect(() =>
      startGameAdminStepInputSchema.parse({
        action: publish,
        gameId: "arcade",
        wallet,
      }),
    ).toThrow(/for no game/u);
    for (const action of [
      { operation: "set-claims-paused", paused: true },
      { maxDrawingBytes: 4096, operation: "deploy" },
    ]) {
      expect(() =>
        startGameAdminStepInputSchema.parse({ action, gameId: null, wallet }),
      ).toThrow(/for no game/u);
    }
  });

  it("shows a step that publishes a template or creates a contract by what it makes, not by a contract it acts on", () => {
    const published = {
      ...step,
      createdContracts: ["2:7"],
      gameId: null,
      operation: "publish-template",
      templateRef: "game-rewards@1.0.0",
      summary: {
        chain: "simnet:one",
        expiresAt: "2026-10-16T12:10:00.000Z",
        fee: { asset: "sim", baseUnits: "1" },
        template: { address: "4:100", id: "game-rewards", version: "1.0.0" },
      },
    };
    expect(gameAdminStepSchema.parse(published)).toEqual(published);
    const created = {
      ...step,
      operation: "deploy",
      summary: {
        chain: "simnet:one",
        collectibleAddress: "4:101",
        expiresAt: "2026-10-16T12:10:00.000Z",
        fee: { asset: "sim", baseUnits: "1" },
        maxDrawingBytes: 4096,
        template: { address: "4:100", id: "game-rewards", version: "1.0.0" },
      },
    };
    expect(gameAdminStepSchema.parse(created)).toEqual(created);
    expect(() =>
      gameAdminStepSchema.parse({
        ...created,
        summary: { ...created.summary, maxDrawingBytes: 0 },
      }),
    ).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...step, createdContracts: "2:7" }),
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
    const empty = {
      contract: null,
      drawingCeiling: 16_384,
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

  it("has six POST routes under one prefix, and a page address per game", () => {
    const routes = Object.values(gameAdminRoutes);
    expect(routes.map((route) => route.method)).toEqual(
      routes.map(() => "POST"),
    );
    expect(routes).toHaveLength(6);
    expect(new Set(routes.map((route) => route.path)).size).toBe(6);
    expect(
      routes.every((route) => route.path.startsWith("/api/v1/game-admin/")),
    ).toBe(true);
    expect(gameAdminHref("arcade")).toBe("/admin/games/arcade");
  });
});
