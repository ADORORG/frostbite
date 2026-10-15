import type { GameState } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { asReported } from "../src/rules.ts";
import { createGameSyncService } from "../src/service.ts";
import { createMemoryRepository } from "./support/memory-repository.ts";
import { rules } from "./support/rules.ts";

const now = new Date("2026-10-12T12:00:00.000Z");
const record = (
  verification: "replay-verified" | "self-reported",
  unlockedAt = "2026-10-01T00:00:00.000Z",
) => ({ count: 1, id: "first-win", unlockedAt, verification });
const state = (milestones: GameState["milestones"]): GameState => ({
  counters: [],
  milestones,
  progress: null,
});

function setup() {
  const repository = createMemoryRepository();
  const service = createGameSyncService({
    clock: () => now,
    games: new Map([["any-game", rules(["first-win"])]]),
    maxProgressBytes: 1_000,
    repository,
  });
  return { repository, service };
}

describe("a verified level in the account's state", () => {
  it("is never believed from a browser: what a request names is read as self-reported", async () => {
    const { service } = setup();
    const outcome = await service.sync("u1", {
      gameId: "any-game",
      state: state([record("replay-verified")]),
    });
    expect(outcome).toMatchObject({
      kind: "synced",
      state: {
        milestones: [{ id: "first-win", verification: "self-reported" }],
      },
    });
  });

  it("is kept when a browser later reports the same milestone, with the verified time, not an earlier one", async () => {
    const { repository, service } = setup();
    await repository.change("u1", "any-game", () =>
      state([record("replay-verified", "2026-10-05T00:00:00.000Z")]),
    );
    const outcome = await service.sync("u1", {
      gameId: "any-game",
      state: state([record("self-reported", "2026-10-02T00:00:00.000Z")]),
    });
    expect(outcome).toMatchObject({
      state: {
        milestones: [
          {
            unlockedAt: "2026-10-05T00:00:00.000Z",
            verification: "replay-verified",
          },
        ],
      },
    });
  });

  it("reads every milestone of a state as self-reported, leaving the rest of it alone", () => {
    const input: GameState = {
      counters: [{ current: 2, id: "ten-taps" }],
      milestones: [record("replay-verified"), record("self-reported")],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { a: 1 } },
    };
    expect(asReported(input)).toEqual({
      ...input,
      milestones: [record("self-reported"), record("self-reported")],
    });
  });
});
