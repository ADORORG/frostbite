import { replayRecord } from "@ador/game-sdk/replay";
import { beforeAll, describe, expect, it } from "vitest";

import { directions } from "../src/rules/constants.ts";
import { matchRules } from "../src/rules/index.ts";
import { earnedBy, milestoneIds } from "../src/rules/milestones.ts";
import {
  greedyPlayer,
  plannerPlayer,
  play,
  randomPlayer,
  type Result,
} from "./support/bots.ts";

// The game measured with three players: one who makes any swap that makes a line (the random player), one who makes the swap that scores most
// at once (the greedy player), and one who looks a swap further (the planner). The random player must run out of swaps early, the greedy one
// later, and the planner should not run out at all in the time measured; together they must earn every milestone.
const seeds = [1, 2, 3, 4, 5, 6].map((seed) => seed * 7_919);

// How many swaps the planner makes. Measured on seed 1: the last milestone to come (3,000 points in one swap) is earned between the 400th
// and the 500th swap, and the 500th swap is in level 27. The gate plays 600 so that the milestones are not on its edge; the planner costs
// about 0.12 s a swap (the others are a second or two each), so the whole 1,200-swap run, which reaches level 49, is kept for
// `SHARD_MATCH_LONG=1` and is not part of the gate.
const plannerSeed = seeds[0] ?? 1;
const plannerSwaps = 600;
const longPlannerSwaps = 1_200;
const long = process.env["SHARD_MATCH_LONG"] === "1";

let randoms: Result[] = [];
let greedy: Result[] = [];
let planner: Result;

// Played once, before the first test, and not when the file is loaded, so a run that selects none of this file's tests (a name filter) does not pay for them.
beforeAll(() => {
  randoms = seeds.map((seed) => play(seed, randomPlayer));
  greedy = seeds.slice(0, 4).map((seed) => play(seed, greedyPlayer));
  planner = play(plannerSeed, plannerPlayer, plannerSwaps);
}, 300_000);

describe("the game, played whole", () => {
  it("runs out of swaps early for a player who makes any swap that makes a line", () => {
    for (const { state } of randoms) {
      expect(state.cause).toBe("out");
      expect(state.level).toBeLessThanOrEqual(8);
      expect(state.swaps).toBeLessThan(200);
    }
  });

  it("runs out later for a player who always takes the best swap in sight, and at very different levels", () => {
    const levels = greedy.map(({ state }) => state.level);
    for (const { state } of greedy) {
      expect(state.cause).toBe("out");
      expect(state.level).toBeGreaterThanOrEqual(4);
      expect(state.swaps).toBeLessThan(1_500);
    }
    expect(Math.max(...levels)).toBeGreaterThan(Math.min(...levels));
    expect(Math.min(...levels)).toBeGreaterThan(
      Math.max(...randoms.map(({ state }) => state.level)) - 4,
    );
  });

  it("does not run out for a player who looks one swap further", () => {
    expect(planner.state.ended).toBe(false);
    expect(planner.state.level).toBeGreaterThan(25);
    expect(planner.state.moves).toBeGreaterThan(0);
  });

  it.runIf(long)(
    "still does not run out in twice the swaps",
    () => {
      const whole = play(plannerSeed, plannerPlayer, longPlannerSwaps);
      expect(whole.state.ended).toBe(false);
      expect(whole.state.level).toBeGreaterThan(40);
    },
    600_000,
  );

  it("can earn every milestone, between the players", () => {
    const all = new Set<string>();
    for (const { state } of [...randoms, ...greedy, planner])
      for (const id of earnedBy(state)) all.add(id);
    expect(milestoneIds.filter((id) => !all.has(id))).toEqual([]);
  });

  it("makes records the platform's replay accepts, whoever plays", () => {
    const record = (result: Result, seed: number) => ({
      claims: [...earnedBy(result.state)],
      config: {},
      gameId: "shard-match",
      inputs: [
        ...result.swaps.map(({ cell, to }) => ({
          data: { cell, to },
          type: "swap",
        })),
        ...(result.state.ended ? [] : [{ type: "end" }]),
      ],
      schemaVersion: 1 as const,
      seed,
      verifier: "shard-match",
      verifierVersion: 2,
    });
    for (const [result, seed] of [
      [randoms[0], seeds[0]],
      [greedy[1], seeds[1]],
      [planner, plannerSeed],
    ] as const) {
      if (result === undefined || seed === undefined)
        throw new Error("no result");
      const made = record(result, seed);
      expect(replayRecord(matchRules, made)).toEqual({
        earned: made.claims,
        ok: true,
      });
      expect(made.inputs.length).toBeLessThanOrEqual(5_000);
    }
    expect(directions).toHaveLength(4);
  });
});
