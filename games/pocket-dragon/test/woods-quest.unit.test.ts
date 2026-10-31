import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { gameId, verifierId, verifierVersion } from "../src/rules/constants.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { swiftTicks } from "../src/rules/woods/constants.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { woodsEarned, woodsMilestones } from "../src/rules/woods/milestones.ts";
import { walkWoods } from "./support/woods-bot.ts";

const all = [true, true, true];

describe("the Whispering Woods' milestones", () => {
  it("are decided by what has been found and how soon Glitchy got out", () => {
    const start = startWoods(3);
    expect(woodsEarned(start)).toEqual([]);
    const found = {
      ...start,
      chests: [true, true, true, true, true],
      clues: all,
      lanterns: all,
      moonChest: true,
    };
    expect(woodsEarned(found)).toEqual([
      "woods-first-clue",
      "woods-all-clues",
      "woods-first-chest",
      "woods-chests-5",
      "woods-lanterns",
      "woods-frozen-chest",
    ]);
    const late = { ...found, escaped: true, finishTick: swiftTicks + 1 };
    expect(woodsEarned(late)).toContain("woods-everything");
    expect(woodsEarned(late)).not.toContain("woods-swift");
    expect(woodsEarned({ ...late, finishTick: swiftTicks })).toContain(
      "woods-swift",
    );
    const hurried = { ...late, chests: [true, false, false, false, false] };
    expect(woodsEarned(hurried)).not.toContain("woods-everything");
  });

  // A careful player who maps as they go (`support/woods-bot.ts`) finds everything and gets out well inside three minutes, on every
  // seed tried; one who goes straight for the clues gets out sooner still.
  it("can all be earned in one walk, and the gate can be reached sooner by skipping the treasure", () => {
    for (const seed of [11, 20_261_031, 1_989_854]) {
      const walked = walkWoods(seed);
      expect(woodsEarned(walked.state)).toEqual(woodsMilestones);
      expect(walked.inputs.length).toBeLessThan(5_000);
      const hurried = walkWoods(seed, { hurry: true });
      expect(hurried.state.escaped).toBe(true);
      expect(hurried.state.finishTick ?? 0).toBeLessThan(
        walked.state.finishTick ?? 0,
      );
    }
  }, 60_000);

  it("are given again when a walk's record is replayed through the published rules", () => {
    const walked = walkWoods(20_261_031);
    const record = {
      claims: [...woodsEarned(walked.state)],
      config: { cabinet: "woods" },
      gameId,
      inputs: [...walked.inputs],
      schemaVersion: 1 as const,
      seed: 20_261_031,
      verifier: verifierId,
      verifierVersion,
    };
    expect(replayRecord(pocketDragonRules, record)).toEqual({
      earned: woodsMilestones,
      ok: true,
    });
  }, 30_000);
});
