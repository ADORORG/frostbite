import { describe, expect, it } from "vitest";

import { freshProgress, restore, withBest } from "../src/progress.ts";

describe("what the platform hands back as saved progress", () => {
  it("is taken when it is a best that is a whole number of zero or more", () => {
    expect(restore({ best: 17 })).toEqual({ best: 17 });
    expect(restore({ best: 0 })).toEqual({ best: 0 });
  });

  it.each([
    null,
    undefined,
    5,
    "x",
    {},
    { best: -1 },
    { best: 1.5 },
    { best: "9" },
  ])("is a fresh game for anything else: %j", (saved) => {
    expect(restore(saved)).toBe(freshProgress);
  });

  it("keeps the best height and only ever raises it", () => {
    expect(withBest({ best: 5 }, 9)).toEqual({ best: 9 });
    expect(withBest({ best: 5 }, 5)).toEqual({ best: 5 });
    const kept = { best: 12 };
    expect(withBest(kept, 3)).toBe(kept);
  });
});
