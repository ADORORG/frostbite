import { gameManifestSchema } from "@ador/shared/games";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { targetChains } from "../../../configs/chains.ts";

const signet = targetChains[0]?.chainId ?? "";

// The game list reads the deployment's settings when it is first imported, so each case sets them and
// imports it afresh.
async function gamesWith(launches: string, appEnv = "local") {
  vi.resetModules();
  vi.stubEnv("APP_ENV", appEnv);
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Adorbitals");
  vi.stubEnv("GAME_LAUNCHES", launches);
  return (await import("../../../configs/games.ts")).games;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the platform's game list", () => {
  it("lists FROST·BITE, first, then the two development games while the platform runs for development, and every game passes the manifest schema", async () => {
    const games = await gamesWith("");
    expect(games.map(({ id }) => id)).toEqual([
      "frostbite",
      "sample-game",
      "sdk-explorer",
    ]);
    for (const game of games)
      expect(gameManifestSchema.safeParse(game).success).toBe(true);
  });

  it("plays FROST·BITE on the platform itself, with no address to set, and declares three of its own marks as milestones, replay-verifiable only where the rules can decide them, and only what the platform grants", async () => {
    const [frostbite] = await gamesWith("");
    expect(frostbite?.launch).toEqual({ mode: "embedded" });
    expect(frostbite?.capabilities).toEqual(["run:submit"]);
    expect(
      frostbite?.milestones.map(({ id, verification }) => [id, verification]),
    ).toEqual([
      ["first-win", "replay-verified"],
      ["first-glacier", "replay-verified"],
      // A simulation event: no replay can decide it, so it stays the game's own report.
      ["first-cashout", undefined],
    ]);
    expect(frostbite?.network).toBe(signet);
  });

  // The two hosting styles for a game that is played at an address of its own are checked on the launch rules
  // themselves (packages/shared) and in a real browser (tests/e2e game-hosting); no game is registered that way
  // today, so a deployment's address setting has nothing to name.
  it("refuses an address setting for FROST·BITE, which the platform plays itself", async () => {
    await expect(
      gamesWith(
        JSON.stringify({ frostbite: { url: "https://frostbite.example.com" } }),
      ),
    ).rejects.toThrow('Launch settings name "frostbite"');
  });

  it.each([
    ["test", true],
    ["local", true],
    ["preview", false],
    ["production", false],
  ])("lists the sample game in %s: %s", async (appEnv, listed) => {
    const ids = (await gamesWith("", appEnv)).map(({ id }) => id);
    expect(ids.includes("sample-game")).toBe(listed);
    expect(ids[0]).toBe("frostbite");
  });

  it("plays the sample game on the platform itself, in the frame, with the milestones its code awards", async () => {
    const sample = (await gamesWith("")).find(({ id }) => id === "sample-game");
    expect(sample?.launch).toEqual({ mode: "embedded" });
    expect(sample?.milestones.map(({ id }) => id)).toEqual([
      "first-five",
      "ten-taps",
    ]);
  });

  it("refuses a launch setting for a game the platform plays itself", async () => {
    await expect(
      gamesWith(
        JSON.stringify({ "sample-game": { url: "https://a.example.com" } }),
      ),
    ).rejects.toThrow("Launch settings name");
  });

  it("refuses to start with a setting for a game that is not registered", async () => {
    await expect(
      gamesWith(
        JSON.stringify({ frostbyte: { url: "https://a.example.com" } }),
      ),
    ).rejects.toThrow('"frostbyte"');
  });

  it("refuses to start with a game on a chain that is not configured", async () => {
    vi.resetModules();
    vi.doMock("../../../configs/games/frostbite.ts", async (original) => {
      const { frostbite } =
        await original<typeof import("../../../configs/games/frostbite.ts")>();
      return { frostbite: { ...frostbite, network: "eip155:1" } };
    });
    try {
      await expect(gamesWith("")).rejects.toThrow("not a configured chain");
    } finally {
      vi.doUnmock("../../../configs/games/frostbite.ts");
    }
  });

  it("starts with a game on a configured chain", async () => {
    const games = await gamesWith("");
    expect(games.every(({ network }) => network === signet)).toBe(true);
  });
});
