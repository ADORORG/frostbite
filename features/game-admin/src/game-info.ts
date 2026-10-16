import { chainRefSchema } from "@ador/shared/chain";
import { rewardsInitialisation, type GameManifest } from "@ador/shared/games";

import type { GameAdminConfig } from "./config.ts";

// What the pages and the service know of a game that declares rewards: where it is, whether it has a contract, and its
// milestones with their claim limits (from the manifest alone). A game that declares none is unknown here.
export interface AdminGameInfo {
  readonly chain: ReturnType<typeof chainRefSchema.parse>;
  readonly contractId: string | null;
  readonly id: string;
  readonly maxDrawingBytes: bigint | null;
  readonly milestones: readonly {
    readonly claimLimit: number;
    readonly id: string;
    readonly title: string;
  }[];
  readonly title: string;
}

export function adminGames(
  games: readonly GameManifest[],
  config: GameAdminConfig,
): readonly AdminGameInfo[] {
  return games.flatMap((game) => {
    const initialisation = rewardsInitialisation(game);
    if (initialisation === null) return [];
    // A contract is initialised with the largest drawing it will keep, so one deployed without that limit configured cannot be
    // administered correctly: refuse to start rather than guess.
    if (config.contracts.has(game.id) && !config.maxDrawingBytes.has(game.id))
      throw new Error(
        `Game ${game.id} has a rewards contract but no configured drawing limit.`,
      );
    const titles = new Map(game.milestones.map(({ id, title }) => [id, title]));
    return [
      {
        chain: chainRefSchema.parse(game.network),
        contractId: config.contracts.get(game.id)?.id ?? null,
        id: game.id,
        maxDrawingBytes: config.maxDrawingBytes.get(game.id) ?? null,
        milestones: initialisation.milestones.map(({ claimLimit, id }) => ({
          claimLimit,
          id,
          title: titles.get(id) ?? id,
        })),
        title: game.title,
      },
    ];
  });
}
