import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { pulseRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";
import { createPulseSession } from "../src/session.ts";
import { play } from "./support/bots.ts";

// Plays a bot's taps into a session, ticking between them.
function replayInto(
  seed: number,
  taps: readonly { lane: number; tick: number }[],
  until: number,
  onEarned?: (id: string) => void,
) {
  const session = createPulseSession({
    ...(onEarned === undefined ? {} : { onEarned }),
    seed,
  });
  for (let tick = 1; tick <= until && !session.state().ended; tick += 1) {
    session.tick();
    for (const tap of taps.filter((candidate) => candidate.tick === tick))
      session.press(tap.lane);
  }
  return session;
}

describe("a session", () => {
  it("records the taps the rules accept with the tick they were made on, and closes the record with the tick the run had reached", () => {
    const session = createPulseSession({ seed: 7 });
    for (let at = 0; at < 100; at += 1) session.tick();
    expect(session.press(2)).toEqual({ ok: true });
    for (let at = 0; at < 20; at += 1) session.tick();
    const record = session.record();
    expect(record.inputs).toEqual([
      { data: { lane: 2, tick: 100 }, type: "hit" },
      { data: { tick: 120 }, type: "end" },
    ]);
    expect(session.record().inputs).toEqual(record.inputs);
    expect(session.state().tick).toBe(120);
  });

  it("refuses a tap once the run has ended, without recording it", () => {
    const session = createPulseSession({ seed: 7 });
    for (let at = 0; at < 4_000; at += 1) session.tick();
    expect(session.state().cause).toBe("faded");
    const stopped = session.state().tick;
    session.tick();
    expect(session.state().tick).toBe(stopped);
    expect(session.press(1)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(session.record().inputs).toEqual([
      { data: { tick: stopped }, type: "end" },
    ]);
  });

  it("makes a record the platform's replay accepts, even when the run faded after the last tap, and tells the page each milestone once", () => {
    const { state, taps } = play(5, 2.5, 0.25);
    expect(state.cause).toBe("faded");
    const onEarned = vi.fn();
    const session = replayInto(5, taps, 40_000, onEarned);
    expect(session.state()).toEqual(state);
    const record = session.record();
    expect(replayRecord(pulseRules, record)).toMatchObject({
      earned: record.claims,
      ok: true,
    });
    const ids = onEarned.mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...session.earned()].sort());
    expect(ids).toContain("first-hit");
  });
});

describe("the sample run", () => {
  it("is accepted by the rules and earns the milestones it claims", () => {
    const record = sampleRun();
    expect(replayRecord(pulseRules, record)).toMatchObject({
      earned: record.claims,
      ok: true,
    });
    expect(record.claims.length).toBeGreaterThan(10);
  });
});
