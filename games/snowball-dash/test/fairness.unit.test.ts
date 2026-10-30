import { describe, expect, it } from "vitest";

import { snowballRules } from "../src/rules/index.ts";
import { layRocks } from "../src/rules/course.ts";
import { sampleRun } from "../src/sample-run.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { playWithLead } from "./support/bot.ts";

const seeds = [1, 2, 3, 4, 5, 20_261_030];

describe("the game is playable and every milestone can be earned", () => {
  it("lets a careful player reach the foot on every seed", () => {
    for (const seed of seeds) {
      const state = playWithLead(seed, 40).state();
      expect(state.finished, `seed ${String(seed)}`).toBe(true);
      expect(state.cleared).toBe(layRocks(seed).length);
    }
  });

  it("ends a run that does nothing at the first rock, with only the first 25 metres it rolled", () => {
    for (const seed of seeds) {
      const bot = playWithLead(seed, 0);
      expect(bot.state().alive).toBe(false);
      expect(bot.state().cleared).toBe(0);
      expect(bot.earned()).toEqual(["metres-25"]);
    }
  });

  it("lets a run that cuts every rock fine earn all but one of the forty, on every seed", () => {
    for (const seed of seeds) {
      const earned = [13, 14, 15, 16].map((lead) =>
        playWithLead(seed, lead).earned(),
      );
      expect(
        earned.some((ids) => ids.length === milestoneIds.length - 1),
        `seed ${String(seed)}`,
      ).toBe(true);
    }
  });

  it("lets a run with room to spare at every rock earn the comfortable run, on every seed", () => {
    for (const seed of seeds) {
      const earned = playWithLead(seed, 40).earned();
      expect(earned, `seed ${String(seed)}`).toContain("comfortable-run");
      expect(earned).not.toContain("close-shave");
    }
  });

  it("lets a run cut at least eight rocks fine on every seed, so the razor finish can be earned", () => {
    for (const seed of seeds) {
      const earned = [13, 14, 15, 16, 17].map((lead) =>
        playWithLead(seed, lead).earned(),
      );
      expect(
        earned.some((ids) => ids.includes("razor-finish")),
        `seed ${String(seed)}`,
      ).toBe(true);
    }
  });

  it("makes the same run twice from the same seed and choices, and another slope from another seed", () => {
    expect(playWithLead(9, 14).record()).toEqual(playWithLead(9, 14).record());
    expect(playWithLead(9, 14).state().rocks).not.toEqual(
      playWithLead(10, 14).state().rocks,
    );
  });
});

describe("the sample run the verifier is shown", () => {
  it("replays, and earns exactly the milestones it claims: thirty-nine of the forty", () => {
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
    expect(record.claims).toEqual(
      milestoneIds.filter((id) => id !== "comfortable-run"),
    );
  });
});
