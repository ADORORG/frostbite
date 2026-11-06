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
const launch = (overrides: object = {}) => ({
  basePath: "",
  mode: "external",
  returnUrl: null,
  url: "https://play.example.test",
  ...overrides,
});
const manifest = (overrides: Partial<GameManifest> = {}): GameManifest => ({
  capabilities: ["wallet"],
  description: "A longer description.",
  id: "sample-game",
  launch: {
    basePath: "",
    mode: "external",
    returnUrl: null,
    url: "https://play.example.test",
  },
  milestones: [milestone],
  network: chain,
  schemaVersion: 1,
  summary: "A sample game.",
  tags: ["arcade"],
  title: "Sample game",
  version: "1.2.3",
  ...overrides,
});

describe("game identifiers", () => {
  it.each(["example-game", "sample-game", "game-2", "ab"])(
    "accepts %s",
    (id) => {
      expect(gameIdSchema.safeParse(id).success).toBe(true);
    },
  );

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
    expect(gameHref("example-game")).toBe("/games/example-game");
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
          launch: {
            basePath: "",
            mode: "external",
            returnUrl: null,
            url: null,
          },
          milestones: [],
        }),
      ).success,
    ).toBe(true);
  });

  it.each<[string, object]>([
    ["an unknown field", { extra: 1 }],
    ["another schema version", { schemaVersion: 2 }],
    ["a script address", { launch: launch({ url: "javascript:alert(1)" }) }],
    ["a file address", { launch: launch({ url: "file:///etc/passwd" }) }],
    ["another launch mode", { launch: launch({ mode: "embedded" }) }],
    ["a capability that does not exist", { capabilities: ["root"] }],
    ["a capability twice", { capabilities: ["wallet", "wallet"] }],
    ["two milestones with one id", { milestones: [milestone, milestone] }],
    ["no tags", { tags: [] }],
    ["tags left out", { tags: undefined }],
    ["a tag that is not on the platform's list", { tags: ["Arcade"] }],
    ["a tag twice", { tags: ["arcade", "arcade"] }],
    [
      "more tags than a card can carry",
      { tags: ["action", "arcade", "endless", "puzzle", "reflex"] },
    ],
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
      {
        launch: {
          basePath: "",
          mode: "external",
          returnUrl: null,
          url: "https://other.example.test",
        },
      },
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

  describe("a scene for the card", () => {
    it("is named by a scene's id, is optional, and is part of what the manifest hashes to", () => {
      expect(
        gameManifestSchema.safeParse({ ...manifest(), scene: "runner" })
          .success,
      ).toBe(true);
      expect(gameManifestSchema.safeParse(manifest()).success).toBe(true);
      expect(gameManifestHash({ ...manifest(), scene: "runner" })).not.toBe(
        gameManifestHash(manifest()),
      );
    });

    it.each(["Runner", "road hopper", "1runner", "", "a".repeat(33), "run/er"])(
      "refuses %j, which cannot be a scene's id",
      (scene) => {
        expect(
          gameManifestSchema.safeParse({ ...manifest(), scene }).success,
        ).toBe(false);
      },
    );

    it("refuses something that is not text", () => {
      expect(
        gameManifestSchema.safeParse({ ...manifest(), scene: 7 }).success,
      ).toBe(false);
    });
  });

  describe("a cover", () => {
    const embedded = { launch: { mode: "embedded" } } as const;
    const cover = {
      alt: "A glacier.",
      image: "cover.webp",
      video: "cover.mp4",
    };

    it("is a picture and optionally a clip, named by file, for a game the platform plays itself", () => {
      expect(
        gameManifestSchema.safeParse({ ...manifest(embedded), cover }).success,
      ).toBe(true);
      expect(
        gameManifestSchema.safeParse({
          ...manifest(embedded),
          cover: { ...cover, video: null },
        }).success,
      ).toBe(true);
    });

    it("is optional, and a manifest without one hashes as it did before covers existed", () => {
      expect(gameManifestSchema.safeParse(manifest(embedded)).success).toBe(
        true,
      );
      expect(gameManifestHash(manifest(embedded))).not.toBe(
        gameManifestHash({ ...manifest(embedded), cover }),
      );
    });

    it("cannot be given to a game that lives at another address, because the files would not come with it", () => {
      const result = gameManifestSchema.safeParse({ ...manifest(), cover });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["cover"]);
    });

    it.each([
      ["a path", { image: "../cover.webp" }],
      ["a folder", { image: "a/cover.webp" }],
      ["a remote address", { image: "https://x.test/cover.webp" }],
      ["a clip as the picture", { image: "cover.mp4" }],
      ["a picture as the clip", { video: "cover.png" }],
      ["a script as the picture", { image: "cover.js" }],
      ["a name that starts with a dot", { image: ".cover.png" }],
      ["no words for it", { alt: "  " }],
      [
        "too many words for it",
        { alt: "a".repeat(gameManifestLimits.coverAlt + 1) },
      ],
      ["a field nobody knows", { poster: "x.png" }],
    ])("refuses %s", (_what, change) => {
      expect(
        gameManifestSchema.safeParse({
          ...manifest(embedded),
          cover: { ...cover, ...change },
        }).success,
      ).toBe(false);
    });
  });
});
