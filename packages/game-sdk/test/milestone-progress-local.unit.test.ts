import { describe, expect, it } from "vitest";

import { createGameClient } from "../src/client.ts";
import {
  createLocalBackend,
  type KeyValueStorage,
} from "../src/local-backend.ts";

describe("the browser's own record", () => {
  const store = (
    map = new Map<string, string>(),
  ): KeyValueStorage & { map: Map<string, string> } => ({
    getItem: (key) => map.get(key) ?? null,
    map,
    setItem: (key, value) => void map.set(key, value),
  });
  const at = new Date("2026-10-13T10:00:00.000Z");

  it("keeps the larger total, never above the target, and earns the milestone once when it is reached", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: store() });
    expect(await backend.reportProgress("w", 4, 10, at)).toEqual({
      current: 4,
      newlyUnlocked: false,
      unlockedAt: null,
    });
    expect(await backend.reportProgress("w", 2, 10, at)).toMatchObject({
      current: 4,
    });
    expect(await backend.reportProgress("w", 50, 10, at)).toEqual({
      current: 10,
      newlyUnlocked: true,
      unlockedAt: at.toISOString(),
    });
    expect(
      await backend.reportProgress("w", 50, 10, new Date("2027-01-01")),
    ).toEqual({
      current: 10,
      newlyUnlocked: false,
      unlockedAt: at.toISOString(),
    });
    expect(await backend.counters()).toEqual({ w: 10 });
    expect((await backend.milestones()).w?.count).toBe(1);
  });

  it("counts a repeat up to the maximum and no further, and a milestone earned once not at all", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: store() });
    const results = [];
    for (let call = 0; call < 4; call += 1)
      results.push(await backend.unlock("w", at, 3));
    expect(results.map(({ count, counted }) => [count, counted])).toEqual([
      [1, false],
      [2, true],
      [3, true],
      [3, false],
    ]);
    expect(await backend.unlock("once", at, 1)).toMatchObject({
      alreadyUnlocked: false,
      count: 1,
    });
    expect(await backend.unlock("once", at, 1)).toMatchObject({
      alreadyUnlocked: true,
      count: 1,
      counted: false,
    });
  });

  it("reads a record written before milestones were counted as earned once, and a damaged total as none", async () => {
    const legacy = new Map([
      [
        "frostbite:game:g:milestones",
        JSON.stringify({
          old: { unlockedAt: at.toISOString(), verification: "self-reported" },
        }),
      ],
      ["frostbite:game:g:counters", "not json"],
    ]);
    const backend = createLocalBackend({ gameId: "g", storage: store(legacy) });
    expect((await backend.milestones()).old?.count).toBe(1);
    expect(await backend.counters()).toEqual({});
    expect(backend.snapshot().counters).toEqual([]);
  });

  it("carries the totals and counts in the snapshot, and takes them back from the account", async () => {
    const backend = createLocalBackend({ gameId: "g", storage: store() });
    await backend.reportProgress("w", 3, 10, at);
    await backend.unlock("a", at, 5);
    await backend.unlock("a", at, 5);
    const snapshot = backend.snapshot();
    expect(snapshot.counters).toEqual([{ current: 3, id: "w" }]);
    expect(snapshot.milestones).toEqual([
      {
        count: 2,
        id: "a",
        unlockedAt: at.toISOString(),
        verification: "self-reported",
      },
    ]);
    const other = createLocalBackend({ gameId: "g", storage: store() });
    other.replace({ ...snapshot, counters: [{ current: 8, id: "w" }] });
    expect(await other.counters()).toEqual({ w: 8 });
    expect((await other.milestones()).a?.count).toBe(2);
  });
});

describe("the client", () => {
  it("reports a total and reads the counts through the protocol", async () => {
    const sent: { id: string; method: string; params: unknown }[] = [];
    const listeners = new Set<
      (event: { data: unknown; source: unknown }) => void
    >();
    const parent = {
      postMessage: (m: unknown) => void sent.push(m as (typeof sent)[number]),
    };
    const client = createGameClient({
      host: parent,
      listenOn: {
        addEventListener: (_t, l) => listeners.add(l),
        removeEventListener: (_t, l) => listeners.delete(l),
      },
    });
    const answer = (result: unknown) =>
      listeners.forEach((l) =>
        l({
          data: {
            channel: "frostbite-game",
            id: sent.at(-1)?.id,
            ok: true,
            result,
            version: 1,
          },
          source: parent,
        }),
      );
    const progress = client.milestones.progress("ten-wins", 4);
    expect(sent.at(-1)).toMatchObject({
      method: "milestones.progress",
      params: { current: 4, id: "ten-wins" },
    });
    answer({ current: 4, status: "locked", target: 10, unlockedAt: null });
    await expect(progress).resolves.toEqual({
      current: 4,
      status: "locked",
      target: 10,
      unlockedAt: null,
    });
    const counts = client.milestones.counts();
    expect(sent.at(-1)?.method).toBe("milestones.counts");
    answer({
      counts: [{ count: 0, current: 4, id: "ten-wins", max: null, target: 10 }],
    });
    await expect(counts).resolves.toEqual([
      { count: 0, current: 4, id: "ten-wins", max: null, target: 10 },
    ]);
  });
});
