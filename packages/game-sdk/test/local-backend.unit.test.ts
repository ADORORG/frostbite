import { describe, expect, it } from "vitest";

import { createLocalBackend } from "../src/local-backend.ts";

describe("the local backend", () => {
  const storage = () => {
    const map = new Map<string, string>();
    return {
      map,
      store: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
      },
    };
  };

  it("keeps progress under keys for the game alone, and gives it back", async () => {
    const s = storage();
    const backend = createLocalBackend({
      gameId: "tap-tower",
      storage: s.store,
    });
    expect(await backend.loadProgress()).toBeNull();
    await backend.saveProgress({ score: 2 }, new Date());
    expect(await backend.loadProgress()).toEqual({ score: 2 });
    expect([...s.map.keys()].sort()).toEqual([
      "ador:game:tap-tower:progress",
      "ador:game:tap-tower:progress-at",
    ]);
    const other = createLocalBackend({
      gameId: "other-game",
      storage: s.store,
    });
    expect(await other.loadProgress()).toBeNull();
  });

  it("records an unlock once, as self-reported, and returns the first time on a repeat", async () => {
    const backend = createLocalBackend({
      gameId: "tap-tower",
      storage: storage().store,
    });
    expect(
      await backend.unlock(
        "first-five",
        new Date("2026-10-12T10:00:00.000Z"),
        1,
      ),
    ).toEqual({
      alreadyUnlocked: false,
      count: 1,
      counted: false,
      unlockedAt: "2026-10-12T10:00:00.000Z",
    });
    expect(
      await backend.unlock(
        "first-five",
        new Date("2026-10-13T10:00:00.000Z"),
        1,
      ),
    ).toEqual({
      alreadyUnlocked: true,
      count: 1,
      counted: false,
      unlockedAt: "2026-10-12T10:00:00.000Z",
    });
    expect(await backend.milestones()).toEqual({
      "first-five": {
        unlockedAt: "2026-10-12T10:00:00.000Z",
        verification: "self-reported",
        count: 1,
      },
    });
  });

  it.each([
    ["text that is not JSON", "{nope"],
    [
      "JSON of the wrong shape",
      JSON.stringify({ "first-five": { unlockedAt: "yesterday" } }),
    ],
    [
      "a claim of a verification that does not exist",
      JSON.stringify({
        a: { unlockedAt: "2026-10-12T10:00:00.000Z", verification: "verified" },
      }),
    ],
  ])(
    "treats %s in storage as nothing rather than trusting or throwing on it",
    async (_why, raw) => {
      const s = storage();
      s.map.set("ador:game:tap-tower:milestones", raw);
      s.map.set(
        "ador:game:tap-tower:progress",
        raw === "{nope" ? raw : "undefined",
      );
      const backend = createLocalBackend({
        gameId: "tap-tower",
        storage: s.store,
      });
      expect(await backend.milestones()).toEqual({});
      expect(await backend.loadProgress()).toBeNull();
      // And the next unlock replaces the bad value.
      expect((await backend.unlock("a", new Date(), 1)).alreadyUnlocked).toBe(
        false,
      );
    },
  );

  it("treats storage that throws as empty", async () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => undefined,
      },
    });
    expect(await backend.loadProgress()).toBeNull();
    expect(await backend.milestones()).toEqual({});
  });

  it("says the player is not signed in unless told otherwise", () => {
    const storageOnly = { gameId: "g", storage: storage().store };
    expect(createLocalBackend(storageOnly).player()).toEqual({
      signedIn: false,
      walletConnected: false,
    });
    expect(
      createLocalBackend({
        ...storageOnly,
        player: () => ({ signedIn: true, walletConnected: false }),
      }).player().signedIn,
    ).toBe(true);
  });
});
