import { randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import { authUsers } from "@ador/database/schema/auth";
import {
  createDrizzleGameAdminRepository,
  createGameAdminService,
  type AdministeredGame,
} from "@ador/game-admin";
import { sanitizeDrawing } from "@ador/milestone-art";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import { inArray } from "drizzle-orm";

import type { GameAdminConfig } from "./config.ts";
import type { AdminGameInfo } from "./game-info.ts";

// What the service may know of a game, from its manifest and the platform's configuration.
export function administeredGameLookup(
  games: readonly AdminGameInfo[],
  config: Pick<GameAdminConfig, "contracts">,
): (gameId: string) => AdministeredGame | null {
  const byId = new Map(games.map((game) => [game.id, game]));
  return (gameId) => {
    const game = byId.get(gameId);
    if (game === undefined) return null;
    return {
      chain: game.chain,
      contract: config.contracts.get(gameId) ?? null,
      // A game with a contract always has its limit (`adminGames` refuses otherwise); one without has no use for it, since
      // nothing can be built for it.
      maxDrawingBytes: game.maxDrawingBytes ?? 0n,
      milestones: new Map(
        game.milestones.map(({ claimLimit, id }) => [id, { claimLimit }]),
      ),
    };
  };
}

// The staff side of game administration: one connection pool made on first use, the service over the log of steps and the chain the
// configuration offers, and a way to put names to the people in the log.
export function createGameAdminResolver(
  games: readonly AdminGameInfo[],
  config: GameAdminConfig,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const clock = config.clock ?? (() => new Date());
  return memoizeUntilFailure(async () => {
    const database = createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(environment)),
    );
    const service = createGameAdminService({
      clock,
      funding: (chain) => {
        const offered = config.chain(chain);
        if (offered === null)
          throw new Error(`No chain is configured for steps on ${chain}.`);
        return offered.funding;
      },
      game: administeredGameLookup(games, config),
      newId: randomUUID,
      ports: (chain) => config.chain(chain)?.ports ?? null,
      repository: createDrizzleGameAdminRepository(database, { clock }),
      sanitise: (drawing, maxBytes) => {
        const result = sanitizeDrawing(drawing, {
          ...config.drawingLimits,
          maxBytes: Number(maxBytes),
        });
        return result.ok
          ? { ok: true, svg: result.svg }
          : { detail: result.detail, ok: false };
      },
    });
    const names = async (ids: readonly string[]) => {
      if (ids.length === 0) return new Map<string, string>();
      const rows = await database
        .select({ id: authUsers.id, name: authUsers.name })
        .from(authUsers)
        .where(inArray(authUsers.id, [...ids]));
      return new Map(rows.map(({ id, name }) => [id, name]));
    };
    return { names, service };
  });
}

export type GameAdminRuntime = Awaited<
  ReturnType<ReturnType<typeof createGameAdminResolver>>
>;
