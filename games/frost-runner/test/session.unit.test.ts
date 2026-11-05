import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { runnerRules } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";
import { play } from "./support/bot.ts";

describe("a session", () => {
  it("records only the choices the rules accept, with their ticks, and ends the run when the runner is stopped", () => {
    const session = createRunSession({ seed: 7 });
    session.tick();
    expect(session.jump()).toEqual({ ok: true });
    // In the air a second choice is refused and is not recorded.
    expect(session.slide()).toEqual({ ok: false, reason: "already jumping" });
    while (session.state().alive) session.tick();
    expect(session.state().ended).toBe(true);
    const record = session.record();
    expect(record.inputs[0]).toEqual({ data: { tick: 1 }, type: "jump" });
    expect(record.inputs.at(-1)?.type).toBe("end");
    expect(record.inputs.filter(({ type }) => type === "slide")).toEqual([]);
    expect(session.jump()).toEqual({ ok: false, reason: "the run has ended" });
    expect(session.slide()).toEqual({ ok: false, reason: "the run has ended" });
  });

  it("makes a record the platform's replay accepts, with the same milestones the player saw", () => {
    const onEarned = vi.fn();
    const session = createRunSession({ onEarned, seed: 20_261_015 });
    const { inputs } = play(20_261_015, 520);
    for (const input of inputs.slice(0, -1)) {
      while (session.state().tick < (input.data as { tick: number }).tick)
        session.tick();
      expect(session[input.type as "jump" | "slide"]()).toEqual({ ok: true });
    }
    while (session.state().tick < 520) session.tick();
    const record = session.record();
    expect(record.inputs).toEqual(inputs);
    const outcome = replayRecord(runnerRules, record);
    expect(outcome).toEqual({ earned: record.claims, ok: true });
    expect(onEarned.mock.calls.map(([id]) => id).sort()).toEqual(
      [...record.claims].sort(),
    );
  });

  it("announces each milestone once", () => {
    const onEarned = vi.fn();
    const session = createRunSession({ onEarned, seed: 20_261_015 });
    const { inputs } = play(20_261_015, 400);
    for (const input of inputs.slice(0, -1)) {
      while (session.state().tick < (input.data as { tick: number }).tick)
        session.tick();
      session[input.type as "jump" | "slide"]();
    }
    while (session.state().tick < 400) session.tick();
    const ids = onEarned.mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("first-steps");
  });
});
