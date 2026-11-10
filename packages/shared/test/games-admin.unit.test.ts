import { trackedStates, stageOf } from "../src/chain/index.ts";
import { describe, expect, it } from "vitest";

import {
  gameAdminActionSchema,
  gameAdminHref,
  gameAdminRoutes,
  gameAdminStepSchema,
  gameAdminStepStates,
  startGameAdminStepInputSchema,
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

  it("says whether a step is delayed and when it was sent, as a flag and a time, and refuses anything else", () => {
    const sent = {
      ...step,
      delayed: true,
      sentAt: "2026-10-16T11:00:00.000Z",
    };
    expect(gameAdminStepSchema.parse(sent)).toEqual(sent);
    expect(() =>
      gameAdminStepSchema.parse({ ...sent, delayed: "yes" }),
    ).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...sent, sentAt: "yesterday" }),
    ).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...sent, delayed: undefined }),
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
      // The platform chooses the address; a person cannot name one.
      { ...publish, address: "4:100" },
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

  it("has six routes under one prefix, and a page address per game", () => {
    const routes = Object.values(gameAdminRoutes);
    // The two reads are GETs (so they can be kept); the four steps that change something are POSTs.
    expect(
      Object.entries(gameAdminRoutes).map(([name, route]) => [
        name,
        route.method,
      ]),
    ).toEqual([
      ["list", "GET"],
      ["record", "POST"],
      ["refresh", "POST"],
      ["start", "POST"],
      ["submit", "POST"],
      ["templates", "GET"],
    ]);
    expect(routes).toHaveLength(6);
    expect(new Set(routes.map((route) => route.path)).size).toBe(6);
    expect(
      routes.every((route) => route.path.startsWith("/api/v1/game-admin/")),
    ).toBe(true);
    expect(gameAdminHref("arcade")).toBe("/admin/games/arcade");
  });
});
