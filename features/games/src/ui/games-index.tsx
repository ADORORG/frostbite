import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { ArcadeTicker } from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import type { GameQuery } from "../domain/game-query.ts";
import { GamesBrowser } from "./games-browser.tsx";
import { GamesFrame } from "./games-frame.tsx";

// The registered games as a wall of covers, each picture alive (a clip plays while it is on screen), with a search and filters over
// it. A game with no play address says it cannot be played yet, and one with no picture gets a stand-in drawn from its name.
export function GamesIndex({
  games,
  initial,
  navigation,
}: {
  readonly games: readonly PublicGame[];
  // What the address asked for, so a shared link opens already narrowed.
  readonly initial: GameQuery;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation} variant="wall">
      <ArcadeTicker
        items={["Insert coin", ...games.map(({ title }) => title)]}
      />
      <GamesBrowser games={games} initial={initial} />
    </GamesFrame>
  );
}
