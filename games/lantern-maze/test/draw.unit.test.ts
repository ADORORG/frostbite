import { describe, expect, it } from "vitest";

import { cellOpen } from "../src/rules/maze.ts";
import { stepOnce } from "../src/rules/move.ts";
import { startRun } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import { hud, meterFull, meterWidth } from "../src/screen/hud.ts";
import { cell, originOf, screenWidth, zoomOf } from "../src/screen/layout.ts";
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
    const { maze } = state.layout;
    const origin = originOf(maze.width, maze.height);
    const zoom = zoomOf(maze.width, maze.height);
    const lit = drawn.filter(
      ({ fill, width }) =>
        floorByDistance.includes(fill as never) && width === cell * zoom,
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
    const zoom = zoomOf(maze.width, maze.height);
    const { context, drawn } = surface();
    draw(context, state, view("running"));
    expect(ofColour(drawn, colour.footprint)).toEqual([
      expect.objectContaining({
        height: (maze.height * cell + 2) * zoom,
        width: (maze.width * cell + 2) * zoom,
        x: origin.x - zoom,
        y: origin.y - zoom,
      }),
    ]);
  });

  it("shows places the lantern has left dimmer, but their key, door and flasks still there", () => {
    let state = startRun(9);
    const total = state.layout.maze.open.length;
    state = { ...state, seen: Array.from({ length: total }, () => true) };
    const { context, drawn } = surface();
    const { maze } = state.layout;
    const zoom = zoomOf(maze.width, maze.height);
    draw(context, state, view("running"));
    expect(ofColour(drawn, colour.floorSeen).length).toBeGreaterThan(total / 2);
    const keys = (list: typeof drawn) =>
      ofColour(list, colour.key).filter(
        ({ width, height }) => width === 3 * zoom && height === 3 * zoom,
      );
    expect(keys(drawn)).toHaveLength(1);
    expect(
      ofColour(drawn, colour.flask).filter(
        ({ width, height }) => width === 4 * zoom && height === 4 * zoom,
      ),
    ).toHaveLength(state.flasks.length);
    expect(
      ofColour(drawn, colour.door).filter(
        ({ width }) => width === (cell - 2) * zoom,
      ),
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

  it("leaves both cards, before a run and after it, to the SDK: the canvas carries none", () => {
    const text = (phase: "over" | "ready") => {
      const s = surface();
      draw(
        s.context,
        { ...startRun(9), cause: "dark", floorsCleared: 3, score: 450 },
        view(phase, { best: 900, newBest: true }),
      );
      return s.written.map(({ text: t }) => t);
    };
    expect(text("ready")).not.toContain("LANTERN MAZE");
    expect(text("over")).not.toContain("THE LANTERN WENT OUT");
    expect(text("over")).not.toContain("NEW BEST!");
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
