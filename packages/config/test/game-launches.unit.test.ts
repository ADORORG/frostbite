import { describe, expect, it } from "vitest";

import {
  developmentGamesEnabled,
  parseGameLaunchEnvironment,
} from "../src/env/runtime.ts";

const base = {
  APP_ENV: "local",
  NEXT_PUBLIC_APP_NAME: "Frostbite",
  PUBLIC_BASE_URL: "https://platform.example.com",
};
const launchFor = (setting: object) =>
  JSON.stringify({ "example-game": setting });
const parse = (GAME_LAUNCHES: string | undefined, extra: object = {}) =>
  parseGameLaunchEnvironment({ ...base, ...extra, GAME_LAUNCHES });

describe("GAME_LAUNCHES", () => {
  it.each([undefined, "", "   "])(
    "means no game has a play address when %j",
    (value) => {
      expect(parse(value)).toEqual({});
    },
  );

  it("reads each game's host, base path, return address and network, with defaults", () => {
    expect(
      parse(
        JSON.stringify({
          "example-game": {
            basePath: "/play/example-game",
            network: "bip122:00000008819873e925422c1ff0f99f7c",
            returnUrl: "https://platform.example.com/games/example-game",
            url: "https://play.example.com",
          },
          other: { url: "http://localhost:5173" },
        }),
      ),
    ).toEqual({
      "example-game": {
        basePath: "/play/example-game",
        network: "bip122:00000008819873e925422c1ff0f99f7c",
        returnUrl: "https://platform.example.com/games/example-game",
        url: "https://play.example.com",
      },
      other: { basePath: "", returnUrl: null, url: "http://localhost:5173" },
    });
  });

  it.each([
    ["JSON that is not JSON", "{nope"],
    ["a list instead of an object", "[]"],
    [
      "a game id that cannot be one",
      JSON.stringify({ "Frost Bite": { url: "https://a.example.com" } }),
    ],
    ["a host with a path", launchFor({ url: "https://a.example.com/play" })],
    ["a script address", launchFor({ url: "javascript:alert(1)" })],
    [
      "a base path that climbs",
      launchFor({ basePath: "/../admin", url: "https://a.example.com" }),
    ],
    [
      "an unknown field",
      launchFor({ extra: true, url: "https://a.example.com" }),
    ],
    ["no host", launchFor({})],
  ])("refuses %s", (_why, value) => {
    expect(() => parse(value)).toThrow();
  });

  it.each(["preview", "production"])(
    "requires an HTTPS host in %s",
    (APP_ENV) => {
      expect(() =>
        parse(launchFor({ url: "http://play.example.com" }), { APP_ENV }),
      ).toThrow("must use HTTPS");
      expect(
        parse(launchFor({ url: "https://play.example.com" }), { APP_ENV }),
      ).toHaveProperty("example-game");
    },
  );

  it.each(["local", "test"])("allows a plain http host in %s", (APP_ENV) => {
    expect(
      parse(launchFor({ url: "http://localhost:5173" }), { APP_ENV }),
    ).toHaveProperty("example-game");
  });

  it("only returns players to the platform's own origin", () => {
    expect(() =>
      parse(
        launchFor({
          returnUrl: "https://evil.example.net/games/example-game",
          url: "https://play.example.com",
        }),
      ),
    ).toThrow("must be on https://platform.example.com");
    expect(() =>
      parse(
        launchFor({
          returnUrl: "https://platform.example.com.evil.example.net/x",
          url: "https://play.example.com",
        }),
      ),
    ).toThrow("must be on");
  });

  it("needs the platform's own environment to be valid", () => {
    expect(() =>
      parseGameLaunchEnvironment({
        GAME_LAUNCHES: launchFor({ url: "https://play.example.com" }),
      }),
    ).toThrow();
  });

  it("never plays a game on the platform's own origin, with or without a base path", () => {
    for (const setting of [
      { url: "https://platform.example.com" },
      { basePath: "/play/example-game", url: "https://platform.example.com" },
    ])
      expect(() => parse(launchFor(setting))).toThrow("platform's own origin");
    // A sibling host or another port is a different origin and is allowed.
    expect(
      parse(launchFor({ url: "https://games.platform.example.com" })),
    ).toHaveProperty("example-game");
    expect(
      parse(launchFor({ url: "https://platform.example.com:8443" })),
    ).toHaveProperty("example-game");
  });
});

describe("development games", () => {
  it.each([
    ["local", true],
    ["test", true],
    ["preview", false],
    ["production", false],
    [undefined, false],
    ["Local", false],
    ["", false],
  ])("are listed in %j: %s", (APP_ENV, listed) => {
    expect(developmentGamesEnabled({ APP_ENV })).toBe(listed);
  });
});
