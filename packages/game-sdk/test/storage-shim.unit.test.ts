import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JsonValue } from "../src/protocol.ts";
import { createPlatformStorage } from "../src/storage-shim.ts";

function fakeClient(initial: JsonValue | null = null) {
  const saves: JsonValue[] = [];
  const client = {
    progress: {
      load: vi.fn(async () => initial),
      save: vi.fn(async (state: JsonValue) => void saves.push(state)),
    },
  };
  return { client, saves };
}
const keys = ["levels", "votes"] as const;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the storage a game is given instead of localStorage", () => {
  it("starts empty when nothing was saved, and reads back what the game sets", async () => {
    const { client } = fakeClient();
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    expect(storage.getItem("levels")).toBeNull();
    expect(storage.length).toBe(0);
    storage.setItem("levels", "3");
    storage.setItem("scratch", "x");
    expect(storage.getItem("levels")).toBe("3");
    expect(storage.length).toBe(2);
    expect(storage.key(0)).toBe("levels");
    expect(storage.key(5)).toBeNull();
  });

  it("restores the saved keys it persists, and ignores anything else in the save", async () => {
    const { client } = fakeClient({
      storage: { levels: "7", forgotten: "old" },
    });
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    expect(storage.getItem("levels")).toBe("7");
    expect(storage.getItem("forgotten")).toBeNull();
  });

  it("treats a save it did not write, or one that cannot be read, as nothing", async () => {
    for (const initial of [{ other: 1 }, "text", { storage: { a: 1 } }, null]) {
      const { client } = fakeClient(initial as JsonValue);
      const storage = await createPlatformStorage({
        client,
        persistedKeys: keys,
      });
      expect(storage.length).toBe(0);
    }
    const failing = {
      progress: {
        load: async () => {
          throw new Error("down");
        },
        save: async () => undefined,
      },
    };
    expect(
      (await createPlatformStorage({ client: failing, persistedKeys: keys }))
        .length,
    ).toBe(0);
  });

  it("saves only the persisted keys, once after a burst of changes", async () => {
    const { client, saves } = fakeClient();
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
      saveDelayMs: 500,
    });
    storage.setItem("levels", "1");
    storage.setItem("levels", "2");
    storage.setItem("scratch", "kept only for the visit");
    await vi.advanceTimersByTimeAsync(499);
    expect(saves).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual([{ storage: { levels: "2" } }]);
  });

  it("does not save for a change to a key it does not persist", async () => {
    const { client, saves } = fakeClient();
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    storage.setItem("scratch", "x");
    storage.removeItem("scratch");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(saves).toEqual([]);
    expect(storage.getItem("scratch")).toBeNull();
  });

  it("saves a removal and a clear", async () => {
    const { client, saves } = fakeClient({
      storage: { levels: "1", votes: "2" },
    });
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    storage.removeItem("votes");
    storage.removeItem("never-set");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saves).toEqual([{ storage: { levels: "1" } }]);
    storage.clear();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saves.at(-1)).toEqual({ storage: {} });
    expect(storage.length).toBe(0);
  });

  it("turns a value into text, as storage does", async () => {
    const { client } = fakeClient();
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    storage.setItem("levels", 5 as unknown as string);
    expect(storage.getItem("levels")).toBe("5");
  });

  it("flush saves at once what is waiting, and waits for a save under way", async () => {
    const { client, saves } = fakeClient();
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    await storage.flush();
    expect(saves).toEqual([]);
    storage.setItem("levels", "9");
    await storage.flush();
    expect(saves).toEqual([{ storage: { levels: "9" } }]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(saves).toHaveLength(1);
  });

  it("keeps the values and tries again with the next change when a save is refused", async () => {
    const saves: JsonValue[] = [];
    let refuse = true;
    const client = {
      progress: {
        load: async () => null,
        save: async (state: JsonValue) => {
          if (refuse) throw new Error("too large");
          saves.push(state);
        },
      },
    };
    const storage = await createPlatformStorage({
      client,
      persistedKeys: keys,
    });
    storage.setItem("levels", "1");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(storage.getItem("levels")).toBe("1");
    refuse = false;
    storage.setItem("votes", "2");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saves).toEqual([{ storage: { levels: "1", votes: "2" } }]);
  });
});
