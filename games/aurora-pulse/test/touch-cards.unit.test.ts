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
const screen = (coarse: boolean) =>
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
    }),
  });
afterEach(() => vi.unstubAllGlobals());

describe("the cards of the field", () => {
  it("say Enter to a keyboard, before a run and after one", () => {
    screen(false);
    expect(said("ready")).toContain("ENTER TO START");
    expect(said("over")).toContain("ENTER TO PLAY AGAIN");
  });

  it("say tap to a finger, before a run and after one, and never Enter", () => {
    screen(true);
    expect(said("ready")).toContain("TAP TO START");
    expect(said("over")).toContain("TAP TO PLAY AGAIN");
    expect(said("ready").join(" ")).not.toContain("ENTER");
    expect(said("over").join(" ")).not.toContain("ENTER");
  });
});
