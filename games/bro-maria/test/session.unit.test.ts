import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { broRules } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";
import { sampleRun } from "../src/sample-run.ts";

const sessionOn = (seed = 12, onEarned?: (id: string) => void) =>
  createRunSession({ onEarned, seed });

describe("a run as it is played", () => {
  it("starts at tick zero with nothing earned, and ticks on", () => {
    const session = sessionOn();
    expect(session.state().tick).toBe(0);
    expect(session.earned()).toEqual([]);
    session.tick();
    session.tick();
    expect(session.state().tick).toBe(2);
  });

  it("records a press and a release of a control, but not one that changes nothing", () => {
    const session = sessionOn();
    expect(session.hold("right", false)).toEqual({ ok: true });
    expect(session.hold("right", true)).toEqual({ ok: true });
    expect(session.hold("right", true)).toEqual({ ok: true });
    session.tick();
    expect(session.hold("right", false)).toEqual({ ok: true });
    const record = session.record();
    expect(record.inputs).toEqual([
      { data: { on: 1, tick: 0 }, type: "right" },
      { data: { on: 0, tick: 1 }, type: "right" },
      { data: { tick: 1 }, type: "end" },
    ]);
    expect(record.seed).toBe(12);
    expect(record.gameId).toBe("bro-maria");
  });

  it("closes the run on record, once, and takes no more", () => {
    const session = sessionOn();
    const first = session.record();
    const second = session.record();
    expect(second.inputs).toEqual(first.inputs);
    expect(session.state().ended).toBe(true);
    expect(session.hold("jump", true)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    const ticked = session.state().tick;
    session.tick();
    expect(session.state().tick).toBe(ticked);
  });

  it("closes itself when the hero loses the last life, reaches the goal, or the time is up", () => {
    const lost = sessionOn();
    for (let tick = 0; tick < 40_000 && !lost.state().ended; tick += 1) {
      if (tick === 0) lost.hold("right", true);
      lost.tick();
    }
    expect(lost.state().ended).toBe(true);
    const idle = sessionOn(3);
    for (let tick = 0; tick < maxTicks + 5; tick += 1) idle.tick();
    expect(idle.state().tick).toBe(maxTicks);
    expect(idle.state().ended).toBe(true);
    // ...or, with all six stages cleared, the run closes itself too.
    const won = sessionOn(20_261_030);
    const inputs = sampleRun().inputs;
    let at = 0;
    for (let tick = 0; tick <= maxTicks && !won.state().ended; tick += 1) {
      for (
        let next = inputs[at];
        next !== undefined &&
        next.type !== "end" &&
        (next.data as { tick: number }).tick === tick;
        next = inputs[at]
      ) {
        won.hold(
          next.type as "jump" | "right",
          (next.data as { on: number }).on === 1,
        );
        at += 1;
      }
      won.tick();
    }
    expect(won.state().finishTick).not.toBeNull();
    expect(won.state().ended).toBe(true);
  });

  it("tells once about each mark as it is earned, and the record replays to the same marks", () => {
    const onEarned = vi.fn();
    const session = sessionOn(7919, onEarned);
    session.hold("right", true);
    for (let tick = 0; tick < 400; tick += 1) {
      if (tick % 50 === 0) session.hold("jump", tick % 100 === 0);
      session.tick();
    }
    const earned = session.earned();
    expect(onEarned.mock.calls.map(([id]) => id).sort()).toEqual(
      [...earned].sort(),
    );
    expect(earned).toContain("first-steps");
    const outcome = replayRecord(broRules, session.record());
    expect(outcome.ok && outcome.earned).toEqual(session.earned());
  });
});
