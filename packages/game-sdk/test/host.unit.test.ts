import { describe, expect, it, vi } from "vitest";

import { attachGameHost, createGameHost, type HostEvent } from "../src/host.ts";
import { resolveGameHostPolicy } from "../src/policy.ts";
import type { Response } from "../src/protocol.ts";
import { game, memoryBackend, outcome, request } from "./support.ts";

function setup(
  options: {
    backend?: ReturnType<typeof memoryBackend>;
    policy?: Parameters<typeof resolveGameHostPolicy>[0];
    now?: () => Date;
  } = {},
) {
  const memory = options.backend ?? memoryBackend();
  const replies: Response[] = [];
  const events: HostEvent[] = [];
  const host = createGameHost({
    backend: memory.backend,
    game,
    now: options.now,
    onEvent: (event) => events.push(event),
    policy: resolveGameHostPolicy(options.policy),
    reply: (response) => replies.push(response),
  });
  const send = async (method: string, params: unknown = {}, id = "r1") => {
    await host.handle(request(method, params, id));
    return replies.at(-1);
  };
  return { events, host, memory, replies, send };
}
const ready = (s: ReturnType<typeof setup>) =>
  s.send("ready", { sdkVersion: 1 });

describe("the host", () => {
  it("answers ready with who the game is, what it may save, and what it may know about the player", async () => {
    const s = setup();
    const reply = await ready(s);
    expect(reply).toMatchObject({
      ok: true,
      result: {
        gameId: "tap-tower",
        limits: { progressMaxBytes: 65_536 },
        player: { signedIn: false, walletConnected: false },
        protocolVersion: 1,
      },
    });
    expect(s.events).toEqual([{ type: "ready" }]);
  });

  it("answers nothing until the game has said ready", async () => {
    const s = setup();
    for (const method of [
      "progress.load",
      "progress.save",
      "milestones.list",
      "milestones.unlock",
      "player.info",
    ])
      expect(
        outcome(
          await s.send(
            method,
            method === "progress.save"
              ? { state: 1 }
              : method === "milestones.unlock"
                ? { id: "first-five" }
                : {},
          ),
        ),
      ).toBe("not_ready");
    expect(s.memory.unlocked).toEqual({});
  });

  it("does not answer a message that is not part of the conversation", async () => {
    const s = setup();
    for (const noise of [
      null,
      "text",
      5,
      {},
      { channel: "other" },
      { type: "webpackOk" },
    ])
      await s.host.handle(noise);
    expect(s.replies).toEqual([]);
  });

  it("refuses a method that does not exist, including names an object would inherit", async () => {
    const s = setup();
    await ready(s);
    for (const method of [
      "fetch",
      "wallet.sign",
      "__proto__",
      "constructor",
      "toString",
      "",
    ])
      expect(outcome(await s.send(method))).toBe("unknown_method");
  });

  it("refuses parameters that are not valid for the method", async () => {
    const s = setup();
    await ready(s);
    expect(outcome(await s.send("progress.save", {}))).toBe("invalid_request");
    expect(outcome(await s.send("progress.save", { state: undefined }))).toBe(
      "invalid_request",
    );
    expect(outcome(await s.send("progress.load", { extra: 1 }))).toBe(
      "invalid_request",
    );
    expect(outcome(await s.send("milestones.unlock", { id: 5 }))).toBe(
      "invalid_request",
    );
  });

  it("saves and loads progress, and tells the page when it saved", async () => {
    const s = setup({ now: () => new Date("2026-10-12T10:00:00.000Z") });
    await ready(s);
    expect(await s.send("progress.load")).toMatchObject({
      ok: true,
      result: { state: null },
    });
    expect(
      await s.send("progress.save", { state: { score: 3 } }),
    ).toMatchObject({
      ok: true,
      result: { savedAt: "2026-10-12T10:00:00.000Z" },
    });
    expect(await s.send("progress.load")).toMatchObject({
      result: { state: { score: 3 } },
    });
    expect(s.events).toContainEqual({
      savedAt: "2026-10-12T10:00:00.000Z",
      type: "progress-saved",
    });
  });

  it("refuses a save over the size limit and keeps what was saved before", async () => {
    const s = setup({ policy: { progressMaxBytes: 1_024 } });
    await ready(s);
    await s.send("progress.save", { state: { ok: true } });
    expect(
      outcome(await s.send("progress.save", { state: "x".repeat(1_100) })),
    ).toBe("too_large");
    expect(await s.send("progress.load")).toMatchObject({
      result: { state: { ok: true } },
    });
    // The limit is on bytes, not characters: multi-byte text counts for what it takes.
    expect(
      outcome(await s.send("progress.save", { state: "é".repeat(600) })),
    ).toBe("too_large");
    expect(
      outcome(await s.send("progress.save", { state: "x".repeat(1_000) })),
    ).toBe("ok");
  });

  it("lists the game's declared milestones with the player's status of each", async () => {
    const s = setup();
    await ready(s);
    await s.send("milestones.unlock", { id: "first-five" });
    const reply = await s.send("milestones.list");
    if (reply === undefined || !reply.ok) throw new Error("expected an answer");
    const list = (
      reply.result as {
        milestones: {
          id: string;
          status: string;
          verification: string | null;
          unlockedAt: string | null;
        }[];
      }
    ).milestones;
    expect(list.map(({ id, status }) => [id, status])).toEqual([
      ["first-five", "unlocked"],
      ["ten-taps", "locked"],
    ]);
    expect(list[0]?.verification).toBe("self-reported");
    expect(list[1]).toMatchObject({ unlockedAt: null, verification: null });
  });

  it("unlocks only milestones the game declared, once, and says so on a repeat", async () => {
    const s = setup();
    await ready(s);
    expect(outcome(await s.send("milestones.unlock", { id: "made-up" }))).toBe(
      "unknown_milestone",
    );
    expect(
      await s.send("milestones.unlock", { id: "first-five" }),
    ).toMatchObject({ result: { status: "unlocked" } });
    expect(
      await s.send("milestones.unlock", { id: "first-five" }),
    ).toMatchObject({ result: { status: "already-unlocked" } });
    expect(Object.keys(s.memory.unlocked)).toEqual(["first-five"]);
    // The page hears of the unlock once.
    expect(
      s.events.filter(({ type }) => type === "milestone-unlocked"),
    ).toEqual([{ id: "first-five", type: "milestone-unlocked" }]);
  });

  it("limits saves and unlocks a minute, each on its own count, and starts again a minute later", async () => {
    let clock = new Date("2026-10-12T10:00:00.000Z");
    const s = setup({
      now: () => clock,
      policy: { saveCallsPerMinute: 2, unlockCallsPerMinute: 1 },
    });
    await ready(s);
    expect(outcome(await s.send("progress.save", { state: 1 }))).toBe("ok");
    expect(outcome(await s.send("progress.save", { state: 2 }))).toBe("ok");
    expect(outcome(await s.send("progress.save", { state: 3 }))).toBe(
      "rate_limited",
    );
    expect(
      outcome(await s.send("milestones.unlock", { id: "first-five" })),
    ).toBe("ok");
    expect(outcome(await s.send("milestones.unlock", { id: "ten-taps" }))).toBe(
      "rate_limited",
    );
    clock = new Date("2026-10-12T10:01:01.000Z");
    expect(outcome(await s.send("progress.save", { state: 4 }))).toBe("ok");
    expect(outcome(await s.send("milestones.unlock", { id: "ten-taps" }))).toBe(
      "ok",
    );
  });

  it("reports a failing backend as unavailable and never says why", async () => {
    const s = setup({
      backend: memoryBackend({
        loadProgress: async () => {
          throw new Error("disk full at /var/secret");
        },
      }),
    });
    await ready(s);
    const reply = await s.send("progress.load");
    expect(outcome(reply)).toBe("unavailable");
    expect(JSON.stringify(reply)).not.toContain("secret");
  });

  it("refuses to hand back something the protocol does not allow, even from a faulty backend", async () => {
    const s = setup({
      backend: memoryBackend({
        player: () =>
          ({
            signedIn: true,
            walletConnected: true,
            address: "bc1q...",
          }) as never,
      }),
    });
    expect(outcome(await ready(s))).toBe("unavailable");
  });

  it("tells the page when it refuses something", async () => {
    const s = setup();
    await s.send("progress.load");
    expect(s.events).toContainEqual({
      code: "not_ready",
      method: "progress.load",
      type: "refused",
    });
  });

  it("answers the same request id it was sent", async () => {
    const s = setup();
    await s.send("ready", { sdkVersion: 1 }, "abc-123");
    expect(s.replies.at(-1)).toMatchObject({ id: "abc-123" });
  });

  it("can be used with no event listener, a default clock and a default policy", async () => {
    const replies: Response[] = [];
    const host = createGameHost({
      backend: memoryBackend().backend,
      game,
      reply: (r) => replies.push(r),
    });
    await host.handle(request("ready", { sdkVersion: 1 }));
    await host.handle(request("progress.save", { state: 1 }));
    expect(replies.map(outcome)).toEqual(["ok", "ok"]);
  });
});

describe("attaching the host to a game's frame", () => {
  function windowStub() {
    const listeners = new Set<
      (event: { data: unknown; source: unknown }) => void
    >();
    return {
      add: (
        _type: "message",
        listener: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.add(listener),
      listeners,
      remove: (
        _type: "message",
        listener: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.delete(listener),
      send: (event: { data: unknown; source: unknown }) =>
        listeners.forEach((listener) => listener(event)),
    };
  }

  it("hands the host only messages from the game's own frame, and stops when detached", async () => {
    const handle = vi.fn(async () => undefined);
    const frame = {};
    const page = windowStub();
    const detach = attachGameHost({
      frame,
      host: { handle },
      listenOn: {
        addEventListener: page.add,
        removeEventListener: page.remove,
      },
    });
    page.send({ data: "from the frame", source: frame });
    page.send({ data: "from another window", source: {} });
    page.send({ data: "from nowhere", source: null });
    expect(handle.mock.calls).toEqual([["from the frame"]]);
    detach();
    expect(page.listeners.size).toBe(0);
    page.send({ data: "after", source: frame });
    expect(handle).toHaveBeenCalledOnce();
  });
});
