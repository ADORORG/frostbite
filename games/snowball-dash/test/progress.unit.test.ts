import { defaultSound } from "@ador/game-sdk/audio/settings";
import { describe, expect, it } from "vitest";

import {
  freshProgress,
  restore,
  withBest,
  withSound,
} from "../src/progress.ts";

const quiet = { effects: false, music: false, volume: 0.2 };

describe("what the platform hands back", () => {
  it("is the saved best when it is a whole number of metres, and a fresh game otherwise", () => {
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

  it("brings back the sound the player chose, and the defaults when it is missing or wrong", () => {
    expect(restore({ best: 3, sound: quiet }).sound).toEqual(quiet);
    expect(restore({ best: 3, sound: "loud" }).sound).toEqual(defaultSound);
  });

  it("keeps the best only when it is beaten, and the sound as it is changed", () => {
    const progress = restore({ best: 10 });
    expect(withBest(progress, 9)).toBe(progress);
    expect(withBest(progress, 10)).toBe(progress);
    expect(withBest(progress, 11).best).toBe(11);
    expect(withSound(progress, quiet)).toEqual({ best: 10, sound: quiet });
  });
});
