import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { checkGameConformance } from "@frostbite/test-kit/game-conformance";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gamesDirectory = join(import.meta.dirname, "../../../games");

// Every game the platform plays itself is checked here, the same way, so a game cannot be listed without
// passing and no game has to remember to ask. The list is read as the platform runs for development, which is
// when every game, including SDK Explorer, is registered.
async function registeredGames() {
  vi.resetModules();
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbite");
  vi.stubEnv("GAME_LAUNCHES", "");
  return (await import("@repo/configs/games")).games;
}

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe("the games the platform plays itself", () => {
  it("has source for every embedded game and lists every game that has source", async () => {
    const games = await registeredGames();
    const listed = games
      .filter(({ launch }) => launch.mode === "embedded")
      .map(({ id }) => id)
      .sort();
    const folders = (await readdir(gamesDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .sort();
    expect(listed).toEqual(folders);
    expect(listed.length).toBeGreaterThan(0);
  });

  it("conform to the platform's interface: a valid page, ready, never refused, nothing uncaught", async () => {
    const games = await registeredGames();
    const embedded = games.filter(({ launch }) => launch.mode === "embedded");
    for (const game of embedded)
      expect(
        await checkGameConformance({
          cover: game.cover,
          folder: join(gamesDirectory, game.id),
          game,
        }),
        `Game "${game.id}"`,
      ).toEqual([]);
  });
});
