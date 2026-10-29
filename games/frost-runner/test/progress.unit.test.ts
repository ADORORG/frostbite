import { describe, expect, it } from "vitest";

import { freshProgress, restore, withBest } from "../src/progress.ts";

describe("what the platform hands back", () => {
  it("is the saved best when it is a whole number of metres, and a fresh game otherwise", () => {
    expect(restore({ best: 120 })).toEqual({ best: 120 });
    expect(restore({ best: 0 })).toEqual({ best: 0 });
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

  it("keeps the larger of the best and a new distance", () => {
    expect(withBest({ best: 100 }, 150)).toEqual({ best: 150 });
    const kept = { best: 100 };
    expect(withBest(kept, 90)).toBe(kept);
    expect(withBest(kept, 100)).toBe(kept);
  });
});
