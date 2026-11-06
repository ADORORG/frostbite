import { describe, expect, it, vi } from "vitest";

import {
  createLocalBackend,
  type KeyValueStorage,
} from "../src/local-backend.ts";
import { playerIdentitySchema } from "../src/protocol.ts";
import {
  createSyncedBackend,
  type AccountPort,
  type AccountSyncResult,
} from "../src/synced-backend.ts";

const accountId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const empty = { counters: [], milestones: [], progress: null };

function memoryStorage(map = new Map<string, string>()): KeyValueStorage & {
  readonly map: Map<string, string>;
} {
  return {
    getItem: (key) => map.get(key) ?? null,
    map,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("the identity schema", () => {
  it("takes an opaque id and a kind, and nothing else", () => {
    expect(
      playerIdentitySchema.safeParse({ id: accountId, kind: "account" })
        .success,
    ).toBe(true);
    for (const value of [
      { id: accountId, kind: "guest" },
      { id: "short", kind: "local" },
      { id: "has space in it!", kind: "local" },
      { id: "x".repeat(65), kind: "local" },
      { id: accountId, kind: "local", name: "Ada" },
    ])
      expect(playerIdentitySchema.safeParse(value).success).toBe(false);
  });
});

describe("this browser's id for the player", () => {
  it("is made once, kept under a key for this game alone, and the same on the next visit", async () => {
    const store = memoryStorage();
    let made = 0;
    const open = (gameId: string) =>
      createLocalBackend({
        gameId,
        newId: () => `local-id-${String((made += 1))}-aaaa`,
        storage: store,
      });
    const first = await open("tap-tower").identity();
    expect(first).toEqual({ id: "local-id-1-aaaa", kind: "local" });
    expect(await open("tap-tower").identity()).toEqual(first);
    expect(await open("other-game").identity()).toEqual({
      id: "local-id-2-aaaa",
      kind: "local",
    });
    expect([...store.map.keys()].sort()).toEqual([
      "frostbite:game:other-game:player-id",
      "frostbite:game:tap-tower:player-id",
    ]);
  });

  it.each([
    ["text that is not an id", JSON.stringify("no")],
    ["a value of the wrong kind", JSON.stringify({ id: 1 })],
    ["text that is not JSON", "not json"],
  ])("is replaced when the stored value is %s", async (_what, stored) => {
    const store = memoryStorage(
      new Map([["frostbite:game:g:player-id", stored]]),
    );
    const backend = createLocalBackend({
      gameId: "g",
      newId: () => "fresh-id-0001",
      storage: store,
    });
    expect(await backend.identity()).toEqual({
      id: "fresh-id-0001",
      kind: "local",
    });
    expect(store.map.get("frostbite:game:g:player-id")).toBe(
      JSON.stringify("fresh-id-0001"),
    );
  });

  it("makes a random id of the protocol's shape when none is supplied", async () => {
    const backend = createLocalBackend({
      gameId: "g",
      storage: memoryStorage(),
    });
    const { id } = await backend.identity();
    expect(playerIdentitySchema.safeParse({ id, kind: "local" }).success).toBe(
      true,
    );
    expect((await backend.identity()).id).toBe(id);
  });
});

describe("the id with an account behind it", () => {
  function setup(answer: AccountPort["sync"]) {
    const local = createLocalBackend({
      gameId: "g",
      newId: () => "local-id-0001",
      storage: memoryStorage(),
    });
    const sync = vi.fn<AccountPort["sync"]>(answer);
    const seen: unknown[] = [];
    const backend = createSyncedBackend({
      local,
      onIdentity: (identity) => seen.push(identity),
      remote: { sync },
    });
    return { backend, seen, sync };
  }
  const synced = (playerId = accountId): AccountSyncResult => ({
    kind: "synced",
    playerId,
    state: empty,
  });

  it("is the account's, from the first answer, for a signed-in player; the event repeats what the game already has", async () => {
    const { backend, seen } = setup(async () => synced());
    expect(await backend.identity()).toEqual({
      id: accountId,
      kind: "account",
    });
    expect(seen).toEqual([{ id: accountId, kind: "account" }]);
  });

  it("is this browser's for a player who is signed out, and no change is announced", async () => {
    const { backend, seen } = setup(async () => ({ kind: "signed-out" }));
    expect(await backend.identity()).toEqual({
      id: "local-id-0001",
      kind: "local",
    });
    expect(seen).toEqual([]);
  });

  it("starts as this browser's while the account cannot be reached, and becomes the account's, once, when it can", async () => {
    let up = false;
    const { backend, seen } = setup(async () =>
      up ? synced() : { kind: "failed" },
    );
    expect(await backend.identity()).toEqual({
      id: "local-id-0001",
      kind: "local",
    });
    expect(seen).toEqual([]);
    up = true;
    await backend.saveProgress({ a: 1 }, new Date());
    await backend.saveProgress({ a: 2 }, new Date());
    await vi.waitFor(() =>
      expect(seen).toEqual([{ id: accountId, kind: "account" }]),
    );
    expect(await backend.identity()).toEqual({
      id: accountId,
      kind: "account",
    });
  });

  it("announces the account's id once, not again for each later sync that returns it", async () => {
    const { backend, seen, sync } = setup(async () => synced());
    await backend.identity();
    await backend.saveProgress({ a: 1 }, new Date());
    await backend.saveProgress({ a: 2 }, new Date());
    await vi.waitFor(() => expect(sync.mock.calls.length).toBeGreaterThan(1));
    expect(seen).toEqual([{ id: accountId, kind: "account" }]);
  });

  it("does not wait on the account longer than the first answer takes, and never changes once it is the account's", async () => {
    let calls = 0;
    const { backend, seen } = setup(async () =>
      calls++ === 0 ? synced() : { kind: "failed" },
    );
    await backend.identity();
    await backend.saveProgress({ a: 1 }, new Date());
    await vi.waitFor(() => expect(calls).toBeGreaterThan(1));
    expect(await backend.identity()).toEqual({
      id: accountId,
      kind: "account",
    });
    expect(seen).toHaveLength(1);
  });
});
