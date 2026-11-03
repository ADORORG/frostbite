import { describe, expect, it } from "vitest";

import { startRun, type MatchState } from "../src/rules/state.ts";
import { cellUnder } from "../src/screen/controls.ts";
import { draw } from "../src/screen/draw.ts";
import { sizeOf } from "../src/screen/layout.ts";
import { frostColour, colour } from "../src/screen/palette.ts";
import { fitCanvas, phoneQuery, watchShape } from "../src/screen/shape.ts";
import type { View } from "../src/screen/view.ts";
import { ofColour, surface } from "./support/canvas.ts";

// The tall screen is for a phone held upright: the same board in the same place, the writing in rows under it.
const view = (phase: View["phase"], more: Partial<View> = {}): View => ({
  best: 0,
  cursor: 0,
  grab: -1,
  hint: [],
  newBest: false,
  phase,
  shape: "tall",
  toast: null,
  ...more,
});
const lit = (s: ReturnType<typeof surface>) =>
  s.written.filter(({ fill }) => fill !== colour.back).map(({ text }) => text);

describe("the two shapes", () => {
  it("have a size each: the wide screen is the old one, the tall one is narrower than the board is tall", () => {
    expect(sizeOf("wide")).toEqual({ height: 90, width: 160 });
    expect(sizeOf("tall")).toEqual({ height: 108, width: 90 });
  });

  it("read a touch by the size of the shape being shown", () => {
    // A touch low on the board, on a screen drawn three times as big as the tall one: the wide size would put it a row too high.
    const rect = { height: 324, left: 0, top: 0, width: 270 };
    expect(cellUnder(rect, 18, 240, "tall")).toBe(7 * 8);
    expect(cellUnder(rect, 18, 240)).toBe(6 * 8);
    expect(cellUnder(rect, 18, 340, "tall")).toBe(-1);
  });
});

describe("the page asking for the tall screen", () => {
  const media = (matches: boolean) => {
    const listeners: ((event: { matches: boolean }) => void)[] = [];
    return {
      addEventListener: (
        _type: string,
        listener: (event: { matches: boolean }) => void,
      ) => void listeners.push(listener),
      matches,
      send: (next: boolean) => listeners.forEach((l) => l({ matches: next })),
    };
  };

  it("is wide where nothing can be asked, and follows the query when it can", () => {
    const seen: string[] = [];
    watchShape(null, (shape) => seen.push(shape));
    const phone = media(true);
    watchShape(phone as never, (shape) => seen.push(shape));
    phone.send(false);
    phone.send(true);
    expect(seen).toEqual(["wide", "tall", "wide", "tall"]);
    expect(phoneQuery).toBe("(max-width: 46rem) and (orientation: portrait)");
  });

  it("gives the canvas the pixels of its shape and says which it is", () => {
    const canvas = { dataset: { shape: "" }, height: 0, width: 0 };
    fitCanvas(canvas, "tall");
    expect([canvas.width, canvas.height, canvas.dataset.shape]).toEqual([
      360,
      432,
      "tall",
    ]);
    fitCanvas(canvas, "wide");
    expect([canvas.width, canvas.height, canvas.dataset.shape]).toEqual([
      640,
      360,
      "wide",
    ]);
  });
});

describe("the tall screen", () => {
  it("fills its own size, and puts the level, the swaps, the goal and the score in rows under the board", () => {
    const s = surface();
    draw(
      s.context,
      { ...startRun(9), level: 3, levelScore: 900 },
      view("running"),
    );
    expect(s.drawn[0]).toMatchObject({ height: 108, width: 90, x: 0, y: 0 });
    expect(lit(s)).toEqual(
      expect.arrayContaining(["LEVEL 3", "GOAL 1850", "SWAPS 22"]),
    );
    expect(lit(s).some((text) => text.startsWith("SCORE "))).toBe(true);
    // Nothing is written in the wide screen's column on the right.
    expect(lit(s)).not.toContain("BEST 0");
    expect(ofColour(s.drawn, colour.cursor).some(({ y }) => y === 103)).toBe(
      true,
    );
  });

  it("says frost left on an ice level, warns when the swaps are nearly gone, and gives the news the goal's place while it is news", () => {
    const frost = Array.from({ length: 64 }, (_, at) => at < 5);
    const ice: MatchState = { ...startRun(9), frost, level: 2, moves: 2 };
    const s = surface();
    draw(s.context, ice, view("running"));
    expect(lit(s)).toEqual(expect.arrayContaining(["FROST 5 LEFT", "SWAPS 2"]));
    expect(
      s.written.find(
        ({ fill, text }) => text === "SWAPS 2" && fill !== colour.back,
      )?.fill,
    ).toBe(colour.danger);
    expect(ofColour(s.drawn, frostColour).length).toBeGreaterThan(0);
    const news = surface();
    draw(news.context, ice, view("running", { toast: "NO LINE" }));
    expect(lit(news)).toContain("NO LINE");
    expect(lit(news)).not.toContain("FROST 5 LEFT");
  });

  it("has cards of shorter lines that say Start, not Enter", () => {
    const ready = surface();
    draw(ready.context, startRun(9), view("ready"));
    const lines = lit(ready);
    expect(lines).toContain("PRESS START");
    expect(lines.join(" ")).not.toContain("ENTER");
    // Every line fits the narrow screen at the size it is written in.
    expect(Math.max(...lines.map((text) => text.length))).toBeLessThanOrEqual(
      23,
    );
    const over = surface();
    draw(
      over.context,
      {
        ...startRun(9),
        cause: "out",
        ended: true,
        levelsCleared: 4,
        score: 1234,
      },
      view("over"),
    );
    expect(lit(over)).toEqual(
      expect.arrayContaining(["OUT OF SWAPS", "LEVELS 4", "SCORE 1234"]),
    );
    expect(lit(over).join(" ")).toContain("PRESS START TO PLAY AGAIN");
  });
});
