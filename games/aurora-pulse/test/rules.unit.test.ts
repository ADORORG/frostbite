import type { JsonValue } from "@frostbite/game-sdk/protocol";
import { describe, expect, it } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { pulseRules } from "../src/rules/index.ts";
import { startRun, stageAt, type PulseState } from "../src/rules/state.ts";
import { leadTicks, stageTicks } from "../src/rules/constants.ts";

const init = (seed: number): PulseState => {
  const made = pulseRules.init(seed, {});
  if (!made.ok) throw new Error(made.reason);
  return made.state;
};
const said = (state: PulseState, type: string, data?: JsonValue) => {
  const result = pulseRules.step(
    state,
    data === undefined ? { type } : { data, type },
  );
  return result.ok ? "ok" : result.reason;
};

describe("the stage a run is at", () => {
  it("is the first until the first bar has played its eight bars, and one more for each eight after", () => {
    expect(
      [
        0,
        leadTicks,
        leadTicks + stageTicks - 1,
        leadTicks + stageTicks,
        leadTicks + 5 * stageTicks,
      ].map(stageAt),
    ).toEqual([1, 1, 1, 2, 6]);
  });
});

describe("the rules as the platform replays them", () => {
  it("start from a seed with no settings, and refuse any setting", () => {
    expect(init(5)).toEqual(startRun(5));
    expect(pulseRules.init(5, { speed: 2 })).toEqual({
      ok: false,
      reason: "no such setting: speed",
    });
    expect(pulseRules.id).toBe("aurora-pulse");
    expect(pulseRules.version).toBe(1);
  });

  it("take a tap by its lane and tick, which moves the run on to that tick first", () => {
    const state = init(5);
    const tapped = pulseRules.step(state, {
      data: { lane: 2, tick: 120 },
      type: "hit",
    });
    expect(tapped.ok && tapped.state.tick).toBe(120);
    expect(tapped.ok && tapped.state.inputs).toBe(1);
    const later = pulseRules.step(tapped.ok ? tapped.state : state, {
      data: { lane: 0, tick: 120 },
      type: "hit",
    });
    expect(later.ok && later.state.inputs).toBe(2);
  });

  it("refuse what is not a tap: a bad lane, a bad tick, a tick already past, data of the wrong shape, an input it does not know", () => {
    const state = pulseRules.step(init(5), {
      data: { lane: 1, tick: 200 },
      type: "hit",
    });
    if (!state.ok) throw new Error(state.reason);
    const at = state.state;
    expect(said(at, "hit", { lane: 4, tick: 210 })).toBe(
      "lane must be 0, 1, 2 or 3",
    );
    expect(said(at, "hit", { lane: -1, tick: 210 })).toBe(
      "lane must be 0, 1, 2 or 3",
    );
    expect(said(at, "hit", { lane: 1.5, tick: 210 })).toBe(
      "lane must be 0, 1, 2 or 3",
    );
    expect(said(at, "hit", { lane: "1", tick: 210 })).toBe(
      "lane must be 0, 1, 2 or 3",
    );
    expect(said(at, "hit", { lane: 1, tick: 199 })).toBe(
      "tick 199 is already past",
    );
    expect(said(at, "hit", { lane: 1, tick: 1.5 })).toBe(
      "tick must be a whole number",
    );
    expect(said(at, "hit", { lane: 1, tick: maxTicks + 1 })).toBe(
      `tick must be from 0 to ${String(maxTicks)}`,
    );
    expect(said(at, "hit", { lane: 1 })).toBe(
      "the input takes exactly: lane, tick",
    );
    expect(said(at, "hit")).toBe("the input takes an object");
    expect(said(at, "dance", {})).toBe("no such input: dance");
  });

  it("refuse a tap on a tick after the run has ended on the way there, and any input once it has ended", () => {
    expect(said(init(5), "hit", { lane: 1, tick: 4_000 })).toBe(
      "the run is over",
    );
    expect(said({ ...init(5), ended: true }, "end", { tick: 10 })).toBe(
      "the run has ended",
    );
  });

  it("end the run on `end`, at its tick, and refuse an end in the past or without a tick", () => {
    const ended = pulseRules.step(init(5), {
      data: { tick: 300 },
      type: "end",
    });
    expect(ended.ok && ended.state.ended).toBe(true);
    expect(ended.ok && ended.state.tick).toBe(300);
    expect(said(init(5), "end", { tick: -3 })).toBe(
      `tick must be from 0 to ${String(maxTicks)}`,
    );
    expect(said(init(5), "end", {})).toBe("the input takes exactly: tick");
  });
});
