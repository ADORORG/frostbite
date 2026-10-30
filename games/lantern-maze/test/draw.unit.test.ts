import { describe, expect, it } from "vitest";

import { cellOpen } from "../src/rules/maze.ts";
import { stepOnce } from "../src/rules/move.ts";
import { startRun } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import { hud, meterFull, meterWidth } from "../src/screen/hud.ts";
import { cell, originOf, screenWidth } from "../src/screen/layout.ts";
import { colour, floorByDistance } from "../src/screen/palette.ts";
import type { View } from "../src/screen/view.ts";
import { ofColour, surface } from "./support/canvas.ts";

const view = (phase: View["phase"], more: Partial<View> = {}): View => ({
  best: 0,
  newBest: false,
  phase,
  toast: null,
  ...more,
});

describe("the drawn cellar", () => {
  it("is black where the lantern has not been, and lit around the lantern", () => {
    const state = startRun(9);
    const { context, drawn } = surface();
    draw(context, state, view("running"));
    const origin = originOf(state.layout.maze.width, state.layout.maze.height);
    const lit = drawn.filter(
      ({ fill, width }) =>
        floorByDistance.includes(fill as never) && width === cell,
    );
    expect(lit.length).toBe(state.seen.filter(Boolean).length);
    expect(lit.some(({ x, y }) => x === origin.x && y === origin.y)).toBe(true);
    expect(drawn[0]).toMatchObject({
      fill: colour.black,
      height: 90,
      width: 160,
    });
    expect(ofColour(drawn, colour.flame)).toHaveLength(1);
  });

  it("shows how big the floor is before any of it is lit, as a dark panel one pixel wider than the maze all round", () => {
    const state = startRun(9);
    const { maze } = state.layout;
    const origin = originOf(maze.width, maze.height);
    const { context, drawn } = surface();
    draw(context, state, view("running"));
    expect(ofColour(drawn, colour.footprint)).toEqual([
      expect.objectContaining({
        height: maze.height * cell + 2,
        width: maze.width * cell + 2,
        x: origin.x - 1,
        y: origin.y - 1,
      }),
    ]);
  });

  it("shows places the lantern has left dimmer, but their key, door and flasks still there", () => {
    let state = startRun(9);
    const total = state.layout.maze.open.length;
    state = { ...state, seen: Array.from({ length: total }, () => true) };
    const { context, drawn } = surface();
    draw(context, state, view("running"));
    expect(ofColour(drawn, colour.floorSeen).length).toBeGreaterThan(total / 2);
    const keys = (list: typeof drawn) =>
      ofColour(list, colour.key).filter(
        ({ width, height }) => width === 3 && height === 3,
      );
    expect(keys(drawn)).toHaveLength(1);
    expect(
      ofColour(drawn, colour.flask).filter(
        ({ width, height }) => width === 4 && height === 4,
      ),
    ).toHaveLength(state.flasks.length);
    expect(
      ofColour(drawn, colour.door).filter(({ width }) => width === cell - 2),
    ).toHaveLength(1);
    const open = surface();
    draw(open.context, { ...state, hasKey: true }, view("running"));
    expect(ofColour(open.drawn, colour.doorOpen)).toHaveLength(1);
    expect(keys(open.drawn)).toHaveLength(0);
  });

  it("draws a wall on every closed side of a cell it shows", () => {
    const state = startRun(9);
    const { context, drawn } = surface();
    draw(context, state, view("running"));
    const closed = [0, 1, 2, 3].filter(
      (d) => !cellOpen(state.layout.maze, 0, d),
    ).length;
    const walls = drawn.filter(({ fill }) => fill === colour.wall);
    expect(walls.length).toBeGreaterThanOrEqual(closed);
  });

  it("flickers the flame from step to step", () => {
    const state = startRun(9);
    const direction =
      [0, 1, 2, 3].find((d) => cellOpen(state.layout.maze, 0, d)) ?? 0;
    const next = stepOnce(state, direction);
    if (typeof next === "string") throw new Error(next);
    const a = surface();
    const b = surface();
    draw(a.context, state, view("running"));
    draw(b.context, next, view("running"));
    const height = (s: typeof a) => ofColour(s.drawn, colour.flame)[0]?.height;
    expect(height(a)).not.toBe(height(b));
  });
});

describe("the writing", () => {
  it("says the floor, the oil, whether there is a key and the score", () => {
    const state = {
      ...startRun(9),
      floor: 4,
      hasKey: true,
      oil: 77,
      score: 1234,
    };
    const { context, written } = surface();
    hud(context, state, view("running"));
    const texts = written.map(({ text }) => text);
    expect(texts).toEqual(
      expect.arrayContaining(["FLOOR 4/30", "OIL 77", "KEY!", "1234"]),
    );
    const none = surface();
    hud(none.context, { ...state, hasKey: false }, view("running"));
    expect(none.written.map(({ text }) => text)).toContain("NO KEY");
  });

  it("fills the oil meter to the share of its full amount, and goes red when the oil is low", () => {
    const base = startRun(9);
    const fill = (oil: number) => {
      const { context, drawn } = surface();
      hud(context, { ...base, oil }, view("running"));
      return drawn.filter(
        ({ fill: f }) => f === colour.flask || f === colour.danger,
      );
    };
    expect(fill(meterFull / 2)[0]?.width).toBe(meterWidth / 2);
    expect(fill(meterFull * 3)[0]?.width).toBe(meterWidth);
    expect(fill(meterFull / 2)[0]?.fill).toBe(colour.flask);
    expect(fill(12)[0]?.fill).toBe(colour.danger);
    expect(fill(13)[0]?.fill).toBe(colour.flask);
  });

  it("shows a toast only while the run is going and its time has not passed", () => {
    const state = { ...startRun(9), moves: 5 };
    const toast = { text: "Down 3 floors", until: 6 };
    const shown = (phase: View["phase"], moves: number) => {
      const { context, written } = surface();
      hud(context, { ...state, moves }, view(phase, { toast }));
      return written.some(({ text }) => text === toast.text);
    };
    expect(shown("running", 5)).toBe(true);
    expect(shown("running", 6)).toBe(false);
    expect(shown("over", 5)).toBe(false);
  });

  it("covers the cellar with a card before a run and after one, saying how it ended", () => {
    const text = (s: ReturnType<typeof surface>) =>
      s.written.map(({ text: t }) => t);
    const ready = surface();
    draw(ready.context, startRun(9), view("ready"));
    expect(text(ready)).toContain("LANTERN MAZE");
    const running = surface();
    draw(running.context, startRun(9), view("running"));
    expect(text(running)).not.toContain("LANTERN MAZE");
    for (const [cause, said] of [
      ["dark", "THE LANTERN WENT OUT"],
      ["escaped", "YOU ESCAPED THE CELLAR"],
      ["spent", "YOUR LEGS GAVE OUT"],
      [null, "RUN OVER"],
    ] as const) {
      const over = surface();
      draw(
        over.context,
        { ...startRun(9), cause, floorsCleared: 3, score: 450 },
        view("over", { best: 900 }),
      );
      expect(text(over)).toEqual(
        expect.arrayContaining([said, "FLOORS 3   SCORE 450", "BEST 900"]),
      );
    }
    const best = surface();
    draw(best.context, startRun(9), view("over", { newBest: true }));
    expect(text(best)).toContain("NEW BEST!");
  });
});

describe("the layout", () => {
  it("centres a maze on the screen, under the bar", () => {
    const origin = originOf(15, 9);
    expect(origin.x).toBe((screenWidth - 15 * cell) / 2);
    expect(origin.y).toBeGreaterThanOrEqual(13);
    const small = originOf(7, 5);
    expect(small.x).toBeGreaterThan(origin.x);
  });
});
