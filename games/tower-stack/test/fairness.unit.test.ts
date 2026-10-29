import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { towerRules } from "../src/rules/index.ts";
import { earnedBy } from "../src/rules/milestones.ts";
import { play } from "./support/bot.ts";

const seeds = [1, 2, 3, 4, 5];
const heightOf = (slips: readonly number[], seed: number, blocks = 400) =>
  play(seed, blocks, slips).state.height;

// A bot that is never late stands for the best that can be done, and bots that are late or early by a few ticks (a few hundredths of a
// second) stand for ordinary hands: a game these cannot get anywhere in is one that cannot be played.
describe("whether the game can be played", () => {
  it("lets a player who is never wrong stack as high as the run lasts, and never fall", () => {
    for (const seed of seeds) {
      const played = play(seed, 150);
      expect(played.state.height).toBe(150);
      expect(played.state.over).toBe(false);
    }
  });

  it("lets a player a few ticks out reach a respectable tower on every seed", () => {
    for (const seed of seeds) {
      expect(heightOf([1, -1, 0, 1], seed)).toBeGreaterThanOrEqual(20);
      expect(heightOf([2, -2, 1, -1, 0], seed)).toBeGreaterThanOrEqual(15);
      expect(heightOf([3, -3, 2, -2, 1, -1, 0], seed)).toBeGreaterThanOrEqual(
        12,
      );
    }
  });

  it("lets even a hand that is five ticks out get the tower up several blocks", () => {
    for (const seed of seeds)
      expect(heightOf([5, -4, 3, -5, 2], seed)).toBeGreaterThanOrEqual(6);
  });

  it("is harder for a hand that is further out, so skill is what the height measures", () => {
    const mean = (slips: readonly number[]) =>
      seeds.reduce((sum, seed) => sum + heightOf(slips, seed), 0) /
      seeds.length;
    expect(mean([1, -1, 0])).toBeGreaterThan(mean([3, -3, 2]));
    expect(mean([3, -3, 2])).toBeGreaterThan(mean([6, -6, 5]));
  });

  it("gives every seed the same run for the same hand, and another run for another seed", () => {
    expect(play(3, 30, [2, -1]).inputs).toEqual(play(3, 30, [2, -1]).inputs);
    expect(play(3, 30, [2, -1]).inputs).not.toEqual(
      play(4, 30, [2, -1]).inputs,
    );
  });

  it("makes records the platform's replay accepts, with the milestones the state earned", () => {
    for (const seed of seeds) {
      const { inputs, state } = play(seed, 60, [0, 2, -1, 1]);
      const outcome = replayRecord(towerRules, {
        claims: [],
        config: {},
        gameId: "tower-stack",
        inputs: [...inputs],
        schemaVersion: 1,
        seed,
        verifier: "tower-stack",
        verifierVersion: 1,
      });
      expect(outcome).toEqual({ earned: earnedBy(state), ok: true });
    }
  });
});
