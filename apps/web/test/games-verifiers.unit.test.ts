import { stat } from "node:fs/promises";
import { join } from "node:path";

import { bundleVerifier } from "@ador/game-sdk/build";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gamesDirectory = join(import.meta.dirname, "../../../games");

async function registeredGames() {
  vi.resetModules();
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbit");
  vi.stubEnv("GAME_LAUNCHES", "");
  return (await import("../../../configs/games.ts")).games;
}
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

// A game publishes its rules by having `src/replay.ts`, and the platform replays runs only with an artifact whose digest the
// manifest pins. These two must agree, for every game, or a game's rules would change without a manifest change.
describe("the replay verifiers games publish", () => {
  it("are pinned in each manifest by the digest of the artifact the game's source builds, and nothing is published unpinned", async () => {
    const games = await registeredGames();
    for (const game of games) {
      const directory = join(gamesDirectory, game.id);
      const published = await exists(join(directory, "src/replay.ts"));
      expect(
        published,
        `${game.id}: a game with src/replay.ts must declare its replay verifier in its manifest, and one that declares it must have src/replay.ts`,
      ).toBe(game.verification !== undefined);
      if (game.verification === undefined) continue;
      const built = await bundleVerifier(directory);
      expect(built, `${game.id} builds no verifier`).not.toBeNull();
      // On a mismatch this prints the digest to put in the manifest.
      expect(
        { id: built?.id, sha256: built?.sha256, version: built?.version },
        `${game.id}: the manifest pins a different verifier than the source builds; pin ${built?.sha256 ?? "?"}`,
      ).toEqual(game.verification.replay);
    }
  });

  it("belong only to games that declare run:submit and a milestone to verify, which the manifest rules require", async () => {
    const games = await registeredGames();
    for (const game of games.filter(
      ({ verification }) => verification !== undefined,
    )) {
      expect(game.capabilities).toContain("run:submit");
      expect(
        game.milestones.some(
          ({ verification }) => verification === "replay-verified",
        ),
      ).toBe(true);
    }
  });
});
