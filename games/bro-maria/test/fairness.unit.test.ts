import { describe, expect, it } from "vitest";

import { stages } from "../src/rules/constants.ts";
import { play, playFrom } from "./support/bot.ts";
import { playRun, playStageOnce, startStage } from "./support/planner.ts";

const seeds = Array.from({ length: 12 }, (_, at) => (at + 1) * 7919);

// The balance of the run. A player who sees what is coming (the planner) clears every stage of every seed without losing a life, so every
// stage can be cleared; a plain player who holds right and jumps at what is close loses more lives on the later stages, and mostly does not get
// through all six; one who never jumps gets nowhere.
describe("how hard the stages are", () => {
  it("can be cleared by a player who sees what is coming, on every stage, without a hit or a fall, in about the time it takes to run across", () => {
    for (let stage = 1; stage <= stages; stage += 1)
      for (const seed of seeds.slice(0, 4)) {
        const { state } = playStageOnce(seed, stage);
        expect(
          state.stagesCleared,
          `stage ${String(stage)} seed ${String(seed)}`,
        ).toBe(1);
        expect(state.hits + state.deaths).toBe(0);
        expect(state.tick).toBeGreaterThan(2_300);
        expect(state.tick).toBeLessThan(2_800);
      }
  }, 120_000);

  it("is finished, all six stages, by that player, with every life", () => {
    const { state } = playRun(seeds[0] ?? 1);
    expect(state.finishTick).not.toBeNull();
    expect(state.stagesCleared).toBe(stages);
    expect(state.hits + state.deaths).toBe(0);
    expect(state.lives).toBe(5);
  }, 60_000);

  it("costs a plain player more lives stage by stage", () => {
    const lost = (stage: number): number =>
      seeds.reduce((sum, seed) => {
        const { state } = playFrom(
          startStage(seed, stage),
          { limit: 6_000 },
          (s) => s.stagesCleared > 0,
        );
        return sum + state.hits + state.deaths;
      }, 0) / seeds.length;
    expect(lost(6)).toBeGreaterThan(lost(1) + 1);
  }, 120_000);

  it("is not finished by a plain player on most seeds, and not at all by one who only runs", () => {
    const finished = seeds.filter(
      (seed) => play(seed).state.finishTick !== null,
    ).length;
    expect(finished / seeds.length).toBeLessThanOrEqual(0.5);
    for (const seed of seeds.slice(0, 6)) {
      const { state } = play(seed, { idle: true, limit: 6_000 });
      expect(state.finishTick).toBeNull();
      expect(state.stage).toBeLessThanOrEqual(2);
    }
  }, 120_000);
});
