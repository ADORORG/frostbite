import { describe, expect, it, vi } from "vitest";

import { createGameClient } from "../src/client.ts";
import { createGameHost } from "../src/host.ts";
import {
  createLocalBackend,
  type KeyValueStorage,
} from "../src/local-backend.ts";
import { playerIdentitySchema, type EventMessage } from "../src/protocol.ts";
import {
  createSyncedBackend,
  type AccountPort,
  type AccountSyncResult,
} from "../src/synced-backend.ts";
import { game, memoryBackend, outcome, request } from "./support.ts";

const accountId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const empty = { milestones: [], progress: null };

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
      "ador:game:other-game:player-id",
      "ador:game:tap-tower:player-id",
    ]);
  });

  it.each([
    ["text that is not an id", JSON.stringify("no")],
    ["a value of the wrong kind", JSON.stringify({ id: 1 })],
    ["text that is not JSON", "not json"],
  ])("is replaced when the stored value is %s", async (_what, stored) => {
    const store = memoryStorage(new Map([["ador:game:g:player-id", stored]]));
    const backend = createLocalBackend({
      gameId: "g",
      newId: () => "fresh-id-0001",
      storage: store,
    });
    expect(await backend.identity()).toEqual({
      id: "fresh-id-0001",
      kind: "local",
    });
    expect(store.map.get("ador:game:g:player-id")).toBe(
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

describe("the host and the client", () => {
  const send = async (
    host: ReturnType<typeof createGameHost>,
    replies: unknown[],
    method: string,
  ) => {
    await host.handle(request(method, {}, method));
    return replies.at(-1) as Parameters<typeof outcome>[0];
  };

  it("answers player.identity once the game is ready, from the backend, and refuses it before", async () => {
    const replies: unknown[] = [];
    const host = createGameHost({
      backend: memoryBackend().backend,
      game,
      reply: (response) => replies.push(response),
    });
    expect(outcome(await send(host, replies, "player.identity"))).toBe(
      "not_ready",
    );
    await host.handle(request("ready", { sdkVersion: 1 }, "ready"));
    const reply = await send(host, replies, "player.identity");
    expect(reply).toMatchObject({
      ok: true,
      result: { id: "local-0001-test", kind: "local" },
    });
  });

  it("never lets an id outside the shape reach the game", async () => {
    const replies: unknown[] = [];
    const host = createGameHost({
      backend: memoryBackend({
        identity: async () => ({ id: "not an id!", kind: "local" }),
      }).backend,
      game,
      reply: (response) => replies.push(response),
    });
    await host.handle(request("ready", { sdkVersion: 1 }, "ready"));
    expect(outcome(await send(host, replies, "player.identity"))).toBe(
      "unavailable",
    );
  });

  it("sends the change as an event to a ready game, and the client hands it to its listeners", async () => {
    const pushed: EventMessage[] = [];
    const host = createGameHost({
      backend: memoryBackend().backend,
      game,
      push: (message) => pushed.push(message),
      reply: () => undefined,
    });
    host.emit("player.changed", { id: accountId, kind: "account" });
    expect(pushed).toEqual([]);
    await host.handle(request("ready", { sdkVersion: 1 }, "ready"));
    host.emit("player.changed", { id: accountId, kind: "account" });
    expect(pushed).toEqual([
      {
        channel: "ador-game",
        data: { id: accountId, kind: "account" },
        event: "player.changed",
        version: 1,
      },
    ]);
    const listeners = new Set<
      (event: { data: unknown; source: unknown }) => void
    >();
    const parent = { postMessage: () => undefined };
    const client = createGameClient({
      host: parent,
      listenOn: {
        addEventListener: (_t, l) => listeners.add(l),
        removeEventListener: (_t, l) => listeners.delete(l),
      },
    });
    const heard = vi.fn();
    client.on("player.changed", heard);
    for (const l of listeners) l({ data: pushed[0], source: parent });
    expect(heard).toHaveBeenCalledWith({ id: accountId, kind: "account" });
  });

  it("asks for the identity through the client", async () => {
    const sent: { id: string; method: string }[] = [];
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
    const pending = client.player.identity();
    expect(sent.at(-1)?.method).toBe("player.identity");
    for (const l of listeners)
      l({
        data: {
          channel: "ador-game",
          id: sent.at(-1)?.id,
          ok: true,
          result: { id: accountId, kind: "account" },
          version: 1,
        },
        source: parent,
      });
    await expect(pending).resolves.toEqual({ id: accountId, kind: "account" });
  });
});
