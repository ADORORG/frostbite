import {
  developmentGamesEnabled,
  parseGameLaunchEnvironment,
} from "@repo/config/env";
import {
  applyGameLaunchSettings,
  defineGames,
  type GameManifest,
} from "@frostbite/shared/games";

import { targetChains } from "./chains.ts";
import { broMariaGame } from "./games/bro-maria.ts";
import { fixtureTapsGame } from "./games/fixture-taps.ts";
import { sdkExplorerGame } from "./games/sdk-explorer.ts";
import { frostRunnerGame } from "./games/frost-runner.ts";
import { icicleDropGame } from "./games/icicle-drop.ts";
import { towerStackGame } from "./games/tower-stack.ts";
import { snowballDashGame } from "./games/snowball-dash.ts";
import { lanternMazeGame } from "./games/lantern-maze.ts";
import { shardMatchGame } from "./games/shard-match.ts";
import { auroraPulseGame } from "./games/aurora-pulse.ts";
import { pocketDragonGame } from "./games/pocket-dragon.ts";
// game:new adds imports above this line.

// Games that exist to check the platform, listed only where it is run for development or tests.
function developmentGames(): GameManifest[] {
  return developmentGamesEnabled(process.env)
    ? [sdkExplorerGame, fixtureTapsGame]
    : [];
}

// The games the platform lists: one line per game. A game is added here and nowhere else; the catalog and the
// detail pages read this list. Where a game that is played at an address of its own is played (host, base path, return
// address) comes from the deployment's `GAME_LAUNCHES` setting. No game is played that way today: every game below is played
// by the platform itself, so the setting is applied to none and a setting that names any game stops the platform from starting.
// A game played at its own address goes in the list given to `applyGameLaunchSettings`.
export const games = defineGames([
  ...applyGameLaunchSettings([], parseGameLaunchEnvironment(process.env)),
  // The first game is shown larger than the rest on the games page and the landing page.
  pocketDragonGame,
  ...developmentGames(),
  frostRunnerGame,
  icicleDropGame,
  towerStackGame,
  broMariaGame,
  snowballDashGame,
  lanternMazeGame,
  shardMatchGame,
  auroraPulseGame,
  // game:new adds games above this line.
]);

// A game on a chain the platform is not configured for would be listed with nowhere to act, so the platform
// refuses to start rather than show it.
const configured = new Set<string>(targetChains.map(({ chainId }) => chainId));
for (const game of games)
  if (!configured.has(game.network))
    throw new Error(
      `Game "${game.id}" is on ${game.network}, which is not a configured chain.`,
    );
