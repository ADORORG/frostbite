import { randomInt, randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import {
  createDrizzleGameRunRepository,
  createGameRunsService,
  resolveGameRunPolicy,
  type GameRunGame,
} from "@frostbite/game-runs";
import { recordVerifiedMilestones } from "@frostbite/game-saves";
import { createGameVerifiers } from "@frostbite/game-verification/node";
import { resolveVerificationPolicy } from "@frostbite/game-verification/policy";
import type { VerifierRegistry } from "@frostbite/game-verification/registry";
import { verifyRun } from "@frostbite/game-verification/verify";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import { gameRunSeedMax, type GameManifest } from "@frostbite/shared/games";

import type { GameRunsConfig } from "./runs-config.ts";

// What the runs service may know of a game, read from its manifest and the verifiers the platform loaded: the digest it pinned
// and the milestones it declared replay-verifiable. A game with no loaded verifier is unknown to it, so it can neither start
// a run nor be asked about one.
export function gameRunLookup(
  games: readonly GameManifest[],
  registry: VerifierRegistry,
): (gameId: string) => GameRunGame | null {
  const byId = new Map(games.map((game) => [game.id, game]));
  return (gameId) => {
    const game = byId.get(gameId);
    const pinned = game?.verification?.replay;
    if (game === undefined || pinned === undefined) return null;
    if (registry.find(gameId) === undefined) return null;
    return {
      verifiable: new Set(
        game.milestones
          .filter(({ verification }) => verification === "replay-verified")
          .map(({ id }) => id),
      ),
      verifierSha256: pinned.sha256,
    };
  };
}

// The account side of replay-verified runs: the verifiers loaded once from the games' built files, one connection pool, and a
// settlement that writes the milestones a verdict earned in the same transaction as the verdict. A game whose verifier could
// not be loaded is logged and left self-reported; it never stops the others.
export function createGameRunsResolver(
  games: readonly GameManifest[],
  config: GameRunsConfig,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async () => {
    const { problems, registry } = await createGameVerifiers({
      games,
      playRoot: config.playRoot,
    });
    for (const { detail, gameId, reason } of problems)
      console.error(
        `game verifier ${gameId} not loaded (${reason}): ${detail}`,
      );
    const policy = resolveVerificationPolicy();
    return createGameRunsService({
      clock: () => new Date(),
      game: gameRunLookup(games, registry),
      newId: randomUUID,
      newSeed: () => randomInt(gameRunSeedMax + 1),
      policy: resolveGameRunPolicy(),
      repository: createDrizzleGameRunRepository(
        createDatabaseClient(
          createDatabasePool(parseDatabaseEnvironment(environment)),
        ),
        {
          clock: () => new Date(),
          onVerified: (transaction, run, earned, at) =>
            recordVerifiedMilestones(transaction, {
              at,
              earned,
              gameId: run.gameId,
              userId: run.userId,
            }),
        },
      ),
      verify: (_gameId, record) => verifyRun(registry, record, policy),
    });
  });
}
