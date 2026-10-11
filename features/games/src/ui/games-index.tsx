import { gameHref } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { GamesFrame } from "./games-frame.tsx";

// The registered games. A game with no play address says it cannot be played yet.
export function GamesIndex({
  games,
  navigation,
}: {
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation}>
      <StatusLamp label="Registered games" tone="ready" />
      <ArcadePanel eyebrow="Public catalog" title="Games">
        <p>
          Games that are registered with the platform. A game is playable only
          when it has a play address.
        </p>
        <ul aria-label="Registered games" className="arcade-grid">
          {games.map((game) => (
            <li key={game.id}>
              <article aria-label={game.title}>
                <h3>{game.title}</h3>
                <p>{game.summary}</p>
                <p>
                  <ArcadeBadge tone={game.playable ? "mint" : "pink"}>
                    {game.playable ? "Playable" : "Not playable yet"}
                  </ArcadeBadge>{" "}
                  <ArcadeBadge tone="cyan">{game.networkLabel}</ArcadeBadge>
                </p>
                <ArcadeButton
                  ariaLabel={`View ${game.title}`}
                  href={gameHref(game.id)}
                  tone="cyan"
                >
                  View game
                </ArcadeButton>
              </article>
            </li>
          ))}
        </ul>
      </ArcadePanel>
    </GamesFrame>
  );
}
