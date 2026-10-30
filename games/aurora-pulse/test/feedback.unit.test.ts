import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";
import { multiplierOf, pulseSounds } from "../src/feedback.ts";
import { leadTicks, stageTicks } from "../src/rules/constants.ts";
import { startRun } from "../src/rules/state.ts";

describe("what is heard", () => {
  const base = startRun(1);
  const judged = (
    kind: "good" | "great" | "miss" | "perfect" | "stray",
    lane = 0,
  ) => ({ kind, lane, tick: 5 });
  it("is the lane's note for a tap that hit, with a glint for a perfect one, and a sound of their own for a miss and a stray tap", () => {
    expect(
      pulseSounds(base, { ...base, judged: judged("perfect", 2) }),
    ).toEqual(["lane2", "glint"]);
    expect(pulseSounds(base, { ...base, judged: judged("great", 3) })).toEqual([
      "lane3",
    ]);
    expect(pulseSounds(base, { ...base, judged: judged("good", 0) })).toEqual([
      "lane0",
    ]);
    expect(pulseSounds(base, { ...base, judged: judged("miss") })).toEqual([
      "miss",
    ]);
    expect(pulseSounds(base, { ...base, judged: judged("stray") })).toEqual([
      "stray",
    ]);
  });

  it("is nothing for a verdict that has not changed, and a sound for a new stage and for the end", () => {
    const after = { ...base, judged: judged("perfect") };
    expect(pulseSounds(after, { ...after })).toEqual([]);
    expect(
      pulseSounds(base, { ...base, tick: leadTicks + stageTicks }),
    ).toEqual(["stage"]);
    expect(
      pulseSounds(base, { ...base, tick: leadTicks + stageTicks - 1 }),
    ).toEqual([]);
    expect(pulseSounds(base, { ...base, cause: "faded", ended: true })).toEqual(
      ["lose"],
    );
    expect(
      pulseSounds(base, { ...base, cause: "finished", ended: true }),
    ).toEqual(["win"]);
    expect(
      pulseSounds(
        { ...base, ended: true },
        { ...base, cause: "faded", ended: true },
      ),
    ).toEqual([]);
  });

  it("shows the multiplier a combo has reached", () => {
    expect([0, 9, 10, 79, 80, 500].map(multiplierOf)).toEqual([
      1, 1, 2, 8, 8, 8,
    ]);
  });

  it("has a sound for every one it can ask for, in a track whose steps are half a beat of the chart's", () => {
    for (const name of [
      "lane0",
      "lane1",
      "lane2",
      "lane3",
      "glint",
      "miss",
      "stray",
      "stage",
      "win",
      "lose",
      "milestone",
      "start",
    ])
      expect(Object.keys(effects)).toContain(name);
    expect(track.voices.every(({ notes }) => notes.length === 16)).toBe(true);
    expect(track.tempo).toBe(112.5);
  });
});
