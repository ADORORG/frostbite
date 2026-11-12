import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { heroIds } from "../src/rules/constants.ts";
import { savageRules } from "../src/rules/index.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { clumsy } from "./support/bot.ts";
import { playWhole } from "./support/plan.ts";

const replay = (
  seed: number,
  inputs: Parameters<typeof replayRecord>[1]["inputs"],
) =>
  replayRecord(savageRules, {
    claims: [],
    config: {},
    gameId: "peaceful-savage",
    inputs,
    schemaVersion: 1,
    seed,
    verifier: "peaceful-savage",
    verifierVersion: 1,
  });

// A careful player can earn every milestone, leading once as each of the family; a clumsy one still lights the tree.
describe("every goal can be reached by a legal run", () => {
  it("lights the tree as each of the family, and between them earns every milestone", () => {
    const earned = new Set<string>();
    for (const [index, lead] of heroIds.entries()) {
      const bot = playWhole({ lead, seed: 20_261_107 + index });
      bot.finish();
      expect(bot.state.cause).toBe("lit");
      const replayed = replay(20_261_107 + index, bot.inputs);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) for (const id of replayed.earned) earned.add(id);
      expect(bot.state.tick).toBeLessThan(40_000);
    }
    expect([...earned].sort()).toEqual([...milestoneIds].sort());
  }, 60_000);

  it("lets a clumsy player, late on every beat and tricked once by every grey, still light the tree", () => {
    const bot = playWhole({ lead: "zora", seed: 7, style: clumsy });
    expect(bot.state.cause).toBe("lit");
    expect(bot.state.tricks).toBeGreaterThan(0);
    const replayed = replay(7, bot.inputs);
    expect(replayed.ok && replayed.earned).not.toContain("clean-heart");
    expect(replayed.ok && replayed.earned).toContain("light-as-zora");
  }, 60_000);
});
