import type { GameState } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import type { MilestoneRules } from "../src/rules.ts";
import { createGameSyncService } from "../src/service.ts";
import { createMemoryRepository } from "./support/memory-repository.ts";

const now = new Date("2026-10-13T12:00:00.000Z");
const rules: MilestoneRules = new Map([
  ["ten-wins", { claimPolicy: "once", target: 10 }],
  ["first-win", { claimPolicy: "once" }],
  ["a-win", { claimPolicy: "repeatable", maxCount: 3 }],
]);
const record = (
  id: string,
  count = 1,
  unlockedAt = "2026-10-01T00:00:00.000Z",
) => ({
  count,
  id,
  unlockedAt,
  verification: "self-reported" as const,
});
const state = (overrides: Partial<GameState> = {}): GameState => ({
  counters: [],
  milestones: [],
  progress: null,
  ...overrides,
});

function setup(gameRules: MilestoneRules = rules) {
  const repository = createMemoryRepository();
  const service = createGameSyncService({
    clock: () => now,
    games: new Map([["tap-tower", gameRules]]),
    maxProgressBytes: 1_000,
    repository,
  });
  const sync = async (input: GameState, user = "u1") => {
    const outcome = await service.sync(user, {
      gameId: "tap-tower",
      state: input,
    });
    return outcome.kind === "synced" ? outcome.state : outcome;
  };
  return { repository, sync };
}

describe("progress totals on the account", () => {
  it("keeps a total, and the larger of two, and never lowers it", async () => {
    const { sync } = setup();
    await sync(state({ counters: [{ current: 4, id: "ten-wins" }] }));
    expect(
      await sync(state({ counters: [{ current: 2, id: "ten-wins" }] })),
    ).toMatchObject({
      counters: [{ current: 4, id: "ten-wins" }],
    });
    expect(
      await sync(state({ counters: [{ current: 7, id: "ten-wins" }] })),
    ).toMatchObject({
      counters: [{ current: 7, id: "ten-wins" }],
    });
  });

  it("cuts a total above the target to it, and earns the milestone, at the time the account first saw the total reach it", async () => {
    const { sync } = setup();
    const merged = await sync(
      state({ counters: [{ current: 500, id: "ten-wins" }] }),
    );
    expect(merged).toMatchObject({
      counters: [{ current: 10, id: "ten-wins" }],
      milestones: [
        {
          count: 1,
          id: "ten-wins",
          unlockedAt: now.toISOString(),
          verification: "self-reported",
        },
      ],
    });
  });

  it("does not earn a milestone below its target, and does not earn it again once it has", async () => {
    const { sync } = setup();
    expect(
      await sync(state({ counters: [{ current: 9, id: "ten-wins" }] })),
    ).toMatchObject({ milestones: [] });
    const earned = await sync(
      state({ counters: [{ current: 10, id: "ten-wins" }] }),
    );
    const again = await sync(
      state({ counters: [{ current: 10, id: "ten-wins" }] }),
    );
    expect(again).toEqual(earned);
  });

  it("keeps the earlier time when a device reports a milestone the account already holds", async () => {
    const { sync } = setup();
    await sync(
      state({
        milestones: [record("ten-wins", 1, "2026-10-02T00:00:00.000Z")],
      }),
    );
    expect(
      await sync(state({ counters: [{ current: 10, id: "ten-wins" }] })),
    ).toMatchObject({
      milestones: [{ id: "ten-wins", unlockedAt: "2026-10-02T00:00:00.000Z" }],
    });
  });

  it("refuses a total for a milestone the game never declared, and one that has no target, before touching storage", async () => {
    const { repository, sync } = setup();
    expect(
      await sync(state({ counters: [{ current: 1, id: "made-up" }] })),
    ).toEqual({ id: "made-up", kind: "unknown-milestone" });
    expect(
      await sync(state({ counters: [{ current: 1, id: "first-win" }] })),
    ).toEqual({ id: "first-win", kind: "no-target" });
    expect(
      await sync(state({ counters: [{ current: 1, id: "a-win" }] })),
    ).toEqual({ id: "a-win", kind: "no-target" });
    expect(repository.calls).toEqual([]);
  });
});

describe("counts on the account", () => {
  it("keeps the larger count, up to the manifest's maximum, and a milestone earned once at one", async () => {
    const { sync } = setup();
    await sync(state({ milestones: [record("a-win", 2)] }));
    expect(
      await sync(state({ milestones: [record("a-win", 1)] })),
    ).toMatchObject({ milestones: [{ count: 2, id: "a-win" }] });
    expect(
      await sync(state({ milestones: [record("a-win", 99)] })),
    ).toMatchObject({ milestones: [{ count: 3, id: "a-win" }] });
    expect(
      await sync(state({ milestones: [record("first-win", 5)] }), "u2"),
    ).toMatchObject({
      milestones: [{ count: 1, id: "first-win" }],
    });
  });

  it("brings what is held within a limit that was lowered after it was stored", async () => {
    const stored = setup(
      new Map([
        ["a-win", { claimPolicy: "repeatable" as const, maxCount: 10 }],
      ]),
    );
    await stored.sync(state({ milestones: [record("a-win", 8)] }));
    const lowered = createGameSyncService({
      clock: () => now,
      games: new Map([
        [
          "tap-tower",
          new Map([
            ["a-win", { claimPolicy: "repeatable" as const, maxCount: 4 }],
          ]),
        ],
      ]),
      maxProgressBytes: 1_000,
      repository: stored.repository,
    });
    const outcome = await lowered.sync("u1", {
      gameId: "tap-tower",
      state: state(),
    });
    expect(
      outcome.kind === "synced" && outcome.state.milestones[0]?.count,
    ).toBe(4);
  });

  it("is idempotent: the same report again changes nothing", async () => {
    const { sync } = setup();
    const report = state({
      counters: [{ current: 4, id: "ten-wins" }],
      milestones: [record("a-win", 2)],
    });
    const first = await sync(report);
    expect(await sync(report)).toEqual(first);
  });
});
