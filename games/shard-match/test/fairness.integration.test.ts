import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

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
const randoms = seeds.map((seed) => play(seed, randomPlayer));
const greedy = seeds.slice(0, 4).map((seed) => play(seed, greedyPlayer));
const planner = play(seeds[0] ?? 1, plannerPlayer, 1_200);

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
  }, 300_000);

  it("can earn every milestone, between the players", () => {
    const all = new Set<string>();
    for (const { state } of [...randoms, ...greedy, planner])
      for (const id of earnedBy(state)) all.add(id);
    expect(milestoneIds.filter((id) => !all.has(id))).toEqual([]);
  }, 300_000);

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
      verifierVersion: 1,
    });
    for (const [result, seed] of [
      [randoms[0], seeds[0]],
      [greedy[1], seeds[1]],
      [planner, seeds[0]],
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
  }, 300_000);
});
