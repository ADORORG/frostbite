import { drawGuide } from "@frostbite/game-sdk/guide";
import { stubPointer } from "@frostbite/test-kit/touch-screen";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import type { View } from "../src/screen/view.ts";
import { guide } from "../src/guide.ts";
import { surface } from "./support/canvas.ts";

// The first-screen card is drawn by the SDK over the screen, at the pixels of the display, and not on the small canvas, where scaling it
// up blurs the writing. It says Enter to a keyboard and a tap to a finger (a phone has no Enter).
const said = (): string[] => {
  const s = surface();
  drawGuide(s.context, 731, 411, guide);
  return s.written.map(({ text }) => text);
};
afterEach(() => vi.unstubAllGlobals());

describe("the first-screen card", () => {
  it("says what the game is, how to play it and how to begin, to a keyboard", () => {
    stubPointer(false);
    expect(said()).toEqual(
      expect.arrayContaining([
        "SHARD MATCH",
        "SWAP TWO SHARDS: LINE UP THREE OR MORE",
        ...guide.lines,
        "ENTER TO START",
      ]),
    );
  });

  it("says tap to a finger, in the words made for one, and never Enter", () => {
    stubPointer(true);
    expect(said()).toEqual(
      expect.arrayContaining([
        guide.title,
        ...(guide.touchLines ?? []),
        "TAP TO START",
      ]),
    );
    expect(said().join(" ")).not.toContain("ENTER");
    // A phone held upright has a narrow screen: its lines are the shorter ones.
    expect(guide.touchLines?.length).toBeGreaterThan(0);
    for (const line of guide.touchLines ?? [])
      expect(line.length).toBeLessThanOrEqual(23);
  });

  it("is not on the game's own canvas before a run, which would blur it", () => {
    const s = surface();
    draw(s.context, startRun(9), {
      best: 0,
      cursor: 0,
      grab: -1,
      hint: [],
      newBest: false,
      phase: "ready",
      shape: "wide",
      toast: null,
    } satisfies View);
    expect(s.written.map(({ text }) => text)).not.toContain(guide.title);
  });
});
