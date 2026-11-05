import { stubPointer } from "@ador/test-kit/touch-screen";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import type { View } from "../src/screen/view.ts";
import { surface } from "./support/canvas.ts";

// The cards name what starts a run: Enter for a keyboard, a tap for a finger (a phone has no Enter).
const view = (phase: View["phase"]): View => ({
  best: 0,
  newBest: false,
  phase,
  toast: null,
});
const said = (phase: View["phase"]): string[] => {
  const s = surface();
  draw(s.context, startRun(9), view(phase));
  return s.written.map(({ text }) => text);
};
afterEach(() => vi.unstubAllGlobals());

describe("the cards of the cellar", () => {
  it("say Enter to a keyboard, before a run and after one", () => {
    stubPointer(false);
    expect(said("ready")).toContain("ARROWS / WASD / SWIPE - ENTER TO LIGHT");
    expect(said("over")).toContain("ENTER FOR ANOTHER CELLAR");
  });

  it("say tap to a finger, before a run and after one, and never Enter", () => {
    stubPointer(true);
    expect(said("ready")).toContain("SWIPE TO STEER - TAP TO LIGHT");
    expect(said("over")).toContain("TAP FOR ANOTHER CELLAR");
    expect(said("ready").join(" ")).not.toContain("ENTER");
    expect(said("over").join(" ")).not.toContain("ENTER");
  });
});
