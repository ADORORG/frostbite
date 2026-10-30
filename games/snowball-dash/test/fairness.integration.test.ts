import {
  maxRunInputs,
  maxRunRecordBytes,
  canonicalJson,
  type RunRecord,
} from "@ador/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { maxChoices, maxTicks } from "../src/rules/constants.ts";
import { snowballRules } from "../src/rules/index.ts";
import { earnedBy, milestoneIds } from "../src/rules/milestones.ts";
import { sampleRun } from "../src/sample-run.ts";
import { startRun } from "../src/rules/state.ts";
import { play } from "./support/planner.ts";

// A player who looks ahead and plays the rules out is the proof a course is fair: if it can get through, a legal run can. These are slow
// tests (they play whole runs through the rules, so they are integration tests), and they are the ones that fail when a pattern is laid
// with too little room.
const seeds = [1, 2, 3];
let longest: ReturnType<typeof play> | undefined;
const wholeRun = (): ReturnType<typeof play> => (longest ??= play(7, maxTicks));

describe("the course can be played", () => {
  it("lets a player who looks ahead survive the first minutes on every seed", () => {
    for (const seed of seeds) {
      const played = play(seed, 4_000);
      expect(played.state.alive, `seed ${String(seed)}`).toBe(true);
      expect(played.state.tick, `seed ${String(seed)}`).toBeGreaterThanOrEqual(
        3_900,
      );
    }
  }, 180_000);

  it("lets a perfect player play the whole of the longest run, and earn every one of the forty milestones", () => {
    const played = wholeRun();
    expect(played.state.alive).toBe(true);
    expect(played.state.tick).toBeGreaterThanOrEqual(maxTicks - 100);
    expect(earnedBy(played.state)).toEqual(milestoneIds);
  }, 240_000);

  it("keeps a perfect run within what a record may hold: its choices and its size", () => {
    const played = wholeRun();
    const record: RunRecord = {
      claims: [...earnedBy(played.state)],
      config: {},
      gameId: "snowball-dash",
      inputs: [
        ...played.inputs,
        { data: { tick: played.state.tick }, type: "end" },
      ],
      schemaVersion: 1,
      seed: 7,
      verifier: "snowball-dash",
      verifierVersion: 2,
    };
    expect(played.inputs.length).toBeLessThan(maxChoices);
    expect(record.inputs.length).toBeLessThanOrEqual(maxRunInputs);
    expect(new TextEncoder().encode(canonicalJson(record)).length).toBeLessThan(
      maxRunRecordBytes,
    );
  }, 240_000);

  it("makes the same run from the same seed and choices, and another slope from another seed", () => {
    const first = play(9, 1_500);
    expect(play(9, 1_500).inputs).toEqual(first.inputs);
    expect(startRun(9).ahead).not.toEqual(startRun(10).ahead);
  });
});

describe("the sample run the verifier is shown", () => {
  it("replays, and earns exactly the milestones it claims", () => {
    const record = sampleRun();
    const made = snowballRules.init(record.seed, record.config);
    if (!made.ok) throw new Error(made.reason);
    let state = made.state;
    for (const input of record.inputs) {
      const stepped = snowballRules.step(state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped.state;
    }
    expect(snowballRules.earned(state)).toEqual(record.claims);
    expect(record.claims.length).toBeGreaterThan(20);
    expect(state.alive).toBe(true);
  });
});
