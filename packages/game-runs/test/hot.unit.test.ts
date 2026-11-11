import { heatLevels } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { rankGames } from "../src/hot.ts";
import { defaultHotPolicy, hotPolicySchema } from "../src/hot-policy.ts";

const counts = (...pairs: [string, number][]) =>
  pairs.map(([gameId, plays]) => ({ gameId, plays }));

describe("ranking the games by the runs started in them", () => {
  it("orders the busiest first and gives each a heat against the busiest", () => {
    expect(
      rankGames(counts(["b", 50], ["a", 100], ["c", 20], ["d", 11])),
    ).toEqual([
      { gameId: "a", heat: 5, hot: true, rank: 1 },
      { gameId: "b", heat: 3, hot: true, rank: 2 },
      { gameId: "c", heat: 1, hot: true, rank: 3 },
      { gameId: "d", heat: 1, hot: false, rank: 4 },
    ]);
  });

  it("leaves out a game under the minimum, and ranks nothing on a platform where nobody has played enough", () => {
    const minimum = defaultHotPolicy.minPlays;
    expect(
      rankGames(counts(["a", minimum], ["b", minimum - 1])).map(
        (g) => g.gameId,
      ),
    ).toEqual(["a"]);
    expect(rankGames(counts(["a", minimum - 1]))).toEqual([]);
    expect(rankGames([])).toEqual([]);
  });

  it("settles a tie by the game's name, so the order does not change between two reads", () => {
    const tied = counts(["zeta", 9], ["alpha", 9], ["mid", 9]);
    expect(rankGames(tied).map((g) => g.gameId)).toEqual([
      "alpha",
      "mid",
      "zeta",
    ]);
    expect(rankGames([...tied].reverse()).map((g) => g.gameId)).toEqual([
      "alpha",
      "mid",
      "zeta",
    ]);
  });

  it("marks only as many hot games as the policy says", () => {
    const policy = hotPolicySchema.parse({ ...defaultHotPolicy, hotCount: 1 });
    expect(
      rankGames(counts(["a", 9], ["b", 8]), policy).map((g) => g.hot),
    ).toEqual([true, false]);
  });

  it("never gives a heat below one or above the levels", () => {
    const heats = rankGames(
      counts(["a", 1000], ["b", 5], ["c", 600], ["d", 1000]),
    ).map((g) => g.heat);
    expect(Math.min(...heats)).toBe(1);
    expect(Math.max(...heats)).toBe(heatLevels);
  });
});

describe("the policy for what is hot", () => {
  it("refuses a record it does not know or one that makes no sense", () => {
    expect(() =>
      hotPolicySchema.parse({ ...defaultHotPolicy, windowDays: 0 }),
    ).toThrow();
    expect(() =>
      hotPolicySchema.parse({ ...defaultHotPolicy, version: 2 }),
    ).toThrow();
    expect(() =>
      hotPolicySchema.parse({ ...defaultHotPolicy, extra: true }),
    ).toThrow();
  });
});
