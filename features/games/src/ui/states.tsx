import { gamesPath } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { ArcadeButton, ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import { GamesFrame } from "./games-frame.tsx";

// What an empty catalog says, here and on the landing page's rail.
export const noGames = {
  body: "Games will show up here.",
  title: "No games yet",
} as const;

export function NoGames({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation}>
      <ArcadePanel title={noGames.title}>
        <p>{noGames.body}</p>
        <ArcadeButton href="/" tone="cyan">
          Return home
        </ArcadeButton>
      </ArcadePanel>
    </GamesFrame>
  );
}

// A game page that cannot show a game: the address is not a game's identifier, or no such game is
// registered. The message never says more than that.
export function GameNotFound({
  navigation,
  slug,
}: {
  readonly navigation: readonly NavigationItem[];
  // The address that was asked for, when it could be a game's identifier; null when it cannot.
  readonly slug: string | null;
}) {
  return (
    <GamesFrame navigation={navigation}>
      <StatusLamp
        label={slug === null ? "Invalid identifier" : "Record not published"}
        tone="unavailable"
      />
      <ArcadePanel
        eyebrow="Game detail"
        title={slug === null ? "Invalid route" : "game unavailable"}
      >
        <p>
          {slug === null
            ? "This game identifier is not valid."
            : `No published game matches “${slug}”.`}
        </p>
        <ArcadeButton href={gamesPath} tone="cyan">
          Browse games
        </ArcadeButton>
      </ArcadePanel>
    </GamesFrame>
  );
}
