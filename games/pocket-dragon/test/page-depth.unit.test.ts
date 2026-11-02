// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { element } from "../src/page/elements.ts";
import { startRun, type PlayRun } from "../src/page/runs.ts";
import { createView } from "../src/page/view.ts";
import type { WoodsState } from "../src/rules/woods/types.ts";
import { surface } from "./support/canvas.ts";
import { outside } from "./support/woods-outside.ts";

// The three-dimensional view, standing in for the real one (which needs WebGL): it notes the states it was shown.
const shown = vi.hoisted(() => [] as WoodsState[]);
const made = vi.hoisted(() => ({ times: 0, works: true }));
vi.mock("../src/three/stage.ts", () => ({
  createDepthView: () => {
    made.times += 1;
    return made.works
      ? { show: (state: WoodsState) => shown.push(state) }
      : null;
  },
}));

const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
beforeEach(() => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
  shown.splice(0);
  made.times = 0;
  made.works = true;
});

const outOfTheMaze = (layers: boolean[]): PlayRun => ({
  ...startRun("woods", 4),
  depth: () => outside(),
  draw: (_context, layered) => void layers.push(layered),
});

describe("the woods outside the maze on the page", () => {
  it("are drawn in three dimensions behind the screen, which is cleared and drawn over them, the view made only once", () => {
    const screen = surface();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      screen.context,
    );
    const world = element("world", "canvas");
    const view = createView();
    view.draw(startRun("woods", 4), false, 0, 0);
    expect(world.hidden).toBe(true);
    expect(made.times).toBe(0);
    const layers: boolean[] = [];
    view.draw(outOfTheMaze(layers), false, 0, 0);
    view.draw(outOfTheMaze(layers), false, 0, 0);
    expect(world.hidden).toBe(false);
    expect(layers).toEqual([true, true]);
    expect(shown).toHaveLength(2);
    expect(made.times).toBe(1);
    expect(screen.cleared()).toBe(3);
    view.draw(startRun("hills", 4), false, 0, 0);
    expect(world.hidden).toBe(true);
  });

  it("are drawn flat on the screen where the three-dimensional view cannot be made", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      surface().context,
    );
    made.works = false;
    const view = createView();
    const layers: boolean[] = [];
    view.draw(outOfTheMaze(layers), false, 0, 0);
    view.draw(outOfTheMaze(layers), false, 0, 0);
    expect(layers).toEqual([false, false]);
    expect(element("world", "canvas").hidden).toBe(true);
    expect(made.times).toBe(1);
  });
});
