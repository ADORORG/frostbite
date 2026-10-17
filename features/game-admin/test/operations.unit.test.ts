import type { GameAdminService } from "@ador/game-admin";
import { signedTransactionSchema } from "@ador/shared/chain";
import {
  gameAdminCapability,
  gameAdminRoutes,
  gameAdminStartRefusals,
} from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createListStepsOperation,
  createListTemplatesOperation,
  createRefreshStepOperation,
  createStartStepOperation,
  createSubmitStepOperation,
} from "../src/application/operations.ts";
import type { GameAdminRuntime } from "../src/runtime.ts";
import {
  chain,
  config,
  publishSummary,
  staffId,
  view,
} from "./support/fixtures.ts";

const context = {
  actorSession: null,
  actorUserId: staffId as never,
  correlationId: "c0ffee00-0000-4000-8000-000000000000" as never,
};
const anonymous = { ...context, actorUserId: null };

function stub(overrides: Partial<GameAdminService> = {}) {
  const service: GameAdminService = {
    list: vi.fn(async () => [view()]),
    status: vi.fn(async () => ({
      contract: { address: "rewards-1", maxDrawingBytes: 4096 },
      templatesReady: true,
    })),
    templates: vi.fn(async () => [
      {
        address: "at-1",
        codeHash: "a".repeat(64),
        publishedAt: new Date("2026-10-16T12:00:00.000Z"),
        templateRef: "game-rewards@1.0.0",
      },
    ]),
    refresh: vi.fn(async () => ({ ok: true as const, step: view() })),
    start: vi.fn(async () => ({
      ok: true as const,
      resumed: false,
      step: view(),
    })),
    submitSigned: vi.fn(async () => ({ ok: true as const, step: view() })),
    ...overrides,
  };
  const resolve = async (): Promise<GameAdminRuntime> => ({
    names: async () => new Map([[staffId, "Ada"]]),
    rewards: config().rewards,
    service,
  });
  return {
    list: createListStepsOperation(resolve),
    refresh: createRefreshStepOperation(resolve),
    service,
    start: createStartStepOperation(resolve),
    templates: createListTemplatesOperation(resolve),
    submit: createSubmitStepOperation(resolve),
  };
}
const startInput = {
  action: { operation: "set-claims-paused", paused: true },
  gameId: "arcade",
  wallet: "sim:one:a1b2c3fe",
} as const;
const signed = {
  chain,
  family: "simulated",
  format: "sim-json/1",
  payload: "{}.sig",
};

describe("every administration operation", () => {
  it("is a keyless POST on its contract route that needs the administration capability", () => {
    const s = stub();
    for (const [operation, route] of [
      [s.start, gameAdminRoutes.start],
      [s.submit, gameAdminRoutes.submit],
      [s.refresh, gameAdminRoutes.refresh],
      [s.list, gameAdminRoutes.list],
      [s.templates, gameAdminRoutes.templates],
    ] as const)
      expect(operation).toMatchObject({
        access: { capability: gameAdminCapability, kind: "platform" },
        idempotency: "none",
        input: "json",
        ...route,
      });
  });

  it("answers an unauthenticated call as such, and asks the service nothing", async () => {
    const s = stub();
    for (const result of [
      await s.start.execute(startInput, anonymous),
      await s.submit.execute({ signed, stepId: view().id }, anonymous),
      await s.refresh.execute({ stepId: view().id }, anonymous),
      await s.list.execute({ gameId: "arcade" }, anonymous),
      await s.templates.execute({}, anonymous),
    ])
      expect(result).toMatchObject({ ok: false });
    expect(s.service.start).not.toHaveBeenCalled();
    expect(s.service.list).not.toHaveBeenCalled();
    expect(s.service.templates).not.toHaveBeenCalled();
  });
});

describe("starting a step", () => {
  it("passes on who is asking from the session and what they asked, and answers the step with names", async () => {
    const s = stub();
    const result = await s.start.execute(
      { ...startInput, authTokenOutput: "aa:0" },
      context,
    );
    expect(s.service.start).toHaveBeenCalledWith({
      action: startInput.action,
      authTokenOutput: "aa:0",
      gameId: "arcade",
      staffId,
      wallet: startInput.wallet,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { resumed: false, status: "started", step: { createdBy: "Ada" } },
    });
  });

  it.each([
    ["address-taken", "address-taken"],
    ["already-created", "already-created"],
    ["already-published", "already-published"],
    ["template-not-published", "template-not-published"],
    ["unknown-template", "unknown-template"],
    ["already-defined", "already-defined"],
    ["chain-unavailable", "unavailable"],
    ["not-administered", "not-administered"],
    ["unavailable", "unavailable"],
    ["wrong-chain", "wrong-network"],
  ] as const)("answers %s as a refusal, %s", async (code, reason) => {
    const s = stub({
      start: vi.fn(async () => ({ code, ok: false as const })),
    });
    const result = await s.start.execute(startInput, context);
    expect(result).toEqual({ ok: true, value: { reason, status: "refused" } });
    expect(gameAdminStartRefusals).toContain(reason);
  });

  it.each(["bad-drawing", "could-not-build"] as const)(
    "gives the reason for a %s",
    async (code) => {
      const s = stub({
        start: vi.fn(async () => ({ code, ok: false as const, reason: "why" })),
      });
      expect(await s.start.execute(startInput, context)).toEqual({
        ok: true,
        value: { detail: "why", reason: code, status: "refused" },
      });
    },
  );
});

describe("sending, looking at and listing steps", () => {
  it("sends what was signed as a signed transaction for the step, as the session's staff member", async () => {
    const s = stub();
    const result = await s.submit.execute(
      { signed, stepId: view().id },
      context,
    );
    expect(s.service.submitSigned).toHaveBeenCalledWith({
      signed: signedTransactionSchema.parse(signed),
      staffId,
      stepId: view().id,
    });
    expect(result).toMatchObject({ ok: true, value: { status: "submitted" } });
  });

  it("answers a refusal by its code", async () => {
    const s = stub({
      refresh: vi.fn(async () => ({
        code: "not-found" as const,
        ok: false as const,
      })),
      submitSigned: vi.fn(async () => ({
        code: "expired" as const,
        ok: false as const,
      })),
    });
    expect(
      await s.submit.execute({ signed, stepId: view().id }, context),
    ).toEqual({
      ok: true,
      value: { reason: "expired", status: "refused" },
    });
    expect(await s.refresh.execute({ stepId: view().id }, context)).toEqual({
      ok: true,
      value: { reason: "not-found", status: "refused" },
    });
  });

  it("looks at a step once and lists a game's steps with the people named", async () => {
    const s = stub();
    expect(
      await s.refresh.execute({ stepId: view().id }, context),
    ).toMatchObject({
      ok: true,
      value: { status: "ok", step: { id: view().id } },
    });
    expect(await s.list.execute({ gameId: "arcade" }, context)).toMatchObject({
      ok: true,
      value: {
        contract: { address: "rewards-1", maxDrawingBytes: 4096 },
        steps: [{ createdBy: "Ada" }],
        templatesReady: true,
      },
    });
    expect(s.service.list).toHaveBeenCalledWith("arcade");
  });

  it("lists a game the platform does not administer as having no contract, no templates ready and no steps", async () => {
    const s = stub({
      list: vi.fn(async () => []),
      status: vi.fn(async () => null),
    });
    expect(await s.list.execute({ gameId: "nope" }, context)).toEqual({
      ok: true,
      value: { contract: null, steps: [], templatesReady: false },
    });
  });

  it("lists the templates that may be published, which are and where, and the steps that published them", async () => {
    const s = stub({
      list: vi.fn(async () => [
        view({
          gameId: null,
          operation: "publish-template",
          templateRef: "game-rewards@1.0.0",
          summary: publishSummary(),
        }),
      ]),
    });
    expect(await s.templates.execute({}, context)).toEqual({
      ok: true,
      value: {
        publishable: [
          { id: "game-rewards", version: "1.0.0" },
          { id: "milestone-collectible", version: "1.0.0" },
        ],
        published: [
          {
            address: "at-1",
            publishedAt: "2026-10-16T12:00:00.000Z",
            templateRef: "game-rewards@1.0.0",
          },
        ],
        steps: [
          expect.objectContaining({
            createdBy: "Ada",
            gameId: null,
            operation: "publish-template",
          }),
        ],
      },
    });
    // The steps that publish templates are the ones that belong to no game.
    expect(s.service.list).toHaveBeenCalledWith(null);
  });
});
