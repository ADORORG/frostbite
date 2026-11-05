import { describe, expect, it, vi } from "vitest";

import { createGameClient } from "../src/client.ts";
import { createGameHost } from "../src/host.ts";
import { type EventMessage } from "../src/protocol.ts";
import { game, memoryBackend, outcome, request } from "./support.ts";

const accountId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";

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
        channel: "frostbite-game",
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
          channel: "frostbite-game",
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
