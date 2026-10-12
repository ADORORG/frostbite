import type { GameState } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { createGameSyncService } from "../src/service.ts";
import { createMemoryRepository } from "./support/memory-repository.ts";

const now = new Date("2026-10-12T12:00:00.000Z");
const milestone = (id: string) => ({
  id,
  unlockedAt: "2026-10-01T00:00:00.000Z",
  verification: "self-reported" as const,
});
const state = (overrides: Partial<GameState> = {}): GameState => ({
  milestones: [],
  progress: null,
  ...overrides,
});

function setup(maxProgressBytes = 20) {
  const repository = createMemoryRepository();
  const service = createGameSyncService({
    clock: () => now,
    games: new Map([["tap-tower", new Set(["first-five", "ten-taps"])]]),
    maxProgressBytes,
    repository,
  });
  return { repository, service };
}

describe("syncing a game's state to the account", () => {
  it("stores what arrives and returns the merged state", async () => {
    const { service } = setup();
    const input = state({
      milestones: [milestone("first-five")],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { taps: 5 } },
    });
    expect(
      await service.sync("u1", { gameId: "tap-tower", state: input }),
    ).toEqual({
      kind: "synced",
      state: input,
    });
  });

  it("keeps players apart and merges a second device into the first", async () => {
    const { service } = setup();
    await service.sync("u1", {
      gameId: "tap-tower",
      state: state({ milestones: [milestone("first-five")] }),
    });
    const second = await service.sync("u1", {
      gameId: "tap-tower",
      state: state({ milestones: [milestone("ten-taps")] }),
    });
    expect(second).toMatchObject({ kind: "synced" });
    expect(
      second.kind === "synced" && second.state.milestones.map(({ id }) => id),
    ).toEqual(["first-five", "ten-taps"]);
    const other = await service.sync("u2", {
      gameId: "tap-tower",
      state: state(),
    });
    expect(other).toEqual({ kind: "synced", state: state() });
  });

  it("refuses a game the platform does not list, before touching storage", async () => {
    const { repository, service } = setup();
    expect(
      await service.sync("u1", { gameId: "nope", state: state() }),
    ).toEqual({
      kind: "unknown-game",
    });
    expect(repository.calls).toEqual([]);
  });

  it("refuses a milestone the game never declared, before touching storage", async () => {
    const { repository, service } = setup();
    expect(
      await service.sync("u1", {
        gameId: "tap-tower",
        state: state({
          milestones: [milestone("first-five"), milestone("made-up")],
        }),
      }),
    ).toEqual({ id: "made-up", kind: "unknown-milestone" });
    expect(repository.calls).toEqual([]);
  });

  it("refuses a save over the size limit and accepts one exactly at it", async () => {
    const { repository, service } = setup(10);
    const save = (text: string) =>
      state({ progress: { savedAt: "2026-10-01T00:00:00.000Z", state: text } });
    // JSON text of an 8-character string is 10 bytes with its quotes; 9 characters is 11.
    expect(
      await service.sync("u1", {
        gameId: "tap-tower",
        state: save("123456789"),
      }),
    ).toEqual({ kind: "too-large" });
    expect(repository.calls).toEqual([]);
    expect(
      (
        await service.sync("u1", {
          gameId: "tap-tower",
          state: save("12345678"),
        })
      ).kind,
    ).toBe("synced");
  });

  it("counts bytes, not characters", async () => {
    const { service } = setup(10);
    const save = state({
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: "ééééé" },
    });
    expect(
      await service.sync("u1", { gameId: "tap-tower", state: save }),
    ).toEqual({
      kind: "too-large",
    });
  });
});
