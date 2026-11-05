import { stubPointer } from "@frostbite/test-kit/touch-screen";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { draw } from "../src/screen/draw.ts";
import type { View } from "../src/screen/view.ts";
import { surface } from "./support/canvas.ts";

// The card after a run names what starts the next: Enter for a keyboard, a tap for a finger (a phone has no Enter). The card before the
// first run is the SDK's (guide.unit.test.ts).
const view = (phase: View["phase"]): View => ({
  best: 0,
  cursor: 0,
  grab: -1,
  hint: [],
  newBest: false,
  phase,
  shape: "wide",
  toast: null,
});
const said = (phase: View["phase"]): string[] => {
  const s = surface();
  draw(s.context, startRun(9), view(phase));
  return s.written.map(({ text }) => text);
};
afterEach(() => vi.unstubAllGlobals());

describe("the cards of the board", () => {
  it("say Enter to a keyboard after a run", () => {
    stubPointer(false);
    expect(said("over")).toContain("ENTER TO PLAY AGAIN");
  });

  it("say tap to a finger after a run, and never Enter", () => {
    stubPointer(true);
    expect(said("over")).toContain("TAP TO PLAY AGAIN");
    expect(said("over").join(" ")).not.toContain("ENTER");
  });
});
