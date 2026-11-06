import { describe, expect, it } from "vitest";

import { tapSound, tempoScale } from "../src/feedback.ts";
import { startRun } from "../src/rules/state.ts";

describe("what the player hears", () => {
  it("is a chime for a catch and a thud for the miss that ends the run", () => {
    const before = startRun(1);
    expect(tapSound(before, { ...before, score: 1 })).toBe("catch");
    expect(tapSound(before, { ...before, ended: true })).toBe("miss");
  });

  it("is music that runs faster as the marker does, by a tenth a step, to a fifth faster", () => {
    expect(tempoScale(1)).toBe(1);
    expect(tempoScale(2)).toBeCloseTo(1.1);
    expect(tempoScale(30)).toBe(1.2);
  });
});
