import { defaultSound } from "@frostbite/game-sdk/audio/settings";
import { describe, expect, it } from "vitest";

import {
  freshProgress,
  restore,
  withBest,
  withSound,
} from "../src/progress.ts";

const quiet = { effects: false, music: false, volume: 0.2 };

describe("what the platform hands back", () => {
  it("is the saved best when it is a whole number of height, and a fresh game otherwise", () => {
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

  it("keeps the larger of the best and a new height, and the sound settings with it", () => {
    const base = { best: 100, sound: quiet };
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
});
