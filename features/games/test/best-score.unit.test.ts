import { describe, expect, it } from "vitest";

import { bestOf, newBestWatcher } from "../src/domain/best-score.ts";

describe("the best a game's progress says", () => {
  it("is the whole number under `best`, and nothing for any other shape", () => {
    expect(bestOf({ best: 120, sound: {} })).toBe(120);
    expect(bestOf({ best: 0 })).toBe(0);
    for (const bad of [
      null,
      undefined,
      5,
      "x",
      {},
      { best: "9" },
      { best: -1 },
      { best: 1.5 },
      { best: Number.MAX_SAFE_INTEGER + 1 },
      { best: Number.NaN },
    ])
      expect(bestOf(bad)).toBeNull();
  });
});

describe("watching a game's saves for a new best", () => {
  it("says a save is a new best only when it beats what the game loaded, and then only the new score", () => {
    const watch = newBestWatcher();
    watch.loaded({ best: 100 });
    expect(watch.saved({ best: 100 })).toBeNull();
    expect(watch.saved({ best: 80 })).toBeNull();
    expect(watch.saved({ best: 150 })).toBe(150);
    expect(watch.saved({ best: 150 })).toBeNull();
    expect(watch.saved({ best: 151 })).toBe(151);
  });

  it("treats a game that loaded nothing as a best of nothing, so a first score is a new best", () => {
    const watch = newBestWatcher();
    watch.loaded(null);
    expect(watch.saved({ best: 40 })).toBe(40);
  });

  it("does not guess when the game never loaded: its first save sets the bar and is not itself a new best", () => {
    const watch = newBestWatcher();
    expect(watch.saved({ best: 40 })).toBeNull();
    expect(watch.saved({ best: 41 })).toBe(41);
  });

  it("ignores a save that has no best in it", () => {
    const watch = newBestWatcher();
    watch.loaded({ best: 10 });
    expect(watch.saved({ taps: 7 })).toBeNull();
    expect(watch.saved({ best: 11 })).toBe(11);
  });
});
