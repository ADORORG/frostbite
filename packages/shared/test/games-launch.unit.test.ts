import { describe, expect, it } from "vitest";

import {
  applyGameLaunchSettings,
  defineGame,
  embeddedGamePath,
  embeddedGameRoot,
  gameBasePathSchema,
  gameLaunchSettingsMapSchema,
  gameLaunchSettingsSchema,
  gameManifestSchema,
  gameOriginSchema,
  gamePlayAddress,
  type GameManifest,
} from "../src/games/index.ts";

const signet = "bip122:00000008819873e925422c1ff0f99f7c";
const game = (id = "sample-game"): GameManifest => ({
  capabilities: [],
  description: "",
  id,
  launch: { basePath: "", mode: "external", returnUrl: null, url: null },
  milestones: [],
  network: signet,
  schemaVersion: 1,
  summary: "A sample game.",
  title: "Sample game",
  version: "1.0.0",
});
type ExternalLaunch = Extract<GameManifest["launch"], { mode: "external" }>;
const launch = (overrides: Partial<ExternalLaunch> = {}): ExternalLaunch => ({
  basePath: "",
  mode: "external",
  returnUrl: null,
  url: null,
  ...overrides,
});

describe("a game's host", () => {
  it.each([
    "https://play.example.com",
    "http://localhost:5173",
    "https://example.com:8443",
  ])("accepts the origin %s", (value) => {
    expect(gameOriginSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["a trailing slash", "https://play.example.com/"],
    ["a path", "https://example.com/play"],
    ["a query", "https://example.com?x=1"],
    ["a fragment", "https://example.com#top"],
    ["credentials", "https://user:pass@example.com"],
    ["a script", "javascript:alert(1)"],
    ["a file", "file:///etc/passwd"],
    ["no scheme", "play.example.com"],
  ])("refuses an address with %s", (_why, value) => {
    expect(gameOriginSchema.safeParse(value).success).toBe(false);
  });
});

describe("a game's base path", () => {
  it.each(["", "/frostbite", "/play/frostbite", "/a.b/c_d", "/v1-2"])(
    "accepts %j",
    (value) => {
      expect(gameBasePathSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    "/",
    "frostbite",
    "/frostbite/",
    "//frostbite",
    "/../admin",
    "/./x",
    "/Frostbite",
    "/a b",
    "/a?x=1",
    "/a#b",
    "/%2e%2e",
    `/${"a".repeat(130)}`,
  ])("refuses %j", (value) => {
    expect(gameBasePathSchema.safeParse(value).success).toBe(false);
  });
});

describe("the address a player is sent to", () => {
  it("is nothing while no host is configured", () => {
    expect(gamePlayAddress(launch())).toBeNull();
  });

  it("is the host itself when the game has the whole host (subdomain style)", () => {
    expect(
      gamePlayAddress(launch({ url: "https://frostbite.example.com" })),
    ).toBe("https://frostbite.example.com/");
  });

  it("is the host plus the base path when the game lives under a path (domain-path style)", () => {
    expect(
      gamePlayAddress(
        launch({ basePath: "/play/frostbite", url: "https://example.com" }),
      ),
    ).toBe("https://example.com/play/frostbite");
  });

  it("keeps a port", () => {
    expect(
      gamePlayAddress(launch({ basePath: "/g", url: "http://localhost:5173" })),
    ).toBe("http://localhost:5173/g");
  });
});

describe("the launch settings of a deployment", () => {
  it("need only a host, and default the base path and return address", () => {
    expect(
      gameLaunchSettingsSchema.parse({ url: "https://play.example.com" }),
    ).toEqual({
      basePath: "",
      returnUrl: null,
      url: "https://play.example.com",
    });
  });

  it("refuse an unknown field, a missing host and a bad chain", () => {
    expect(gameLaunchSettingsSchema.safeParse({}).success).toBe(false);
    expect(
      gameLaunchSettingsSchema.safeParse({
        extra: 1,
        url: "https://a.example.com",
      }).success,
    ).toBe(false);
    expect(
      gameLaunchSettingsSchema.safeParse({
        network: "signet",
        url: "https://a.example.com",
      }).success,
    ).toBe(false);
  });

  it("are keyed by a valid game identifier", () => {
    const entry = { url: "https://a.example.com" };
    expect(
      gameLaunchSettingsMapSchema.safeParse({ "my-game": entry }).success,
    ).toBe(true);
    expect(
      gameLaunchSettingsMapSchema.safeParse({ "My Game": entry }).success,
    ).toBe(false);
  });
});

describe("applying launch settings to games", () => {
  const settings = {
    basePath: "/play/sample",
    network: "bip122:00000000000000000000000000000000",
    returnUrl: "https://platform.example.com/games/sample-game",
    url: "https://example.com",
  };

  it("sets the launch and the network of the game named, and leaves the others as they were", () => {
    const other = game("other-game");
    const [applied, untouched] = applyGameLaunchSettings([game(), other], {
      "sample-game": settings,
    });
    expect(applied?.launch).toEqual({
      basePath: "/play/sample",
      mode: "external",
      returnUrl: "https://platform.example.com/games/sample-game",
      url: "https://example.com",
    });
    expect(applied?.network).toBe(settings.network);
    expect(untouched).toBe(other);
    expect(gameManifestSchema.safeParse(applied).success).toBe(true);
  });

  it("keeps the manifest's own network when the setting names none", () => {
    const [applied] = applyGameLaunchSettings([game()], {
      "sample-game": {
        basePath: "",
        returnUrl: null,
        url: "https://example.com",
      },
    });
    expect(applied?.network).toBe(signet);
  });

  it("refuses a setting for a game that is not registered, naming it", () => {
    expect(() =>
      applyGameLaunchSettings([game()], {
        "sampel-game": {
          basePath: "",
          returnUrl: null,
          url: "https://example.com",
        },
      }),
    ).toThrow('"sampel-game"');
  });

  it("returns the games unchanged when there are no settings", () => {
    const list = [game()];
    expect(applyGameLaunchSettings(list, {})).toEqual(list);
    expect(defineGame(game()).launch).toMatchObject({ url: null });
  });
});

describe("a game the platform plays itself", () => {
  const embedded = (): GameManifest => ({
    ...game("tap-tower"),
    launch: { mode: "embedded" },
  });

  it("is accepted with no settings, and has no external address", () => {
    expect(gameManifestSchema.safeParse(embedded()).success).toBe(true);
    expect(gamePlayAddress(embedded().launch)).toBeNull();
  });

  it("cannot carry an address, a base path or any other setting", () => {
    for (const extra of [
      { url: "https://example.com" },
      { basePath: "/x" },
      { anything: 1 },
    ])
      expect(
        gameManifestSchema.safeParse({
          ...embedded(),
          launch: { mode: "embedded", ...extra },
        }).success,
      ).toBe(false);
  });

  it("is served from a folder named for the game, under the platform's play root", () => {
    expect(embeddedGameRoot).toBe("/play");
    expect(embeddedGamePath("tap-tower")).toBe("/play/tap-tower/");
  });

  it("refuses a launch setting naming it, because it has no address to set", () => {
    expect(() =>
      applyGameLaunchSettings([embedded()], {
        "tap-tower": {
          basePath: "",
          returnUrl: null,
          url: "https://example.com",
        },
      }),
    ).toThrow("plays itself");
  });
});
