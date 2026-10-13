import { createGameSyncService, type GameSyncService } from "@ador/game-saves";
import { idempotencyKeySchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import {
  gameSyncRoute,
  syncGameStateInputSchema,
  type GameState,
} from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import { createSyncGameStateOperation } from "../src/application/sync-operation.ts";

const userId = uuidV7Schema.parse("01890f0e-7c8a-7b3a-8a3e-0123456789ab");
const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
  idempotencyKey: idempotencyKeySchema.parse("request-key-00000001"),
};
const playerId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const empty: GameState = { milestones: [], progress: null };
const input = { gameId: "tap-tower", state: empty };

function stub(outcome: Awaited<ReturnType<GameSyncService["sync"]>>) {
  const sync = vi.fn<GameSyncService["sync"]>(async () => outcome);
  return {
    operation: createSyncGameStateOperation(async () => ({ sync })),
    sync,
  };
}

describe("the sync operation", () => {
  it("is an authenticated, keyless POST on its contract route", () => {
    const { operation } = stub({ kind: "synced", playerId, state: empty });
    expect(operation).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      method: gameSyncRoute.method,
      operationId: gameSyncRoute.operationId,
      path: gameSyncRoute.path,
    });
  });

  it("refuses an anonymous caller without touching the service", async () => {
    const { operation, sync } = stub({
      kind: "synced",
      playerId,
      state: empty,
    });
    expect(
      await operation.execute(input, { ...context, actorUserId: null }),
    ).toMatchObject({ error: "unauthorized", ok: false });
    expect(sync).not.toHaveBeenCalled();
  });

  it("syncs for the session's own user, whatever else the request says", async () => {
    const { operation, sync } = stub({
      kind: "synced",
      playerId,
      state: empty,
    });
    expect(await operation.execute(input, context)).toEqual({
      ok: true,
      value: { ...empty, playerId },
    });
    expect(sync).toHaveBeenCalledWith(userId, input);
    // The contract has no field through which a caller could name another player.
    expect(
      syncGameStateInputSchema.safeParse({ ...input, userId: "someone-else" })
        .success,
    ).toBe(false);
  });

  it.each([
    [{ kind: "unknown-game" }, "not_found"],
    [{ id: "x", kind: "unknown-milestone" }, "invalid_request"],
    [{ kind: "too-large" }, "invalid_request"],
  ] as const)("reports %j as %s", async (outcome, error) => {
    const { operation } = stub(outcome);
    expect(await operation.execute(input, context)).toMatchObject({
      error,
      ok: false,
    });
  });

  it("works end to end with the real service over a stand-in store", async () => {
    let stored: GameState = empty;
    const service = createGameSyncService({
      clock: () => new Date("2026-10-12T00:00:00.000Z"),
      games: new Map([["tap-tower", new Set(["first-five"])]]),
      maxProgressBytes: 100,
      repository: {
        change: async (_user, _game, decide) => ({
          playerId,
          state: (stored = decide(stored)),
        }),
      },
    });
    const operation = createSyncGameStateOperation(async () => service);
    const first = {
      id: "first-five",
      unlockedAt: "2026-10-01T00:00:00.000Z",
      verification: "self-reported",
    } as const;
    const unlocked: GameState = { milestones: [first], progress: null };
    expect(
      await operation.execute(
        { gameId: "tap-tower", state: unlocked },
        context,
      ),
    ).toEqual({ ok: true, value: { ...unlocked, playerId } });
    expect(
      await operation.execute(
        {
          gameId: "tap-tower",
          state: {
            milestones: [{ ...first, id: "made-up" }],
            progress: null,
          },
        },
        context,
      ),
    ).toMatchObject({ error: "invalid_request", ok: false });
  });
});
