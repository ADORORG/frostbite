import { describe, expect, it } from "vitest";

import {
  gameManifestLimits,
  gameManifestSchema,
  gameMilestoneSchema,
  gameManifestHash,
  type GameManifest,
} from "../src/games/index.ts";

const base = {
  claimPolicy: "once",
  criteria: "Win ten boards.",
  description: "Ten wins.",
  id: "ten-wins",
  title: "Ten wins",
} as const;
const repeatable = {
  ...base,
  claimPolicy: "repeatable",
  id: "win",
  maxCount: 100,
} as const;
const manifest = (milestones: object[]): GameManifest =>
  gameManifestSchema.parse({
    capabilities: [],
    description: "",
    id: "sample-game",
    launch: { mode: "embedded" },
    milestones,
    network: "bip122:00000008819873e925422c1ff0f99f7c",
    schemaVersion: 1,
    summary: "A game.",
    title: "Sample",
    version: "1",
  });

describe("a milestone with a target", () => {
  it("is earned once, and says how many it takes", () => {
    expect(gameMilestoneSchema.parse({ ...base, target: 10 }).target).toBe(10);
  });

  it("is optional, and a milestone without one hashes as it did before targets existed", () => {
    const without = manifest([base]);
    expect(without.milestones[0]).not.toHaveProperty("target");
    expect(gameManifestHash(without)).toBe(gameManifestHash(manifest([base])));
    expect(gameManifestHash(manifest([{ ...base, target: 10 }]))).not.toBe(
      gameManifestHash(without),
    );
  });

  it.each([
    ["a target of one (the game reports it directly)", { target: 1 }],
    ["a target of nothing", { target: 0 }],
    ["a fractional target", { target: 2.5 }],
    [
      "a target without a limit",
      { target: gameManifestLimits.milestoneCount + 1 },
    ],
    ["a maximum count, which only a repeatable one has", { maxCount: 5 }],
  ])("is refused with %s", (_why, extra) => {
    expect(gameMilestoneSchema.safeParse({ ...base, ...extra }).success).toBe(
      false,
    );
  });
});

describe("a repeatable milestone", () => {
  it("needs a maximum count, which a reviewer sees in the pull request", () => {
    expect(gameMilestoneSchema.parse(repeatable).maxCount).toBe(100);
    const without = Object.fromEntries(
      Object.entries(repeatable).filter(([key]) => key !== "maxCount"),
    );
    expect(gameMilestoneSchema.safeParse(without).success).toBe(false);
  });

  it.each([
    ["a maximum of one", { maxCount: 1 }],
    ["a fractional maximum", { maxCount: 2.5 }],
    [
      "a maximum without a limit",
      { maxCount: gameManifestLimits.milestoneCount + 1 },
    ],
    ["a target, which only a milestone earned once has", { target: 10 }],
  ])("is refused with %s", (_why, extra) => {
    expect(
      gameMilestoneSchema.safeParse({ ...repeatable, ...extra }).success,
    ).toBe(false);
  });

  it("accepts the largest maximum the limit allows", () => {
    expect(
      gameMilestoneSchema.safeParse({
        ...repeatable,
        maxCount: gameManifestLimits.milestoneCount,
      }).success,
    ).toBe(true);
  });
});
