import type { GameRunsService } from "@ador/game-runs";
import {
  startGameRunRoute,
  submitGameRunRoute,
  submitGameRunInputSchema,
} from "@ador/shared/games";
import { idempotencyKeySchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import {
  createStartGameRunOperation,
  createSubmitGameRunOperation,
} from "../src/application/runs-operations.ts";

const userId = uuidV7Schema.parse("01890f0e-7c8a-7b3a-8a3e-0123456789ab");
const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
  idempotencyKey: idempotencyKeySchema.parse("request-key-00000001"),
};
const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const run = { expiresAt: "2026-10-16T12:00:00.000Z", runId, seed: 7 };
const ids = { gameId: "any-game" };
const verdict = {
  digest: "d".repeat(64),
  earned: ["first-win"],
  reason: null,
  status: "verified",
} as const;

function stub(overrides: Partial<GameRunsService> = {}) {
  const service: GameRunsService = {
    start: vi.fn(async () => ({ ok: true as const, run })),
    submit: vi.fn(async () => ({ ok: true as const, verdict })),
    ...overrides,
  };
  return {
    service,
    start: createStartGameRunOperation(async () => service),
    submit: createSubmitGameRunOperation(async () => service),
  };
}
const submission = { gameId: "any-game", record: { any: "json" }, runId };

describe("the start operation", () => {
  it("is an authenticated, keyless POST on its contract route", () => {
    expect(stub().start).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      method: startGameRunRoute.method,
      operationId: startGameRunRoute.operationId,
      path: startGameRunRoute.path,
    });
  });

  it("refuses an anonymous caller without touching the service", async () => {
    const { service, start } = stub();
    expect(
      await start.execute(
        { gameId: "any-game" },
        { ...context, actorUserId: null },
      ),
    ).toMatchObject({ error: "unauthorized", ok: false });
    expect(service.start).not.toHaveBeenCalled();
  });

  it("starts a run for the session's own user, and answers with the run", async () => {
    const { service, start } = stub();
    expect(await start.execute({ gameId: "any-game" }, context)).toEqual({
      ok: true,
      value: { ...run, status: "started" },
    });
    expect(service.start).toHaveBeenCalledWith(userId, "any-game");
  });

  it("answers, not fails, for a game with no verifier and for a player with too many open runs, each with its reason", async () => {
    for (const [code, reason] of [
      ["unavailable", "not-supported"],
      ["too-many-open-runs", "too-many-open-runs"],
    ] as const) {
      const { start } = stub({ start: async () => ({ code, ok: false }) });
      expect(await start.execute(ids, context)).toEqual({
        ok: true,
        value: { reason, status: "unavailable" },
      });
    }
  });
});

describe("the submit operation", () => {
  it("is an authenticated, keyless POST on its contract route", () => {
    expect(stub().submit).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      method: submitGameRunRoute.method,
      operationId: submitGameRunRoute.operationId,
      path: submitGameRunRoute.path,
    });
  });

  it("refuses an anonymous caller without touching the service", async () => {
    const { service, submit } = stub();
    expect(
      await submit.execute(submission, { ...context, actorUserId: null }),
    ).toMatchObject({ error: "unauthorized", ok: false });
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("submits for the session's own user, the game and run named, and the record as sent", async () => {
    const { service, submit } = stub();
    expect(await submit.execute(submission, context)).toEqual({
      ok: true,
      value: { earned: ["first-win"], status: "verified" },
    });
    expect(service.submit).toHaveBeenCalledWith(
      userId,
      "any-game",
      runId,
      submission.record,
    );
    // The contract has no field through which a caller could name another player.
    expect(
      submitGameRunInputSchema.safeParse({
        ...submission,
        userId: "someone-else",
      }).success,
    ).toBe(false);
  });

  it("answers a rejected record as a result, with its reason, not as an error", async () => {
    const { submit } = stub({
      submit: async () => ({
        ok: true,
        verdict: {
          ...verdict,
          earned: [],
          reason: "illegal-input",
          status: "rejected",
        },
      }),
    });
    expect(await submit.execute(submission, context)).toEqual({
      ok: true,
      value: { reason: "illegal-input", status: "rejected" },
    });
  });

  it.each([
    ["not-found", "unknown-run"],
    ["already-submitted", "already-submitted"],
    ["expired", "expired"],
    ["stale", "stale"],
  ] as const)("answers %s as a refusal, %s", async (code, reason) => {
    const { submit } = stub({ submit: async () => ({ code, ok: false }) });
    expect(await submit.execute(submission, context)).toEqual({
      ok: true,
      value: { reason, status: "refused" },
    });
  });
});
