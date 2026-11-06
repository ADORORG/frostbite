import { describe, expect, it } from "vitest";

import { defaultSound } from "../src/audio/settings.ts";
import {
  finishRun,
  freshProgress,
  restore,
  withBest,
  withSound,
} from "../src/best-progress.ts";

const quiet = { effects: false, music: false, volume: 0.2 };

describe("what the platform hands back", () => {
  it("is the saved best when it is a whole number, and a fresh game otherwise", () => {
    expect(restore({ best: 120 })).toEqual({ best: 120, sound: defaultSound });
    expect(restore({ best: 0 })).toEqual({ best: 0, sound: defaultSound });
    for (const bad of [
      null,
      undefined,
      5,
      "x",
      {},
      { best: -1 },
      { best: 1.5 },
      { best: "9" },
    ])
      expect(restore(bad)).toBe(freshProgress);
  });

  it("brings back the sound settings the player chose, and the defaults when they are missing or wrong", () => {
    expect(restore({ best: 3, sound: quiet }).sound).toEqual(quiet);
    expect(restore({ best: 3 }).sound).toEqual(defaultSound);
    expect(restore({ best: 3, sound: { volume: 9 } }).sound).toEqual(
      defaultSound,
    );
  });
});

describe("keeping the best", () => {
  const base = { best: 100, sound: quiet };

  it("keeps the larger of the best and a new score, and the sound settings with it", () => {
    expect(withBest(base, 150)).toEqual({ best: 150, sound: quiet });
    expect(withBest(base, 90)).toBe(base);
    expect(withBest(base, 100)).toBe(base);
  });

  it("changes the sound settings and nothing else", () => {
    expect(withSound({ best: 7, sound: defaultSound }, quiet)).toEqual({
      best: 7,
      sound: quiet,
    });
  });

  it("says a run's best is new only when it beat the best, never for a tie, a lower score or a first run that scored nothing", () => {
    expect(finishRun(base, 150)).toEqual({
      newBest: true,
      progress: { best: 150, sound: quiet },
    });
    expect(finishRun(base, 100)).toEqual({ newBest: false, progress: base });
    expect(finishRun(base, 40)).toEqual({ newBest: false, progress: base });
    expect(finishRun(freshProgress, 0)).toEqual({
      newBest: false,
      progress: freshProgress,
    });
    expect(finishRun(freshProgress, 1).newBest).toBe(true);
  });
});
