import { randomUUID } from "node:crypto";

import {
  createDrizzleContractStore,
  type ContractStore,
} from "@ador/database/game-contracts";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import {
  createDrizzleGameClaimRepository,
  createGameClaimsService,
  type ClaimableGame,
} from "@ador/game-claims";
import { hasEarnedMilestone } from "@ador/game-saves";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import { chainRefSchema, contractRefSchema } from "@ador/shared/chain";
import { rewardsInitialisation, type GameManifest } from "@ador/shared/games";

import type { GameClaimsConfig } from "./claims-config.ts";

// What the claims service may know of a game, read from its manifest and the record of its contract: the chain it is on, the
// contract made for it (none until the step that makes it completes), and each milestone's claim limit. A game that declares no
// rewards is unknown to it, so it can neither start a claim nor be asked about one.
export function claimableGameLookup(
  games: readonly GameManifest[],
  contracts: Pick<ContractStore, "gameContract">,
): (gameId: string) => Promise<ClaimableGame | null> {
  const byId = new Map(games.map((game) => [game.id, game]));
  return async (gameId) => {
    const game = byId.get(gameId);
    const initialisation =
      game === undefined ? null : rewardsInitialisation(game);
    if (game === undefined || initialisation === null) return null;
    const chain = chainRefSchema.parse(game.network);
    const recorded = await contracts.gameContract(gameId, chain);
    return {
      chain,
      contract:
        recorded === null
          ? null
          : contractRefSchema.parse({
              chain,
              family: recorded.family,
              id: recorded.address,
            }),
      limits: new Map(
        initialisation.milestones.map(({ claimLimit, id }) => [id, claimLimit]),
      ),
    };
  };
}

// The account side of claims: one connection pool made on first use, and the service over the claims table, the account's
// milestones, and the chain the configuration offers.
export function createGameClaimsResolver(
  games: readonly GameManifest[],
  config: GameClaimsConfig,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const clock = config.clock ?? (() => new Date());
  return memoizeUntilFailure(async () => {
    const database = createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(environment)),
    );
    return createGameClaimsService({
      clock,
      delay: config.delay,
      earned: (userId, gameId, milestoneId) =>
        hasEarnedMilestone(database, { gameId, milestoneId, userId }),
      funding: (chain) => {
        const offered = config.chain(chain);
        if (offered === null)
          throw new Error(`No chain is configured for claims on ${chain}.`);
        return offered.funding;
      },
      game: claimableGameLookup(games, createDrizzleContractStore(database)),
      newId: randomUUID,
      ports: (chain) => config.chain(chain)?.ports ?? null,
      repository: createDrizzleGameClaimRepository(database, { clock }),
    });
  });
}
