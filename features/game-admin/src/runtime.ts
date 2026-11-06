import { randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import {
  createDrizzleContractStore,
  type ContractStore,
} from "@frostbite/database/game-contracts";
import { authUsers } from "@frostbite/database/schema/auth";
import {
  createDrizzleGameAdminRepository,
  createGameAdminService,
  type AdministeredGame,
} from "@frostbite/game-admin";
import { sanitizeDrawing } from "@frostbite/milestone-art";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import {
  chainFamilyIdSchema,
  contractRefSchema,
} from "@frostbite/shared/chain";
import { inArray } from "drizzle-orm";

import type { GameAdminConfig } from "./config.ts";
import type { AdminGameInfo } from "./game-info.ts";

// What the service may know of a game, from its manifest and the record of its contract: the chain, the contract once the step that
// created it completed, the drawing size it accepts, and the claim limits.
export function administeredGameLookup(
  games: readonly AdminGameInfo[],
  contracts: Pick<ContractStore, "gameContract">,
): (gameId: string) => Promise<AdministeredGame | null> {
  const byId = new Map(games.map((game) => [game.id, game]));
  return async (gameId) => {
    const game = byId.get(gameId);
    if (game === undefined) return null;
    const recorded = await contracts.gameContract(gameId, game.chain);
    return {
      chain: game.chain,
      contract:
        recorded === null
          ? null
          : contractRefSchema.parse({
              chain: game.chain,
              family: chainFamilyIdSchema.parse(recorded.family),
              id: recorded.address,
            }),
      // A game without a contract has no use for it: nothing can be built for it.
      maxDrawingBytes: BigInt(recorded?.maxDrawingBytes ?? 0),
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
    const contracts = createDrizzleContractStore(database);
    const service = createGameAdminService({
      clock,
      contracts,
      delay: config.delay,
      funding: (chain) => {
        const offered = config.chain(chain);
        if (offered === null)
          throw new Error(`No chain is configured for steps on ${chain}.`);
        return offered.funding;
      },
      game: administeredGameLookup(games, contracts),
      newId: randomUUID,
      ports: (chain) => config.chain(chain)?.ports ?? null,
      repository: createDrizzleGameAdminRepository(database, { clock }),
      rewards: config.rewards,
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
    return { names, rewards: config.rewards, service };
  });
}

export type GameAdminRuntime = Awaited<
  ReturnType<ReturnType<typeof createGameAdminResolver>>
>;
