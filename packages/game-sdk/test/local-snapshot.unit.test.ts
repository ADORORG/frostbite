import { describe, expect, it } from "vitest";

import { createLocalBackend } from "../src/local-backend.ts";

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
const at = new Date("2026-10-12T10:00:00.000Z");

describe("the local backend's snapshot", () => {
  it("is empty for a browser that holds nothing", () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: storage().store,
    });
    expect(backend.snapshot()).toEqual({ milestones: [], progress: null });
  });

  it("dates a save with the time it was made, and lists the milestones", async () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: storage().store,
    });
    await backend.saveProgress({ taps: 3 }, at);
    await backend.unlock("first-five", at);
    expect(backend.snapshot()).toEqual({
      milestones: [
        {
          id: "first-five",
          unlockedAt: at.toISOString(),
          verification: "self-reported",
        },
      ],
      progress: { savedAt: at.toISOString(), state: { taps: 3 } },
    });
  });

  it("treats a save made before saves were dated as the oldest possible, not as none", () => {
    const s = storage();
    s.map.set("ador:game:g:progress", JSON.stringify({ taps: 1 }));
    expect(
      createLocalBackend({ gameId: "g", storage: s.store }).snapshot().progress,
    ).toEqual({ savedAt: "1970-01-01T00:00:00.000Z", state: { taps: 1 } });
  });

  it("keeps a saved JSON null apart from no save", async () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: storage().store,
    });
    await backend.saveProgress(null, at);
    expect(backend.snapshot().progress).toEqual({
      savedAt: at.toISOString(),
      state: null,
    });
  });

  it("treats a corrupt save as none, and a corrupt date as undated", () => {
    const s = storage();
    s.map.set("ador:game:g:progress", "{not json");
    const backend = createLocalBackend({ gameId: "g", storage: s.store });
    expect(backend.snapshot().progress).toBeNull();
    s.map.set("ador:game:g:progress", "5");
    s.map.set("ador:game:g:progress-at", '"yesterday"');
    expect(backend.snapshot().progress?.savedAt).toBe(
      "1970-01-01T00:00:00.000Z",
    );
  });

  it("replaces what it holds with a merged state, which the game then reads", async () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: storage().store,
    });
    backend.replace({
      milestones: [
        {
          id: "ten-taps",
          unlockedAt: at.toISOString(),
          verification: "self-reported",
        },
      ],
      progress: { savedAt: at.toISOString(), state: { taps: 10 } },
    });
    expect(await backend.loadProgress()).toEqual({ taps: 10 });
    expect(Object.keys(await backend.milestones())).toEqual(["ten-taps"]);
    expect(backend.snapshot().progress?.savedAt).toBe(at.toISOString());
  });

  it("leaves a save alone when the merged state has none", async () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: storage().store,
    });
    await backend.saveProgress({ taps: 2 }, at);
    backend.replace({ milestones: [], progress: null });
    expect(await backend.loadProgress()).toEqual({ taps: 2 });
  });
});
