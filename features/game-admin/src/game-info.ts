import { chainRefSchema } from "@ador/shared/chain";
import { rewardsInitialisation, type GameManifest } from "@ador/shared/games";

// What the pages and the service know of a game that declares rewards: where it is, and its milestones with their claim limits
// (from the manifest alone). Whether it has a contract is on record, not here. A game that declares none is unknown here.
export interface AdminGameInfo {
  readonly chain: ReturnType<typeof chainRefSchema.parse>;
  readonly id: string;
  readonly milestones: readonly {
    readonly claimLimit: number;
    readonly id: string;
    readonly title: string;
  }[];
  readonly title: string;
}

export function adminGames(
  games: readonly GameManifest[],
): readonly AdminGameInfo[] {
  return games.flatMap((game) => {
    const initialisation = rewardsInitialisation(game);
    if (initialisation === null) return [];
    const titles = new Map(game.milestones.map(({ id, title }) => [id, title]));
    return [
      {
        chain: chainRefSchema.parse(game.network),
        id: game.id,
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
