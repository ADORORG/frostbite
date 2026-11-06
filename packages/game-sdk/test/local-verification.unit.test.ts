import { describe, expect, it } from "vitest";

import { createLocalBackend } from "../src/local-backend.ts";

const storage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};
const record = (verification: string) => ({
  count: 1,
  id: "first-win",
  unlockedAt: "2026-10-01T00:00:00.000Z",
  verification,
});

describe("the browser's copy of a milestone the account verified", () => {
  it("keeps the replay-verified level the account gave it, and tells the game", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: storage() });
    backend.replace({
      counters: [],
      milestones: [
        { ...record("replay-verified"), verification: "replay-verified" },
      ],
      progress: null,
    });
    expect((await backend.milestones())["first-win"]).toEqual({
      count: 1,
      unlockedAt: "2026-10-01T00:00:00.000Z",
      verification: "replay-verified",
    });
    expect(backend.snapshot().milestones).toEqual([record("replay-verified")]);
  });

  it("treats a stored level it does not know as a corrupt value, not a milestone", async () => {
    const store = storage();
    store.setItem(
      "frostbite:game:g:milestones",
      JSON.stringify({ "first-win": { ...record("trusted"), id: undefined } }),
    );
    const backend = createLocalBackend({ gameId: "g", storage: store });
    expect(await backend.milestones()).toEqual({});
  });
});

describe("adopting what the account verified", () => {
  const verified = {
    count: 1,
    id: "first-win",
    unlockedAt: "2026-10-05T00:00:00.000Z",
    verification: "replay-verified" as const,
  };

  it("sets a reported milestone to the account's verified record, with the larger count", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: storage() });
    await backend.unlock("first-win", new Date("2026-10-09T00:00:00.000Z"), 3);
    await backend.unlock("first-win", new Date("2026-10-09T00:00:00.000Z"), 3);
    backend.adoptVerified([{ ...verified, count: 1 }]);
    expect((await backend.milestones())["first-win"]).toEqual({
      count: 2,
      unlockedAt: verified.unlockedAt,
      verification: "replay-verified",
    });
  });

  it("adds a milestone the browser never held, and ignores reported ones and the rest of the state", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: storage() });
    await backend.saveProgress({ a: 1 }, new Date("2026-10-09T00:00:00.000Z"));
    backend.adoptVerified([
      verified,
      { ...verified, id: "other", verification: "self-reported" },
    ]);
    expect(Object.keys(await backend.milestones())).toEqual(["first-win"]);
    expect(await backend.loadProgress()).toEqual({ a: 1 });
  });

  it("keeps the verified level when the game reports the milestone again", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: storage() });
    backend.adoptVerified([verified]);
    await backend.unlock("first-win", new Date("2026-10-12T00:00:00.000Z"), 1);
    expect((await backend.milestones())["first-win"]).toMatchObject({
      unlockedAt: verified.unlockedAt,
      verification: "replay-verified",
    });
  });
});
