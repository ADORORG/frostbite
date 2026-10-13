import { describe, expect, it } from "vitest";

import {
  createGameHost,
  type HostedGame,
  type HostEvent,
} from "../src/host.ts";
import { resolveGameHostPolicy } from "../src/policy.ts";
import type { Response } from "../src/protocol.ts";
import { memoryBackend, outcome, request } from "./support.ts";

const milestone = (id: string, extra: object) => ({
  claimPolicy: "once" as const,
  criteria: "Do it.",
  description: "Did it.",
  id,
  title: id,
  ...extra,
});
const counted: HostedGame = {
  id: "tap-tower",
  milestones: [
    milestone("ten-wins", { target: 10 }),
    milestone("first-win", {}),
    milestone("a-win", { claimPolicy: "repeatable", maxCount: 3 }),
  ],
};

function setup(options: { progressCalls?: number } = {}) {
  const memory = memoryBackend();
  const replies: Response[] = [];
  const events: HostEvent[] = [];
  const host = createGameHost({
    backend: memory.backend,
    game: counted,
    now: () => new Date("2026-10-13T10:00:00.000Z"),
    onEvent: (event) => events.push(event),
    policy: resolveGameHostPolicy(
      options.progressCalls === undefined
        ? {}
        : { progressCallsPerMinute: options.progressCalls },
    ),
    reply: (response) => replies.push(response),
  });
  const send = async (method: string, params: unknown = {}, id = "r1") => {
    await host.handle(request(method, params, id));
    return replies.at(-1);
  };
  return { events, memory, send };
}
const ready = (s: ReturnType<typeof setup>) =>
  s.send("ready", { sdkVersion: 1 });

describe("progress toward a target", () => {
  it("holds the total the game reports and says what is left, earning the milestone when the total reaches the target", async () => {
    const s = setup();
    await ready(s);
    expect(
      await s.send("milestones.progress", { current: 4, id: "ten-wins" }),
    ).toMatchObject({
      ok: true,
      result: { current: 4, status: "locked", target: 10, unlockedAt: null },
    });
    expect(
      await s.send("milestones.progress", { current: 10, id: "ten-wins" }),
    ).toMatchObject({
      ok: true,
      result: {
        current: 10,
        status: "unlocked",
        target: 10,
        unlockedAt: "2026-10-13T10:00:00.000Z",
      },
    });
    expect(
      s.events.filter(({ type }) => type === "milestone-unlocked"),
    ).toEqual([{ id: "ten-wins", type: "milestone-unlocked" }]);
  });

  it("never lowers the total, so a late or repeated report changes nothing", async () => {
    const s = setup();
    await ready(s);
    await s.send("milestones.progress", { current: 7, id: "ten-wins" });
    expect(
      await s.send("milestones.progress", { current: 3, id: "ten-wins" }),
    ).toMatchObject({
      result: { current: 7 },
    });
    expect(
      await s.send("milestones.progress", { current: 7, id: "ten-wins" }),
    ).toMatchObject({
      result: { current: 7 },
    });
  });

  it("holds no more than the target, and earns the milestone once however far past it the game reports", async () => {
    const s = setup();
    await ready(s);
    expect(
      await s.send("milestones.progress", { current: 999, id: "ten-wins" }),
    ).toMatchObject({
      result: { current: 10, status: "unlocked" },
    });
    await s.send("milestones.progress", { current: 1000, id: "ten-wins" });
    expect(
      s.events.filter(({ type }) => type === "milestone-unlocked"),
    ).toHaveLength(1);
  });

  it("is refused for a milestone the game never declared, one with no target, and parameters that are not valid", async () => {
    const s = setup();
    await ready(s);
    expect(
      outcome(
        await s.send("milestones.progress", { current: 1, id: "made-up" }),
      ),
    ).toBe("unknown_milestone");
    expect(
      outcome(
        await s.send("milestones.progress", { current: 1, id: "first-win" }),
      ),
    ).toBe("invalid_request");
    expect(
      outcome(await s.send("milestones.progress", { current: 1, id: "a-win" })),
    ).toBe("invalid_request");
    for (const params of [
      { current: -1, id: "ten-wins" },
      { current: 1.5, id: "ten-wins" },
      { current: 1_000_001, id: "ten-wins" },
      { id: "ten-wins" },
      { current: 1, id: "ten-wins", extra: 1 },
    ])
      expect(outcome(await s.send("milestones.progress", params))).toBe(
        "invalid_request",
      );
  });

  it("is refused before the game is ready, and past the limit a minute", async () => {
    const early = setup();
    expect(
      outcome(
        await early.send("milestones.progress", { current: 1, id: "ten-wins" }),
      ),
    ).toBe("not_ready");
    const s = setup({ progressCalls: 2 });
    await ready(s);
    expect(
      outcome(
        await s.send("milestones.progress", { current: 1, id: "ten-wins" }),
      ),
    ).toBe("ok");
    expect(
      outcome(
        await s.send("milestones.progress", { current: 2, id: "ten-wins" }),
      ),
    ).toBe("ok");
    expect(
      outcome(
        await s.send("milestones.progress", { current: 3, id: "ten-wins" }),
      ),
    ).toBe("rate_limited");
    expect(s.memory.totals["ten-wins"]).toBe(2);
  });

  it("is not how a milestone with a target is earned directly", async () => {
    const s = setup();
    await ready(s);
    expect(outcome(await s.send("milestones.unlock", { id: "ten-wins" }))).toBe(
      "invalid_request",
    );
    expect(s.memory.unlocked).toEqual({});
  });
});

describe("a repeatable milestone", () => {
  it("is counted each time the game reports it, up to the manifest's maximum, and ignored after", async () => {
    const s = setup();
    await ready(s);
    const unlock = () => s.send("milestones.unlock", { id: "a-win" });
    expect(await unlock()).toMatchObject({ result: { status: "unlocked" } });
    expect(await unlock()).toMatchObject({
      result: { status: "already-unlocked" },
    });
    await unlock();
    await unlock();
    await unlock();
    expect(s.memory.unlocked["a-win"]?.count).toBe(3);
    expect(s.events.filter(({ type }) => type === "milestone-counted")).toEqual(
      [
        { count: 2, id: "a-win", type: "milestone-counted" },
        { count: 3, id: "a-win", type: "milestone-counted" },
      ],
    );
  });

  it("is earned once, and a repeat is not counted, for a milestone earned once", async () => {
    const s = setup();
    await ready(s);
    await s.send("milestones.unlock", { id: "first-win" });
    await s.send("milestones.unlock", { id: "first-win" });
    expect(s.memory.unlocked["first-win"]?.count).toBe(1);
    expect(s.events.some(({ type }) => type === "milestone-counted")).toBe(
      false,
    );
  });
});

describe("the counts", () => {
  it("say, for each milestone, how often it was earned, the total toward its target and its limits", async () => {
    const s = setup();
    await ready(s);
    expect(await s.send("milestones.counts")).toMatchObject({
      result: {
        counts: [
          { count: 0, current: 0, id: "ten-wins", max: null, target: 10 },
          { count: 0, current: null, id: "first-win", max: null, target: null },
          { count: 0, current: null, id: "a-win", max: 3, target: null },
        ],
      },
    });
    await s.send("milestones.progress", { current: 6, id: "ten-wins" });
    await s.send("milestones.unlock", { id: "a-win" });
    await s.send("milestones.unlock", { id: "a-win" });
    expect(await s.send("milestones.counts")).toMatchObject({
      result: {
        counts: [
          { count: 0, current: 6, id: "ten-wins" },
          { count: 0, id: "first-win" },
          { count: 2, id: "a-win" },
        ],
      },
    });
  });

  it("leave the list as it was: the target and the maximum are not in it, so a game on an older SDK still reads it", async () => {
    const s = setup();
    await ready(s);
    const reply = await s.send("milestones.list");
    expect(reply).toMatchObject({ ok: true });
    const first = reply?.ok
      ? (reply.result as { milestones: object[] }).milestones[0]
      : undefined;
    expect(Object.keys(first ?? {}).sort()).toEqual([
      "claimPolicy",
      "criteria",
      "description",
      "id",
      "status",
      "title",
      "unlockedAt",
      "verification",
    ]);
  });
});
