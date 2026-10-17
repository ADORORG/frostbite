import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { gameAdminHref } from "@ador/shared/games";
import { ArcadeEmptyState, ArcadeInfoCard } from "@repo/ui/arcade";

import type { GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { AdminFrame } from "./admin-frame.tsx";
import { GameAdminPanel } from "./game-admin-panel.tsx";
import { TemplatesPanel } from "./templates-panel.tsx";

type Navigation = readonly NavigationItem[];

// The staff page listing the games that declare rewards, and whether each has a contract to administer.
export function GamesSurface({
  api,
  games,
  navigation,
}: {
  readonly api?: GameAdminApi;
  readonly games: readonly AdminGameInfo[];
  readonly navigation: Navigation;
}) {
  return (
    <AdminFrame
      heading="Game rewards"
      intro="Games whose milestones can be claimed on chain. Publishing a template, creating a game's contract, defining a milestone and pausing claims are steps you sign yourself."
      navigation={navigation}
    >
      <TemplatesPanel {...(api === undefined ? {} : { api })} />
      {games.length === 0 ? (
        <ArcadeEmptyState title="Nothing to administer">
          No game declares rewards yet.
        </ArcadeEmptyState>
      ) : (
        <ul aria-label="Games with rewards">
          {games.map((game) => (
            <li key={game.id}>
              <ArcadeInfoCard title={game.title}>
                <p>{`Network ${game.chain}. ${game.milestones.length} milestone${game.milestones.length === 1 ? "" : "s"}.`}</p>
                <a
                  href={gameAdminHref(game.id)}
                >{`Administer ${game.title}`}</a>
              </ArcadeInfoCard>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}

// One game's administration page. A game that is unknown or declares no rewards is "not found", never an empty form.
export function GameSurface({
  api,
  game,
  navigation,
}: {
  readonly api?: GameAdminApi;
  readonly game: AdminGameInfo | undefined;
  readonly navigation: Navigation;
}) {
  if (game === undefined)
    return (
      <AdminFrame
        heading="Game not found"
        intro="No game with that address declares rewards."
        navigation={navigation}
      >
        <a href="/admin/games">Back to game rewards</a>
      </AdminFrame>
    );
  return (
    <AdminFrame
      heading={game.title}
      intro={`Rewards on ${game.chain}.`}
      navigation={navigation}
    >
      <GameAdminPanel {...(api === undefined ? {} : { api })} game={game} />
    </AdminFrame>
  );
}
