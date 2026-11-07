import { gameManifestSchema } from "@frostbite/shared/games";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { targetChains } from "@repo/configs/chains";
import { fixtureTapsGame } from "@repo/configs/games/fixture-taps";
import { sdkExplorerGame } from "@repo/configs/games/sdk-explorer";

const signet = targetChains[0]?.chainId ?? "";

// The game list reads the deployment's settings when it is first imported, so each case sets them and
// imports it afresh.
async function gamesWith(launches: string, appEnv = "local") {
  vi.resetModules();
  vi.stubEnv("APP_ENV", appEnv);
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbite");
  vi.stubEnv("GAME_LAUNCHES", launches);
  return (await import("@repo/configs/games")).games;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the platform's game list", () => {
  it("lists each game once, the games that exist to check the platform among them while it runs for development, and every game passes the manifest schema", async () => {
    const games = await gamesWith("");
    const ids = games.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([sdkExplorerGame.id, fixtureTapsGame.id]),
    );
    for (const game of games)
      expect(gameManifestSchema.safeParse(game).success).toBe(true);
  });

  it.each([
    ["test", true],
    ["local", true],
    ["preview", false],
    ["production", false],
  ])(
    "lists the games that exist to check the platform in %s: %s",
    async (appEnv, listed) => {
      const ids = (await gamesWith("", appEnv)).map(({ id }) => id);
      expect(ids.includes(sdkExplorerGame.id)).toBe(listed);
      expect(ids.includes(fixtureTapsGame.id)).toBe(listed);
      expect(ids.length).toBeGreaterThan(0);
    },
  );

  it.each(["local", "production"])(
    "lists Pocket Dragon first in %s, because the first game is the one shown larger",
    async (appEnv) => {
      const ids = (await gamesWith("", appEnv)).map(({ id }) => id);
      expect(ids[0]).toBe("pocket-dragon");
    },
  );

  it("declares a rewards contract on each of the games built for players, so staff can create it", async () => {
    const games = await gamesWith("");
    for (const id of [
      "frost-runner",
      "icicle-drop",
      "tower-stack",
      "bro-maria",
    ]) {
      const game = games.find((listed) => listed.id === id);
      expect(game?.rewards).toEqual({
        templateId: "game-rewards",
        templateVersion: "1.0.0",
      });
      expect(game?.capabilities).toContain("milestone:claim");
    }
  });

  it("refuses a launch setting for a game the platform plays itself", async () => {
    await expect(
      gamesWith(
        JSON.stringify({ "sdk-explorer": { url: "https://a.example.com" } }),
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
    vi.doMock("@repo/configs/games/fixture-taps", async (original) => {
      const { fixtureTapsGame: game } =
        await original<typeof import("@repo/configs/games/fixture-taps")>();
      return { fixtureTapsGame: { ...game, network: "eip155:1" } };
    });
    try {
      await expect(gamesWith("")).rejects.toThrow("not a configured chain");
    } finally {
      vi.doUnmock("@repo/configs/games/fixture-taps");
    }
  });

  it("starts with a game on a configured chain", async () => {
    const games = await gamesWith("");
    expect(games.every(({ network }) => network === signet)).toBe(true);
  });
});
