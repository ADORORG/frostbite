import { describe, expect, it } from "vitest";

import { frostFor, startRun, type MatchState } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import { progressOf } from "../src/screen/hud.ts";
import { colour } from "../src/screen/palette.ts";
import type { Scene } from "../src/screen/scene.ts";
import type { View } from "../src/screen/view.ts";
import { ofColour, surface } from "./support/canvas.ts";

const view = (phase: View["phase"], more: Partial<View> = {}): View => ({
  best: 0,
  cursor: 0,
  grab: -1,
  hint: [],
  newBest: false,
  phase,
  shape: "wide",
  toast: null,
  ...more,
});
const texts = (s: ReturnType<typeof surface>) =>
  s.written.map(({ text }) => text);
const lit = (s: ReturnType<typeof surface>) =>
  s.written.filter(({ fill }) => fill !== colour.back).map(({ text }) => text);
const frosty = (level: number, left: number): MatchState => {
  const frost = Array.from({ length: 64 }, (_, at) => at < left);
  return { ...startRun(9), frost, level };
};

describe("the writing", () => {
  it("says the level and its goal: a score to make, or frost left to break, with how far along", () => {
    const score = surface();
    draw(
      score.context,
      { ...startRun(9), level: 3, levelScore: 900 },
      view("running"),
    );
    expect(lit(score)).toEqual(
      expect.arrayContaining(["LEVEL 3", "GOAL 1850"]),
    );
    const ice = surface();
    draw(ice.context, frosty(2, 5), view("running"));
    expect(lit(ice)).toEqual(
      expect.arrayContaining(["LEVEL 2", "FROST 5 LEFT"]),
    );
    expect(
      progressOf({ ...startRun(9), level: 1, levelScore: 475 }),
    ).toBeCloseTo(0.5);
    expect(progressOf({ ...startRun(9), level: 1, levelScore: 5_000 })).toBe(1);
    expect(progressOf(frosty(2, 0))).toBe(1);
    expect(
      progressOf({
        ...frosty(2, frostFor(2) / 2),
        frost: Array.from({ length: 64 }, (_, at) => at < frostFor(2) / 2),
      }),
    ).toBeCloseTo(0.5);
    expect(progressOf({ ...startRun(9), level: 2 })).toBe(1);
  });

  it("says the swaps left (red at three or fewer), the score and the best, and the toast during a run", () => {
    const state = { ...startRun(9), moves: 12, score: 4321 };
    const s = surface();
    draw(
      s.context,
      state,
      view("running", { best: 9000, toast: "CHAIN x3  +120" }),
    );
    expect(lit(s)).toEqual(
      expect.arrayContaining(["12", "4321", "BEST 9000", "CHAIN x3  +120"]),
    );
    const idle = surface();
    draw(idle.context, state, view("over", { toast: "CHAIN x3  +120" }));
    expect(texts(idle)).not.toContain("CHAIN x3  +120");
    const colourOf = (moves: number) => {
      const t = surface();
      draw(t.context, { ...state, moves }, view("running"));
      return t.written.filter(({ text }) => text === String(moves)).at(-1)
        ?.fill;
    };
    expect(colourOf(4)).toBe(colour.grab);
    expect(colourOf(3)).toBe(colour.danger);
  });

  it("writes what a playback says instead: the score and swaps of the scene, and the praise (until it fades), and the level banner with the bonus", () => {
    const state = { ...startRun(9), level: 2, moves: 20, score: 100 };
    const scene = (over: Partial<Scene>): Scene => ({
      banner: false,
      moves: 7,
      pieces: [],
      praise: null,
      score: 321,
      shake: 0,
      sparks: [],
      ...over,
    });
    const a = surface();
    draw(
      a.context,
      state,
      view("running"),
      scene({ praise: { age: 2, text: "TASTY!" } }),
    );
    expect(lit(a)).toEqual(expect.arrayContaining(["321", "7", "TASTY!"]));
    const b = surface();
    draw(b.context, state, view("running"), scene({ banner: true }), 250);
    expect(lit(b)).toEqual(
      expect.arrayContaining(["LEVEL 1", "CLEARED!", "SWAP BONUS +250"]),
    );
    const c = surface();
    draw(c.context, state, view("running"), scene({ banner: true }), 0);
    expect(texts(c).some((t) => t.startsWith("SWAP BONUS"))).toBe(false);
    const d = surface();
    draw(d.context, state, view("running"), scene({}), 0);
    expect(lit(d)).not.toContain("CLEARED!");
  });

  it("draws the confetti of a playback as small squares that grow smaller as they age, and none once gone", () => {
    const particle = { fill: "#123456", vx: 0, vy: 0, x: 40, y: 40 };
    const young = surface();
    draw(young.context, startRun(9), view("running"), {
      banner: false,
      moves: 1,
      pieces: [],
      praise: null,
      score: 0,
      shake: 0,
      sparks: [{ age: 2, particle }],
    });
    expect(ofColour(young.drawn, "#123456")).toEqual([
      expect.objectContaining({ height: 2, width: 2 }),
    ]);
    const old = surface();
    draw(old.context, startRun(9), view("running"), {
      banner: false,
      moves: 1,
      pieces: [],
      praise: null,
      score: 0,
      shake: 0,
      sparks: [{ age: 20, particle }],
    });
    expect(ofColour(old.drawn, "#123456")).toEqual([
      expect.objectContaining({ height: 1, width: 1 }),
    ]);
    const gone = surface();
    draw(gone.context, startRun(9), view("running"), {
      banner: false,
      moves: 1,
      pieces: [],
      praise: null,
      score: 0,
      shake: 0,
      sparks: [{ age: 40, particle }],
    });
    expect(ofColour(gone.drawn, "#123456")).toHaveLength(0);
  });

  it("covers the board with a card before a run and after one, saying how it ended", () => {
    expect(texts(draw0(startRun(9), view("ready")))).toContain("SHARD MATCH");
    expect(texts(draw0(startRun(9), view("running")))).not.toContain(
      "SHARD MATCH",
    );
    const over = draw0(
      { ...startRun(9), cause: "out", levelsCleared: 4, score: 450 },
      view("over", { best: 900 }),
    );
    expect(texts(over)).toEqual(
      expect.arrayContaining([
        "OUT OF SWAPS",
        "LEVELS 4   SCORE 450",
        "BEST 900",
      ]),
    );
    expect(
      texts(
        draw0(
          { ...startRun(9), cause: "spent" },
          view("over", { newBest: true }),
        ),
      ),
    ).toEqual(expect.arrayContaining(["WHAT A RUN!", "NEW BEST!"]));
  });
});

function draw0(state: MatchState, v: View) {
  const s = surface();
  draw(s.context, state, v);
  return s;
}
