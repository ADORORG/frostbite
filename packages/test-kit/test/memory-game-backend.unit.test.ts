import { describe, expect, it } from "vitest";

import { createMemoryGameBackend } from "../src/memory-game-backend.ts";

const now = new Date("2026-10-16T10:00:00.000Z");
const later = new Date("2026-10-16T11:00:00.000Z");

describe("memory game backend", () => {
  it("holds saved progress and answers as a signed-out local player", async () => {
    const { backend } = createMemoryGameBackend();
    expect(await backend.loadProgress()).toBeNull();
    await backend.saveProgress({ level: 2 }, now);
    expect(await backend.loadProgress()).toEqual({ level: 2 });
    expect(backend.player()).toEqual({
      signedIn: false,
      walletConnected: false,
    });
    expect(await backend.identity()).toEqual({
      id: "memory-player-0001",
      kind: "local",
    });
  });

  it("unlocks once, then counts each further earning up to the maximum", async () => {
    const { backend, unlocked } = createMemoryGameBackend();
    expect(await backend.unlock("m", now, 2)).toEqual({
      alreadyUnlocked: false,
      count: 1,
      counted: false,
      unlockedAt: now.toISOString(),
    });
    expect(await backend.unlock("m", later, 2)).toEqual({
      alreadyUnlocked: true,
      count: 2,
      counted: true,
      unlockedAt: now.toISOString(),
    });
    expect(await backend.unlock("m", later, 2)).toMatchObject({
      count: 2,
      counted: false,
    });
    expect(await backend.milestones()).toEqual(unlocked);
  });

  it("keeps progress toward a target, never past it nor backwards, and unlocks on reaching it", async () => {
    const { backend, totals } = createMemoryGameBackend();
    expect(await backend.reportProgress("p", 2, 5, now)).toEqual({
      current: 2,
      newlyUnlocked: false,
      unlockedAt: null,
    });
    expect((await backend.reportProgress("p", 1, 5, now)).current).toBe(2);
    expect(await backend.reportProgress("p", 9, 5, now)).toEqual({
      current: 5,
      newlyUnlocked: true,
      unlockedAt: now.toISOString(),
    });
    expect(await backend.reportProgress("p", 5, 5, later)).toEqual({
      current: 5,
      newlyUnlocked: false,
      unlockedAt: now.toISOString(),
    });
    expect(await backend.counters()).toEqual({ p: 5 });
    expect(totals).toEqual({ p: 5 });
  });

  it("lets a test make any call fail on purpose", async () => {
    const { backend } = createMemoryGameBackend({
      loadProgress: async () => {
        throw new Error("offline");
      },
    });
    await expect(backend.loadProgress()).rejects.toThrow("offline");
  });
});
