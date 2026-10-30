import { describe, expect, it } from "vitest";

import {
  earnedBy,
  idOf,
  ladders,
  milestoneIds,
  type Ladder,
} from "../src/rules/milestones.ts";
import type { RunState } from "../src/rules/types.ts";
import { bare } from "./support/states.ts";

// What each ladder reads, set to a number on an otherwise empty run.
const set: Record<string, (n: number) => Partial<RunState>> = {
  airtime: (n) => ({ longest: n }),
  boulders: (n) => ({ cleared: { boulder: n, pit: 0, rock: 0, spikes: 0 } }),
  clears: (n) => ({ cleared: { boulder: 0, pit: 0, rock: n, spikes: 0 } }),
  close: (n) => ({ closeCalls: n }),
  height: (n) => ({ peak: n }),
  metres: (n) => ({ distance: n * 160 }),
  pits: (n) => ({ cleared: { boulder: 0, pit: n, rock: 0, spikes: 0 } }),
  score: (n) => ({ score: n }),
  shards: (n) => ({ shardsTaken: n }),
  spikes: (n) => ({ cleared: { boulder: 0, pit: 0, rock: 0, spikes: n } }),
  streak: (n) => ({ bestStreak: n }),
};

const has = (changes: Partial<RunState>, id: string): boolean =>
  earnedBy(bare(changes)).includes(id);

describe("the milestones", () => {
  it("are forty, each with its own id, and a fresh run has earned none", () => {
    expect(milestoneIds).toHaveLength(40);
    expect(new Set(milestoneIds).size).toBe(40);
    expect(earnedBy(bare())).toEqual([]);
  });

  it("are the first hop and ten ladders, and the ladders go up", () => {
    expect(ladders.map(({ prefix }) => prefix).sort()).toEqual(
      Object.keys(set).sort(),
    );
    for (const { steps } of ladders)
      expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(has({ hops: 1 }, "first-hop")).toBe(true);
    expect(has({ hops: 0 }, "first-hop")).toBe(false);
  });

  const rungs = ladders.flatMap((ladder: Ladder) =>
    ladder.steps.map(
      (step) => [idOf(ladder.prefix, step), ladder.prefix, step] as const,
    ),
  );

  it.each(rungs)(
    "%s is earned at its step and not below",
    (id, prefix, step) => {
      const make = set[prefix];
      if (make === undefined) throw new Error(prefix);
      expect(has(make(step - 1), id)).toBe(false);
      expect(has(make(step), id)).toBe(true);
      expect(has(make(step + 1), id)).toBe(true);
    },
  );

  it("are earned in the order the list gives them, and a rung earns every rung below it", () => {
    const state = bare({ score: 6_000, distance: 800 * 160 });
    expect(earnedBy(state)).toEqual(
      milestoneIds.filter((id) =>
        [
          "score-500",
          "score-1500",
          "score-3000",
          "score-6000",
          "metres-100",
          "metres-250",
          "metres-500",
          "metres-800",
        ].includes(id),
      ),
    );
  });

  it("make an id from the ladder's name and the step", () => {
    expect(idOf("score", 500)).toBe("score-500");
    expect(idOf("metres", 1_200)).toBe("metres-1200");
  });
});
