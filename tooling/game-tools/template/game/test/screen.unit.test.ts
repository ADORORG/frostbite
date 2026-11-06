import { describe, expect, it } from "vitest";

import { zoneHalfWidth } from "../src/rules/constants.ts";
import { startRun } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import { laneLeft, screenHeight, screenWidth } from "../src/screen/layout.ts";
import { colour } from "../src/screen/palette.ts";
import { resultOf } from "../src/screen/result.ts";
import type { View } from "../src/screen/view.ts";

// A drawing surface that notes what is filled on it, as (colour, x, y, width, height).
function recorder() {
  const fills: [string, number, number, number, number][] = [];
  let fill = "";
  const context = {
    fillRect: (x: number, y: number, width: number, height: number) =>
      void fills.push([fill, x, y, width, height]),
    set fillStyle(value: string) {
      fill = value;
    },
    strokeRect: () => undefined,
    set strokeStyle(_value: string) {
      // Strokes are not recorded.
    },
  } as unknown as CanvasRenderingContext2D;
  return { context, fills };
}

describe("the screen", () => {
  it("fills the whole screen, then draws the lane, the zone where the rules put it, and the marker where it is", () => {
    const { context, fills } = recorder();
    const state = startRun(7);
    draw(context, { markerAt: 40, state });
    expect(fills[0]).toEqual([
      colour.background,
      0,
      0,
      screenWidth,
      screenHeight,
    ]);
    const zone = fills.find(([fill]) => fill === colour.zone);
    expect(zone?.[1]).toBe(laneLeft + state.zone - zoneHalfWidth);
    expect(zone?.[3]).toBe(2 * zoneHalfWidth);
    const marker = fills.find(([fill]) => fill === colour.marker);
    expect(marker?.[1]).toBeCloseTo(laneLeft + 40 - 1.5);
  });

  it("draws the marker in the danger colour once the run has ended", () => {
    const { context, fills } = recorder();
    draw(context, { markerAt: 10, state: { ...startRun(7), ended: true } });
    expect(fills.some(([fill]) => fill === colour.danger)).toBe(true);
    expect(fills.some(([fill]) => fill === colour.marker)).toBe(false);
  });
});

describe("the card after a run", () => {
  const view = (over: Partial<View> = {}): View => ({
    best: 12,
    newBest: false,
    phase: "over",
    toast: null,
    ...over,
  });
  const over = {
    ...startRun(7),
    cause: "missed" as const,
    ended: true,
    score: 4,
  };

  it("has none before the first run or while a run goes", () => {
    expect(resultOf(over, view({ phase: "ready" }))).toBeNull();
    expect(resultOf(over, view({ phase: "running" }))).toBeNull();
  });

  it("says how it ended, the score, the best and how to go again, the ending in the danger colour", () => {
    const card = resultOf(over, view());
    expect(card?.rows.map(({ text }) => text)).toEqual([
      "MISSED",
      "CAUGHT 4",
      "BEST 12",
      "ENTER, SPACE OR TAP TO GO AGAIN",
    ]);
    expect(card?.rows[0]?.colour).toBe(colour.danger);
    expect(card?.rows[0]?.weight).toBeGreaterThan(card?.rows[1]?.weight ?? 0);
  });

  it("says time when the run ran out, and a new best in place of the old best", () => {
    expect(resultOf({ ...over, cause: "timeout" }, view())?.rows[0]?.text).toBe(
      "TIME",
    );
    const text = resultOf(over, view({ newBest: true }))?.rows.map(
      (row) => row.text,
    );
    expect(text).toContain("NEW BEST!");
    expect(text).not.toContain("BEST 12");
  });
});
