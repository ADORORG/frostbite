import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { maxInputs, maxTicks } from "../src/rules/constants.ts";
import { pulseRules } from "../src/rules/index.ts";
import { earnedBy, milestoneIds } from "../src/rules/milestones.ts";
import { stageAt } from "../src/rules/state.ts";
import { play, type Result } from "./support/bots.ts";

// The game measured with five players: one who taps every note exactly on its tick (the perfect player), who must always play the whole track, and
// four who tap a few ticks off (`blur`, which grows a little with each stage as a player tires), from a strong player to a poor one, who must fade
// at stages that fall in that order. Together they must earn every milestone.
const seeds = [1, 2, 3, 4].map((seed) => seed * 7_919);
const players = [
  ["perfect", 0, 0],
  ["pro", 1.5, 0.15],
  ["good", 2.5, 0.25],
  ["average", 3.5, 0.35],
  ["poor", 5, 0.5],
] as const;
const runs = new Map<string, Result[]>(
  players.map(([name, blur, tiring]) => [
    name,
    seeds.map((seed) => play(seed, blur, tiring)),
  ]),
);
const of = (name: string): Result[] => runs.get(name) ?? [];
const median = (values: readonly number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const stages = (name: string): number[] =>
  of(name).map(({ state }) => stageAt(state.tick));

describe("the game, played whole", () => {
  it("is played to its end, with every note hit, by a player who taps each exactly on time, in far fewer taps than a record holds", () => {
    for (const { state, taps } of of("perfect")) {
      expect(state.cause).toBe("finished");
      expect(state.tick).toBe(maxTicks);
      expect(state.misses + state.strays).toBe(0);
      expect(state.perfects).toBe(taps.length);
      expect(taps.length).toBeLessThan(maxInputs * 0.8);
      expect(state.cleanBars).toBeGreaterThan(250);
    }
  });

  it("fades at a stage that falls from the strongest player to the poorest, whatever the seed", () => {
    const medians = ["pro", "good", "average", "poor"].map((name) =>
      median(stages(name)),
    );
    for (let at = 1; at < medians.length; at += 1)
      expect(medians[at]).toBeLessThan(medians[at - 1] ?? 0);
    expect(medians[0]).toBeGreaterThan(20);
    expect(medians[2]).toBeGreaterThanOrEqual(6);
    expect(medians[2]).toBeLessThanOrEqual(16);
    expect(medians[3]).toBeLessThanOrEqual(8);
    for (const name of ["good", "average", "poor"])
      for (const { state } of of(name)) expect(state.cause).toBe("faded");
  });

  it("asks more of the player stage by stage up to the fifteenth, and then holds at a rate two hands can keep up, never past twelve notes a second", () => {
    const { taps } = of("perfect")[0] ?? { taps: [] };
    const perSecond = (stage: number): number =>
      (taps.filter(({ tick }) => stageAt(tick) === stage).length * 60) / 1_024;
    const rising = [1, 3, 6, 10, 15].map(perSecond);
    for (let at = 1; at < rising.length; at += 1)
      expect(rising[at]).toBeGreaterThan(rising[at - 1] ?? 0);
    const later = [...Array(20).keys()].map((at) => perSecond(at + 16));
    expect(Math.min(...later)).toBeGreaterThan(5.5);
    expect(Math.max(...later)).toBeLessThan(12);
  });

  it("can earn every milestone, between the players", () => {
    const all = new Set<string>();
    for (const runsOf of runs.values())
      for (const { state } of runsOf)
        for (const id of earnedBy(state)) all.add(id);
    expect(milestoneIds.filter((id) => !all.has(id))).toEqual([]);
  });

  it("makes records the platform's replay accepts, whoever plays", () => {
    for (const [name] of players) {
      const result = of(name)[0];
      if (result === undefined) throw new Error("no result");
      const record = {
        claims: [...earnedBy(result.state)],
        config: {},
        gameId: "aurora-pulse",
        inputs: [
          ...result.taps.map(({ lane, tick }) => ({
            data: { lane, tick },
            type: "hit",
          })),
          { data: { tick: result.state.tick }, type: "end" },
        ],
        schemaVersion: 1 as const,
        seed: seeds[0] ?? 0,
        verifier: "aurora-pulse",
        verifierVersion: 1,
      };
      expect(replayRecord(pulseRules, record)).toEqual({
        earned: record.claims,
        ok: true,
      });
      expect(record.inputs.length).toBeLessThanOrEqual(5_000);
    }
  });
});
