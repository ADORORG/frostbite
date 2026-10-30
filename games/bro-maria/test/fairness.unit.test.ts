import { describe, expect, it } from "vitest";

import { play } from "./support/bot.ts";

const seeds = Array.from({ length: 80 }, (_, at) => (at + 1) * 7919);

// The balance of the level: a plain player who holds right and jumps at what is close can finish nearly every level, so a level is not an
// accident of the seed; and one who never jumps cannot, so the level asks something of the player.
describe("how hard the levels are", () => {
  it("lets a plain player finish nearly every level, in about the time it takes to run across it", () => {
    let finished = 0;
    for (const seed of seeds) {
      const { state } = play(seed);
      if (state.finishTick === null) continue;
      finished += 1;
      expect(state.finishTick).toBeGreaterThan(2_400);
      expect(state.finishTick).toBeLessThan(5_000);
    }
    expect(finished / seeds.length).toBeGreaterThanOrEqual(0.95);
  });

  it("does not let a hero who only runs get far: the first pit or foe ends it", () => {
    let furthest = 0;
    for (const seed of seeds.slice(0, 20)) {
      const { state } = play(seed, { idle: true, limit: 3_000 });
      furthest = Math.max(furthest, state.farthest);
      expect(state.finishTick).toBeNull();
    }
    expect(furthest).toBeLessThan(195);
  });
});
