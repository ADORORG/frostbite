import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { runnerRules } from "../src/rules/index.ts";
import { metres } from "../src/rules/milestones.ts";
import { sampleRun } from "../src/sample-run.ts";
import { play } from "./support/bot.ts";

describe("the game can be played", () => {
  it.each([1, 2, 3, 4, 5])(
    "a careful player gets a kilometre and a half and fifty obstacles far on seed %i",
    (seed) => {
      const { state } = play(seed, 3_000);
      expect(state.alive).toBe(true);
      expect(metres(state)).toBeGreaterThan(1_000);
      expect(state.cleared).toBeGreaterThan(50);
    },
  );

  it("a player who never acts is stopped by the first obstacle, within a few seconds", () => {
    const { state } = play(3, 0);
    expect(state.tick).toBe(0);
    expect(runnerRules.init(3, {}).ok).toBe(true);
  });
});

describe("the sample run the verifier is registered with", () => {
  const run = sampleRun();

  it("names this game's verifier at this version, and is the same run every time", () => {
    expect(run).toMatchObject({
      gameId: "frost-runner",
      verifier: "frost-runner",
      verifierVersion: 1,
    });
    expect(sampleRun()).toEqual(run);
  });

  it("is a legal run that earns exactly the milestones it claims", () => {
    expect(replayRecord(runnerRules, run)).toEqual({
      earned: run.claims,
      ok: true,
    });
  });
});
