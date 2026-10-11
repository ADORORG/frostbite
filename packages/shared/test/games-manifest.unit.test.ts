import { describe, expect, it } from "vitest";

import {
  defineGame,
  defineGames,
  gameHref,
  gameIdSchema,
  gameManifestHash,
  gameManifestLimits,
  gameManifestSchema,
  type GameManifest,
} from "../src/games/index.ts";

const chain = "bip122:00000008819873e925422c1ff0f99f7c";
const milestone = {
  claimPolicy: "once",
  criteria: "Finish a run without hitting a mine.",
  description: "Cleared the board.",
  id: "first-clear",
  title: "First clear",
} as const;
const manifest = (overrides: Partial<GameManifest> = {}): GameManifest => ({
  capabilities: ["wallet"],
  description: "A longer description.",
  id: "sample-game",
  launch: { mode: "external", url: "https://play.example.test/sample" },
  milestones: [milestone],
  network: chain,
  schemaVersion: 1,
  summary: "A sample game.",
  title: "Sample game",
  version: "1.2.3",
  ...overrides,
});

describe("game identifiers", () => {
  it.each(["frostbite", "sample-game", "game-2", "ab"])("accepts %s", (id) => {
    expect(gameIdSchema.safeParse(id).success).toBe(true);
  });

  it.each([
    "",
    "a",
    "Frostbite",
    "two words",
    "-lead",
    "trail-",
    "double--dash",
    "../admin",
    "x".repeat(65),
  ])("refuses %j", (id) => {
    expect(gameIdSchema.safeParse(id).success).toBe(false);
  });

  it("builds the page address from the identifier", () => {
    expect(gameHref("frostbite")).toBe("/games/frostbite");
  });
});

describe("a game manifest", () => {
  it("accepts a complete manifest and trims its text", () => {
    const parsed = gameManifestSchema.parse(
      manifest({ summary: "  Padded  ", title: " Sample " }),
    );
    expect(parsed).toMatchObject({ summary: "Padded", title: "Sample" });
  });

  it("accepts a game with no play address, no capabilities and no milestones", () => {
    expect(
      gameManifestSchema.safeParse(
        manifest({
          capabilities: [],
          launch: { mode: "external", url: null },
          milestones: [],
        }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ["an unknown field", { extra: 1 }],
    ["another schema version", { schemaVersion: 2 }],
    [
      "a script address",
      { launch: { mode: "external", url: "javascript:alert(1)" } },
    ],
    [
      "a file address",
      { launch: { mode: "external", url: "file:///etc/passwd" } },
    ],
    ["another launch mode", { launch: { mode: "embedded", url: null } }],
    ["a capability that does not exist", { capabilities: ["root"] }],
    ["a capability twice", { capabilities: ["wallet", "wallet"] }],
    ["two milestones with one id", { milestones: [milestone, milestone] }],
    ["a blank title", { title: "  " }],
    ["a blank summary", { summary: "" }],
    ["a chain that is not a chain reference", { network: "signet" }],
    [
      "a title that is too long",
      { title: "x".repeat(gameManifestLimits.title + 1) },
    ],
    [
      "too many milestones",
      {
        milestones: Array.from(
          { length: gameManifestLimits.milestones + 1 },
          (_, at) => ({
            ...milestone,
            id: `m-${String(at)}`,
          }),
        ),
      },
    ],
  ])("refuses %s", (_why, overrides) => {
    expect(
      gameManifestSchema.safeParse({ ...manifest(), ...overrides }).success,
    ).toBe(false);
  });

  it("refuses a milestone with an empty criteria or an unknown claim policy", () => {
    expect(
      gameManifestSchema.safeParse(
        manifest({ milestones: [{ ...milestone, criteria: "" }] }),
      ).success,
    ).toBe(false);
    expect(
      gameManifestSchema.safeParse({
        ...manifest(),
        milestones: [{ ...milestone, claimPolicy: "always" }],
      }).success,
    ).toBe(false);
  });
});

describe("defining games", () => {
  it("checks and freezes what a game file exports", () => {
    const game = defineGame(manifest());
    expect(Object.isFrozen(game)).toBe(true);
    expect(() => defineGame({ ...manifest(), title: "" })).toThrow();
  });

  it("keeps the order given and refuses an identifier used twice", () => {
    const list = defineGames([
      manifest({ id: "second-game" }),
      manifest({ id: "first-game" }),
    ]);
    expect(list.map(({ id }) => id)).toEqual(["second-game", "first-game"]);
    expect(Object.isFrozen(list)).toBe(true);
    expect(() => defineGames([manifest(), manifest()])).toThrow(
      'Game "sample-game" is registered twice.',
    );
    expect(defineGames([])).toEqual([]);
  });
});

describe("the declarations digest", () => {
  it("is 64 hex characters and does not depend on the order of keys", () => {
    const reordered = Object.fromEntries(
      Object.entries(manifest()).reverse(),
    ) as GameManifest;
    expect(gameManifestHash(manifest())).toMatch(/^[0-9a-f]{64}$/u);
    expect(gameManifestHash(reordered)).toBe(gameManifestHash(manifest()));
  });

  it.each<[string, Partial<GameManifest>]>([
    ["a milestone", { milestones: [{ ...milestone, criteria: "Different." }] }],
    [
      "the play address",
      { launch: { mode: "external", url: "https://other.example.test/" } },
    ],
    ["a capability", { capabilities: [] }],
    ["the version", { version: "1.2.4" }],
  ])("changes when %s changes", (_what, overrides) => {
    expect(gameManifestHash({ ...manifest(), ...overrides })).not.toBe(
      gameManifestHash(manifest()),
    );
  });

  it("refuses to hash a manifest that is not valid", () => {
    expect(() => gameManifestHash({ ...manifest(), title: "" })).toThrow();
  });
});
