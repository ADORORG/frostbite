import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bundleGameScript } from "../src/build.ts";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "../src/conformance.ts";
import { GameHostError, createGameClient } from "../src/client.ts";
import { createLocalBackend } from "../src/local-backend.ts";
import { game, memoryBackend } from "./support.ts";

const mini = join(import.meta.dirname, "fixtures/mini-game");
let running: SimulatedGame | undefined;
afterEach(() => running?.close());
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

describe("a game built with the SDK, run against a simulated host", () => {
  it("connects, saves, unlocks a milestone and reads its state, with no storage and no network of its own", async () => {
    const script = await bundleGameScript(join(mini, "src/main.ts"));
    const memory = memoryBackend();
    running = runGameInSimulatedHost({
      backend: memory.backend,
      game,
      html: '<!doctype html><body><p id="out">waiting</p></body>',
      script,
    });
    await settle();
    expect(running.window.document.getElementById("out")?.textContent).toBe(
      "done 1 false",
    );
    expect(await memory.backend.loadProgress()).toEqual({ visits: 1 });
    expect(Object.keys(memory.unlocked)).toEqual(["first-five"]);
    expect(running.replies.every((reply) => reply.ok)).toBe(true);
    expect(running.events.map(({ type }) => type)).toEqual([
      "ready",
      "progress-saved",
      "milestone-unlocked",
    ]);
  });

  it("picks up from the progress it saved the last time", async () => {
    const script = await bundleGameScript(join(mini, "src/main.ts"));
    const memory = memoryBackend();
    await memory.backend.saveProgress({ visits: 4 }, new Date());
    running = runGameInSimulatedHost({
      backend: memory.backend,
      game,
      html: '<!doctype html><body><p id="out"></p></body>',
      script,
    });
    await settle();
    expect(await memory.backend.loadProgress()).toEqual({ visits: 5 });
  });

  it("shows what it was told when the platform refuses, instead of hanging", async () => {
    const script = await bundleGameScript(join(mini, "src/main.ts"));
    const memory = memoryBackend({
      unlock: async () => {
        throw new Error("down");
      },
    });
    running = runGameInSimulatedHost({
      backend: memory.backend,
      game,
      html: '<!doctype html><body><p id="out"></p></body>',
      script,
    });
    await settle();
    expect(running.window.document.getElementById("out")?.textContent).toBe(
      "failed The platform could not do that.",
    );
  });

  it("is cut off the way the isolated frame is: no storage, no fetch, no request object", async () => {
    running = runGameInSimulatedHost({
      backend: memoryBackend().backend,
      game,
      html: '<!doctype html><body><p id="out"></p></body>',
      script: `
        const results = [];
        for (const name of ["localStorage", "sessionStorage", "fetch", "XMLHttpRequest"]) {
          try { void window[name]; results.push(name + ": allowed"); } catch { results.push(name + ": blocked"); }
        }
        document.getElementById("out").textContent = results.join(",");
      `,
    });
    expect(running.window.document.getElementById("out")?.textContent).toBe(
      "localStorage: blocked,sessionStorage: blocked,fetch: blocked,XMLHttpRequest: blocked",
    );
  });
});

describe("the client", () => {
  function pair() {
    const listeners = new Set<
      (event: { data: unknown; source: unknown }) => void
    >();
    const sent: unknown[] = [];
    const host = { postMessage: (message: unknown) => void sent.push(message) };
    const listenOn = {
      addEventListener: (
        _t: "message",
        l: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.add(l),
      removeEventListener: (
        _t: "message",
        l: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.delete(l),
    };
    const deliver = (data: unknown, source: unknown = host) =>
      listeners.forEach((l) => l({ data, source }));
    return { deliver, host, listenOn, listeners, sent };
  }
  const answer = (id: string, result: unknown) => ({
    channel: "ador-game",
    id,
    ok: true,
    result,
    version: 1,
  });

  it("sends a request and resolves with the answer to that request only", async () => {
    const p = pair();
    const client = createGameClient({
      host: p.host,
      listenOn: p.listenOn,
      timeoutMs: 500,
    });
    const pending = client.player.info();
    expect(p.sent).toEqual([
      {
        channel: "ador-game",
        id: "r1",
        method: "player.info",
        params: {},
        version: 1,
      },
    ]);
    p.deliver(answer("r9", { signedIn: true, walletConnected: true }));
    p.deliver(answer("r1", { signedIn: false, walletConnected: false }));
    await expect(pending).resolves.toEqual({
      signedIn: false,
      walletConnected: false,
    });
  });

  it("ignores answers from anywhere but the host, and answers that are not valid for the method", async () => {
    const p = pair();
    const client = createGameClient({
      host: p.host,
      listenOn: p.listenOn,
      timeoutMs: 50,
    });
    const pending = client.player.info();
    p.deliver(answer("r1", { signedIn: true, walletConnected: true }), {});
    p.deliver("not an answer");
    await expect(pending).rejects.toMatchObject({ code: "unavailable" });
    const second = client.player.info();
    p.deliver(answer("r2", { signedIn: "yes" }));
    await expect(second).rejects.toMatchObject({
      code: "unavailable",
      message: "The answer was not valid.",
    });
  });

  it("turns a refusal into an error with the platform's code", async () => {
    const p = pair();
    const client = createGameClient({ host: p.host, listenOn: p.listenOn });
    const pending = client.milestones.unlock("nope");
    p.deliver({
      channel: "ador-game",
      error: { code: "unknown_milestone", message: "No such milestone." },
      id: "r1",
      ok: false,
      version: 1,
    });
    const error = await pending.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GameHostError);
    expect(error).toMatchObject({
      code: "unknown_milestone",
      name: "GameHostError",
    });
  });

  it("ends every call that is waiting, and stops listening, when it is disposed", async () => {
    const p = pair();
    const client = createGameClient({ host: p.host, listenOn: p.listenOn });
    const pending = client.progress.load();
    client.dispose();
    await expect(pending).rejects.toMatchObject({
      message: "The game was closed.",
    });
    expect(p.listeners.size).toBe(0);
  });

  it("uses ids it is given, and its own counter otherwise", () => {
    const p = pair();
    const client = createGameClient({
      createId: () => "mine",
      host: p.host,
      listenOn: p.listenOn,
    });
    void client.ready().catch(() => undefined);
    expect(p.sent).toMatchObject([
      { id: "mine", method: "ready", params: { sdkVersion: 1 } },
    ]);
    client.dispose();
  });

  it("covers every call: ready, load, save, list, unlock", async () => {
    const p = pair();
    const client = createGameClient({ host: p.host, listenOn: p.listenOn });
    const calls = [
      client.ready(),
      client.progress.load(),
      client.progress.save({ a: 1 }),
      client.milestones.list(),
      client.milestones.unlock("x"),
    ];
    expect(
      p.sent.map((message) => (message as { method: string }).method),
    ).toEqual([
      "ready",
      "progress.load",
      "progress.save",
      "milestones.list",
      "milestones.unlock",
    ]);
    client.dispose();
    await Promise.allSettled(calls);
  });
});

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
    expect([...s.map.keys()]).toEqual(["ador:game:tap-tower:progress"]);
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
      await backend.unlock("first-five", new Date("2026-10-12T10:00:00.000Z")),
    ).toEqual({
      alreadyUnlocked: false,
      unlockedAt: "2026-10-12T10:00:00.000Z",
    });
    expect(
      await backend.unlock("first-five", new Date("2026-10-13T10:00:00.000Z")),
    ).toEqual({
      alreadyUnlocked: true,
      unlockedAt: "2026-10-12T10:00:00.000Z",
    });
    expect(await backend.milestones()).toEqual({
      "first-five": {
        unlockedAt: "2026-10-12T10:00:00.000Z",
        verification: "self-reported",
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
      expect((await backend.unlock("a", new Date())).alreadyUnlocked).toBe(
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
