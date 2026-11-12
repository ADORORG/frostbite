import { describe, expect, it } from "vitest";

import { walls } from "../src/rules/layout.ts";
import { startRun } from "../src/rules/state.ts";
import {
  drawMap,
  mapHeight,
  mapWidth,
  shade,
  toMap,
} from "../src/screen/map.ts";
import { led } from "./support/states.ts";

// A stand-in for a 2D canvas context: it notes each shape filled (or ring drawn) and the colour it was drawn in.
function recorder() {
  const fills: { colour: string; kind: string }[] = [];
  let colour = "";
  let line = "";
  const context = {
    arc: () => undefined,
    beginPath: () => undefined,
    fill: () => fills.push({ colour, kind: "dot" }),
    fillRect: () => fills.push({ colour, kind: "box" }),
    get fillStyle() {
      return colour;
    },
    set fillStyle(value: string) {
      colour = value;
    },
    lineWidth: 1,
    stroke: () => fills.push({ colour: line, kind: "ring" }),
    get strokeStyle() {
      return line;
    },
    set strokeStyle(value: string) {
      line = value;
    },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    fills,
  };
}

describe("the flat map, for a device with no WebGL 2", () => {
  it("puts north at the top and the house below the meadow, inside the screen", () => {
    const meadow = toMap(0, -30_000);
    const house = toMap(0, 7_000);
    expect(meadow.y).toBe(0);
    expect(house.y).toBeGreaterThan(meadow.y);
    expect(toMap(-26_000, 0).x).toBeGreaterThanOrEqual(0);
    expect(toMap(26_000, 0).x).toBeLessThanOrEqual(mapWidth);
    expect(toMap(0, 15_000).y).toBeLessThanOrEqual(mapHeight);
  });

  it("paints each room from grey to its own colour as it comes back", () => {
    expect(shade("#ff0000", 0)).toBe("#77748a");
    expect(shade("#ff0000", 100)).toBe("#ff0000");
    expect(shade("#ff0000", 250)).toBe("#ff0000");
    expect(shade("#ff0000", 50)).toBe("#bb3a45");
  });

  it("shows the family on the lawn to choose from, then the lead and the sly snakes once seen", () => {
    const choosing = recorder();
    drawMap(choosing.context, startRun(3), "zora", 0.5);
    const dots = choosing.fills.filter((fill) => fill.kind === "dot");
    // The tree, the hill, and the four of the family.
    expect(dots).toHaveLength(6);
    // The meadow and six rooms, and every wall; nothing marks the snake, which is under the hill.
    expect(choosing.fills.filter((fill) => fill.kind === "box").length).toBe(
      1 + 6 + walls.length,
    );
    expect(choosing.fills.filter((fill) => fill.kind === "ring")).toEqual([]);
    const state = led();
    const seen = {
      ...state,
      greys: state.greys.map((grey, index) => ({
        ...grey,
        healed: index === 1,
        seen: index < 3,
      })),
      party: ["zora" as const],
    };
    const playing = recorder();
    drawMap(playing.context, seen, "kai", 1);
    const shown = playing.fills.filter((fill) => fill.kind === "dot");
    // The tree, the hill, two sly snakes, the two still to find, and the lead (a ring and a dot).
    expect(shown).toHaveLength(8);
    const lit = recorder();
    drawMap(lit.context, { ...seen, cause: "lit" }, "kai", 1);
    expect(lit.fills.find((fill) => fill.kind === "dot")?.colour).toBe(
      "#ffc74a",
    );
    // Once the tree is lit the snake has let its ancestors go.
    expect(lit.fills.some((fill) => fill.kind === "ring")).toBe(false);
  });
});
