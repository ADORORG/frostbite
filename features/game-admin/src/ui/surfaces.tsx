import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { gameAdminHref } from "@ador/shared/games";
import { ArcadeEmptyState, ArcadeInfoCard } from "@repo/ui/arcade";

import type { AdminGameInfo } from "../game-info.ts";
import { AdminFrame } from "./admin-frame.tsx";
import { GameAdminPanel } from "./game-admin-panel.tsx";

type Navigation = readonly NavigationItem[];

// The staff page listing the games that declare rewards, and whether each has a contract to administer.
export function GamesSurface({
  games,
  navigation,
}: {
  readonly games: readonly AdminGameInfo[];
  readonly navigation: Navigation;
}) {
  return (
    <AdminFrame
      heading="Game rewards"
      intro="Games whose milestones can be claimed on chain. Defining a milestone and pausing claims are steps you sign yourself."
      navigation={navigation}
    >
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
                <p>
                  {game.contractId === null
                    ? "No rewards contract is deployed for this game, so there is nothing to administer yet."
                    : `Rewards contract ${game.contractId}.`}
                </p>
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
  game,
  navigation,
}: {
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
      intro={
        game.contractId === null
          ? "No rewards contract is deployed for this game, so steps cannot be built yet."
          : `Rewards contract ${game.contractId} on ${game.chain}.`
      }
      navigation={navigation}
    >
      <GameAdminPanel game={game} />
    </AdminFrame>
  );
}
