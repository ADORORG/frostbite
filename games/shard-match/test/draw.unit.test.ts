import { describe, expect, it } from "vitest";

import { bomb, cells, kindSlots, star } from "../src/rules/constants.ts";
import { startRun, targetOf } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import { progressWidth } from "../src/screen/hud.ts";
import {
  boardX,
  boardY,
  cell,
  cellAt,
  cellX,
  cellY,
} from "../src/screen/layout.ts";
import { colour, kindColours } from "../src/screen/palette.ts";
import type { View } from "../src/screen/view.ts";
import { ofColour, surface } from "./support/canvas.ts";
import { withCounts } from "./support/states.ts";

const view = (phase: View["phase"], more: Partial<View> = {}): View => ({
  best: 0,
  cursor: 0,
  flash: [],
  grab: -1,
  newBest: false,
  phase,
  toast: null,
  ...more,
});
const texts = (s: ReturnType<typeof surface>) =>
  s.written.map(({ text }) => text);

describe("the board", () => {
  it("is drawn cell by cell on a panel, each kind in its colour", () => {
    const state = startRun(9);
    const { context, drawn } = surface();
    draw(context, state, view("running"));
    expect(drawn[0]).toMatchObject({
      fill: colour.back,
      height: 90,
      width: 160,
    });
    expect(ofColour(drawn, colour.panel)[0]).toMatchObject({
      height: 8 * cell + 4,
      width: 8 * cell + 4,
      x: boardX - 2,
      y: boardY - 2,
    });
    for (let kind = 0; kind < 5; kind += 1)
      expect(ofColour(drawn, kindColours[kind] ?? "").length).toBeGreaterThan(
        0,
      );
    expect(cells).toBe(64);
  });

  it("draws each kind as its own shape, not a block: fewer pixels than the whole cell, and a different count for different kinds", () => {
    const pixels = (kind: number): number => {
      const { context, drawn } = surface();
      draw(
        context,
        { ...startRun(9), board: Array.from({ length: 64 }, () => kind) },
        view("ready"),
      );
      const mine = ofColour(drawn, kindColours[kind] ?? "").filter(
        ({ width, height }) => width === 1 && height === 1,
      );
      expect(drawn.filter(({ fill }) => fill === "")).toEqual([]);
      return mine.length / 64;
    };
    const counts = [0, 1, 2, 3, 4, 5].map(pixels);
    for (const count of counts) {
      expect(count).toBeGreaterThan(30);
      expect(count).toBeLessThan(64);
    }
    expect(new Set(counts).size).toBeGreaterThan(3);
  });

  it("frames a bomb in white and a star in gold with a white centre", () => {
    const board = startRun(9).board.map((value, at) =>
      at === 0 ? 2 + bomb * kindSlots : at === 1 ? 3 + star * kindSlots : value,
    );
    const plain = surface();
    draw(plain.context, startRun(9), view("running"));
    const marked = surface();
    draw(marked.context, { ...startRun(9), board }, view("running"));
    const frames = (s: typeof plain, fill: string) =>
      ofColour(s.drawn, fill).filter(
        ({ height, width }) => width === 10 || height === 10,
      );
    expect(frames(marked, colour.white).length).toBeGreaterThan(
      frames(plain, colour.white).length,
    );
    expect(frames(marked, colour.grab).length).toBe(
      frames(plain, colour.grab).length + 4,
    );
    expect(
      ofColour(marked.drawn, colour.white).filter(
        ({ width, height }) => width === 2 && height === 2,
      ),
    ).toHaveLength(1);
  });

  it("flashes the cells just cleared, as white over them, and only while the view says", () => {
    const state = startRun(9);
    const flashing = surface();
    draw(flashing.context, state, view("running", { flash: [10, 11] }));
    const blocks = ofColour(flashing.drawn, colour.white).filter(
      ({ width, height }) => width === cell && height === cell,
    );
    expect(blocks.map(({ x, y }) => [x, y])).toEqual([
      [cellX(10), cellY(10)],
      [cellX(11), cellY(11)],
    ]);
    expect(blocks.every(({ alpha }) => alpha < 1)).toBe(true);
    const still = surface();
    draw(still.context, state, view("running"));
    expect(
      ofColour(still.drawn, colour.white).filter(({ width }) => width === cell),
    ).toHaveLength(0);
  });

  it("frames the cursor, and the shard picked up, only during a run", () => {
    const state = startRun(9);
    const cursor = surface();
    draw(cursor.context, state, view("running", { cursor: 9, grab: 18 }));
    expect(
      ofColour(cursor.drawn, colour.cursor).filter(
        ({ width, height }) => width === cell || height === cell,
      ),
    ).toHaveLength(4);
    expect(
      ofColour(cursor.drawn, colour.grab).filter(
        ({ x, y }) => x === cellX(18) || y === cellY(18),
      ),
    ).not.toHaveLength(0);
    const idle = surface();
    draw(idle.context, state, view("ready", { cursor: 9, grab: 18 }));
    expect(
      ofColour(idle.drawn, colour.grab).filter(({ x }) => x === cellX(18)),
    ).toHaveLength(0);
  });
});

describe("the writing", () => {
  it("says the level, the swaps left, the score and the best, and the toast during a run", () => {
    const state = withCounts({ level: 3, moves: 12, score: 4321 });
    const { context, written } = surface();
    draw(
      context,
      state,
      view("running", { best: 9000, toast: "CHAIN x3  +120" }),
    );
    expect(written.map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        "LEVEL 3",
        "12",
        "4321",
        "BEST 9000",
        "CHAIN x3  +120",
      ]),
    );
    const idle = surface();
    draw(idle.context, state, view("over", { toast: "CHAIN x3  +120" }));
    expect(texts(idle)).not.toContain("CHAIN x3  +120");
  });

  it("turns the swaps red when only three are left", () => {
    const at = (moves: number) => {
      const s = surface();
      draw(s.context, withCounts({ moves }), view("running"));
      return s.written.filter(({ text }) => text === String(moves)).at(-1)
        ?.fill;
    };
    expect(at(4)).toBe(colour.grab);
    expect(at(3)).toBe(colour.danger);
  });

  it("fills the bar by the share of the way to the next level", () => {
    const wide = 50;
    expect(progressWidth(withCounts({ level: 1, score: 0 }), wide)).toBe(0);
    expect(
      progressWidth(withCounts({ level: 1, score: targetOf(1) / 2 }), wide),
    ).toBe(25);
    expect(
      progressWidth(withCounts({ level: 2, score: targetOf(1) }), wide),
    ).toBe(0);
    expect(
      progressWidth(
        withCounts({ level: 2, score: (targetOf(1) + targetOf(2)) / 2 }),
        wide,
      ),
    ).toBe(25);
    expect(progressWidth(withCounts({ level: 1, score: 99_999 }), wide)).toBe(
      wide,
    );
  });

  it("covers the board with a card before a run and after one, saying how it ended", () => {
    const ready = surface();
    draw(ready.context, startRun(9), view("ready"));
    expect(texts(ready)).toContain("SHARD MATCH");
    const running = surface();
    draw(running.context, startRun(9), view("running"));
    expect(texts(running)).not.toContain("SHARD MATCH");
    const over = surface();
    draw(
      over.context,
      withCounts({ cause: "out", level: 4, score: 450 }),
      view("over", { best: 900 }),
    );
    expect(texts(over)).toEqual(
      expect.arrayContaining([
        "OUT OF SWAPS",
        "LEVEL 4   SCORE 450",
        "BEST 900",
      ]),
    );
    const spent = surface();
    draw(
      spent.context,
      withCounts({ cause: "spent" }),
      view("over", { newBest: true }),
    );
    expect(texts(spent)).toEqual(
      expect.arrayContaining(["WHAT A RUN!", "NEW BEST!"]),
    );
  });
});

describe("the layout", () => {
  it("finds the cell under a pixel of the board, and none outside it", () => {
    expect(cellAt(boardX, boardY)).toBe(0);
    expect(cellAt(boardX + 3 * cell + 4, boardY + 2 * cell + 9)).toBe(19);
    expect(cellAt(boardX + 8 * cell - 1, boardY + 8 * cell - 1)).toBe(63);
    expect(cellAt(boardX - 1, boardY)).toBe(-1);
    expect(cellAt(boardX, boardY - 1)).toBe(-1);
    expect(cellAt(boardX + 8 * cell, boardY)).toBe(-1);
    expect(cellAt(boardX, boardY + 8 * cell)).toBe(-1);
  });
});
