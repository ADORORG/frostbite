import { describe, expect, it } from "vitest";

import {
  gameManifestHash,
  gameManifestSchema,
  gameRewardsSchema,
  milestoneClaimLimit,
  rewardsInitialisation,
} from "../src/games/index.ts";

const once = {
  claimPolicy: "once",
  criteria: "Win a board.",
  description: "You won.",
  id: "first-win",
  title: "First win",
} as const;
const repeatable = {
  claimPolicy: "repeatable",
  criteria: "Win again.",
  description: "You won again.",
  id: "streak",
  maxCount: 5,
  title: "Streak",
} as const;
const rewards = { templateId: "game-rewards", templateVersion: "1.0.0" };
const manifest = (over: object = {}) => ({
  capabilities: [],
  description: "",
  id: "sample-game",
  launch: { mode: "embedded" },
  milestones: [once],
  network: "bip122:00000008819873e925422c1ff0f99f7c",
  schemaVersion: 1,
  summary: "A game.",
  tags: ["arcade"],
  title: "Sample",
  version: "1",
  ...over,
});
const accepts = (value: object) => gameManifestSchema.safeParse(value).success;
const message = (value: object) => {
  const result = gameManifestSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? null);
};

describe("a game's rewards declaration", () => {
  it("is accepted with a template and a version, and is optional", () => {
    expect(accepts(manifest({ rewards }))).toBe(true);
    expect(accepts(manifest())).toBe(true);
  });

  it.each([
    ["no template", { templateVersion: "1.0.0" }],
    ["no version", { templateId: "game-rewards" }],
    [
      "a template that is not a slug",
      { ...rewards, templateId: "Game Rewards" },
    ],
    [
      "a template that starts with a digit",
      { ...rewards, templateId: "1rewards" },
    ],
    [
      "a template over 64 characters",
      { ...rewards, templateId: `a${"b".repeat(64)}` },
    ],
    ["a version that is not semantic", { ...rewards, templateVersion: "1.0" }],
    ["a version with a label", { ...rewards, templateVersion: "1.0.0-beta" }],
    ["a field it does not have", { ...rewards, contract: "x" }],
  ])("refuses %s", (_name, value) => {
    expect(gameRewardsSchema.safeParse(value).success).toBe(false);
    expect(accepts(manifest({ rewards: value }))).toBe(false);
  });

  it("needs a milestone to claim", () => {
    expect(message(manifest({ milestones: [], rewards }))).toBe(
      "A game that declares a rewards contract needs at least one milestone to claim from it.",
    );
  });

  it("is what the milestone:claim capability needs, and the capability is refused without it", () => {
    expect(
      accepts(manifest({ capabilities: ["milestone:claim"], rewards })),
    ).toBe(true);
    expect(message(manifest({ capabilities: ["milestone:claim"] }))).toBe(
      "A game can declare the milestone:claim capability only with a rewards contract to claim from.",
    );
    // Rewards without the capability is fine: the player can claim from the platform's own page.
    expect(accepts(manifest({ rewards, capabilities: ["wallet"] }))).toBe(true);
  });

  it("is part of what the manifest's hash covers", () => {
    const plain = gameManifestSchema.parse(manifest());
    const claimable = gameManifestSchema.parse(manifest({ rewards }));
    const newer = gameManifestSchema.parse(
      manifest({ rewards: { ...rewards, templateVersion: "1.1.0" } }),
    );
    expect(gameManifestHash(claimable)).not.toBe(gameManifestHash(plain));
    expect(gameManifestHash(newer)).not.toBe(gameManifestHash(claimable));
    // A manifest that declares none carries no `rewards` key at all, so it hashes as it always did.
    expect(Object.keys(plain)).not.toContain("rewards");
  });
});

describe("the claim limit a milestone's policy gives", () => {
  it("is one for a milestone earned once, and the maximum count for a repeatable one", () => {
    expect(milestoneClaimLimit(once)).toBe(1);
    expect(milestoneClaimLimit(repeatable)).toBe(5);
  });

  it("refuses a repeatable milestone that has no maximum, which the manifest never lets through", () => {
    expect(() => milestoneClaimLimit({ claimPolicy: "repeatable" })).toThrow(
      RangeError,
    );
  });
});

describe("what the rewards contract is initialised with", () => {
  it("is nothing for a game that declares no rewards", () => {
    expect(rewardsInitialisation({ milestones: [once] })).toBeNull();
  });

  it("enables every milestone the game declares, each with its own limit, taken from the manifest alone", () => {
    expect(
      rewardsInitialisation({ milestones: [once, repeatable], rewards }),
    ).toEqual({
      milestones: [
        { claimLimit: 1, id: "first-win" },
        { claimLimit: 5, id: "streak" },
      ],
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    });
  });
});
