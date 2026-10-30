import { describe, expect, it } from "vitest";

import { lookahead, maxEnergy } from "../src/rules/constants.ts";
import { startRun, type PulseState } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import { comboX, energyFill, verdictTicks } from "../src/screen/hud.ts";
import { hitY, laneWidth, laneX, noteY, topY } from "../src/screen/layout.ts";
import { auroraBands, colour, laneColours } from "../src/screen/palette.ts";
import type { View } from "../src/screen/view.ts";
import { ofColour, surface } from "./support/canvas.ts";
import { withCounts } from "./support/states.ts";

const view = (phase: View["phase"], more: Partial<View> = {}): View => ({
  best: 0,
  newBest: false,
  phase,
  toast: null,
  ...more,
});
const drawn = (state: PulseState, v: View) => {
  const s = surface();
  draw(s.context, state, v);
  return s;
};
const texts = (s: ReturnType<typeof surface>) =>
  s.written.map(({ text }) => text);

describe("the field", () => {
  it("is a back, the bands of the aurora drifting with the tick, four lanes and the line", () => {
    const a = drawn(withCounts({ tick: 10 }), view("running"));
    const b = drawn(withCounts({ tick: 400 }), view("running"));
    expect(a.drawn[0]).toMatchObject({
      fill: colour.back,
      height: 90,
      width: 160,
    });
    for (const fill of auroraBands)
      expect(ofColour(a.drawn, fill)).toHaveLength(2);
    expect(ofColour(a.drawn, auroraBands[0]).map(({ x }) => x)).not.toEqual(
      ofColour(b.drawn, auroraBands[0]).map(({ x }) => x),
    );
    expect(ofColour(a.drawn, colour.panel)).toHaveLength(4);
    expect(
      ofColour(a.drawn, colour.line).filter(
        ({ y, height }) => y === hitY && height === 1,
      ),
    ).toHaveLength(1);
  });

  it("puts each note in its lane's colour at the height of its time, the near ones lower, and not those out of sight", () => {
    const state = withCounts({
      pending: [
        { lane: 0, tick: 100 + lookahead / 2 },
        { lane: 2, tick: 100 },
        { lane: 3, tick: 100 + lookahead },
        { lane: 1, tick: 100 + lookahead + 20 },
        { lane: 1, tick: 100 - 6 },
      ],
      tick: 100,
    });
    const s = drawn(state, view("running"));
    const notes = (lane: number) =>
      ofColour(s.drawn, laneColours[lane] ?? "").filter(
        ({ width, height }) => width === laneWidth - 5 && height === 4,
      );
    expect(notes(0).map(({ y }) => y)).toEqual([
      noteY(lookahead / 2, lookahead) - 2,
    ]);
    expect(notes(2).map(({ y }) => y)).toEqual([hitY - 2]);
    expect(notes(3).map(({ y }) => y)).toEqual([topY - 2]);
    expect(notes(1)).toHaveLength(1);
    expect(notes(1)[0]?.y).toBe(noteY(-6, lookahead) - 2);
    expect(notes(0)[0]?.x).toBe(laneX(0) + 2);
  });

  it("flashes the lane just tapped, for a few ticks, and not another lane", () => {
    const state = withCounts({
      judged: { kind: "perfect", lane: 2, tick: 100 },
      tick: 103,
    });
    const s = drawn(state, view("running"));
    const flash = ofColour(s.drawn, laneColours[2] ?? "").filter(
      ({ alpha }) => alpha === 0.5,
    );
    expect(flash.map(({ x }) => x)).toEqual([laneX(2)]);
    expect(
      ofColour(s.drawn, laneColours[1] ?? "").filter(
        ({ alpha }) => alpha === 0.5,
      ),
    ).toHaveLength(0);
    const old = drawn({ ...state, tick: 106 }, view("running"));
    expect(
      ofColour(old.drawn, laneColours[2] ?? "").filter(
        ({ alpha }) => alpha === 0.5,
      ),
    ).toHaveLength(0);
  });
});

describe("the writing", () => {
  it("says the stage, the score, the best, the combo and its multiplier (only above one), and the keys", () => {
    const state = withCounts({ combo: 25, score: 4321, tick: 96 + 1024 });
    const s = drawn(state, view("running", { best: 9000 }));
    expect(texts(s)).toEqual(
      expect.arrayContaining([
        "STAGE 2",
        "4321",
        "BEST 9000",
        "25",
        "x3",
        "D",
        "F",
        "J",
        "K",
      ]),
    );
    expect(
      texts(drawn(withCounts({ combo: 5 }), view("running"))),
    ).not.toContain("x1");
  });

  it("writes the combo to the right of the lanes, with room for four digits, and not over the energy bar", () => {
    const s = drawn(withCounts({ combo: 3075 }), view("running"));
    const combo = s.written.filter(({ text }) => text === "3075").at(-1);
    expect(combo?.align).toBe("right");
    expect(combo?.x).toBe(comboX);
    // A digit of the size the combo is written in is about six pixels wide.
    expect((combo?.x ?? 0) - 4 * 6).toBeGreaterThanOrEqual(
      laneX(3) + laneWidth,
    );
    expect(comboX).toBeLessThan(160 - 12);
  });

  it("fills the energy bar to its share, and turns it red at twenty or less", () => {
    expect(energyFill(0)).toBe(0);
    expect(energyFill(maxEnergy)).toBe(hitY - topY);
    expect(energyFill(maxEnergy / 2)).toBe((hitY - topY) / 2);
    const at = (energy: number) => {
      const s = drawn(withCounts({ energy }), view("running"));
      return [
        ofColour(s.drawn, colour.danger).length,
        ofColour(s.drawn, colour.perfect).filter(({ width }) => width === 6)
          .length,
      ];
    };
    expect(at(20)).toEqual([1, 0]);
    expect(at(21)).toEqual([0, 1]);
  });

  it("says how the last tap was judged, in a colour of its own, for a while only", () => {
    for (const [kind, said, fill] of [
      ["perfect", "PERFECT", colour.perfect],
      ["great", "GREAT", colour.great],
      ["good", "GOOD", colour.good],
      ["miss", "MISS", colour.danger],
      ["stray", "STRAY", colour.danger],
    ] as const) {
      const s = drawn(
        withCounts({
          judged: { kind, lane: 0, tick: 50 },
          tick: 50 + verdictTicks - 1,
        }),
        view("running"),
      );
      expect(s.written.filter(({ text }) => text === said).at(-1)?.fill).toBe(
        fill,
      );
    }
    const old = drawn(
      withCounts({
        judged: { kind: "perfect", lane: 0, tick: 50 },
        tick: 50 + verdictTicks,
      }),
      view("running"),
    );
    expect(texts(old)).not.toContain("PERFECT");
  });

  it("shows a toast only during a run and until its tick", () => {
    const toast = { text: "Stage 4", until: 200 };
    expect(
      texts(drawn(withCounts({ tick: 199 }), view("running", { toast }))),
    ).toContain("Stage 4");
    expect(
      texts(drawn(withCounts({ tick: 200 }), view("running", { toast }))),
    ).not.toContain("Stage 4");
    expect(
      texts(drawn(withCounts({ tick: 10 }), view("over", { toast }))),
    ).not.toContain("Stage 4");
  });

  it("covers the field with a card before a run and after one, saying how it ended", () => {
    expect(texts(drawn(startRun(9), view("ready")))).toContain("AURORA PULSE");
    expect(texts(drawn(startRun(9), view("running")))).not.toContain(
      "AURORA PULSE",
    );
    for (const [cause, said] of [
      ["faded", "THE LIGHT WENT OUT"],
      ["finished", "TRACK COMPLETE"],
      ["spent", "THE LIGHT WENT OUT"],
    ] as const) {
      const over = drawn(
        withCounts({ cause, score: 450, tick: 96 + 1024 * 3 }),
        view("over", { best: 900 }),
      );
      expect(texts(over)).toEqual(
        expect.arrayContaining([said, "STAGE 4   SCORE 450", "BEST 900"]),
      );
    }
    expect(
      texts(drawn(startRun(9), view("over", { newBest: true }))),
    ).toContain("NEW BEST!");
  });
});
