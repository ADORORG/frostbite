import {
  developmentGamesEnabled,
  testGamesEnabled,
  parseGameLaunchEnvironment,
} from "@repo/config/env";
import {
  applyGameLaunchSettings,
  defineGames,
  type GameManifest,
} from "@ador/shared/games";

import { targetChains } from "./chains.ts";
import { frostbite } from "./games/frostbite.ts";
import { sampleGame } from "./games/sample.ts";
import { sdkExplorerGame } from "./games/sdk-explorer.ts";
import { frostRunnerGame } from "./games/frost-runner.ts";
import { icicleDropGame } from "./games/icicle-drop.ts";
import { towerStackGame } from "./games/tower-stack.ts";
// game:new adds imports above this line.

// Games that exist to check the platform: SDK Explorer is listed where the platform is run for development or tests, and the sample game
// (the template, which the end-to-end tests play) only in the tests.
function developmentGames(): GameManifest[] {
  return [
    ...(developmentGamesEnabled(process.env) ? [sdkExplorerGame] : []),
    ...(testGamesEnabled(process.env) ? [sampleGame] : []),
  ];
}

// The games the platform lists: one line per game. A game is added here and nowhere else; the catalog and the
// detail pages read this list. Where each is played (host, base path, return address, network) comes from the
// deployment's `GAME_LAUNCHES` setting, so the same build serves a subdomain, a path or no play address.
export const games = defineGames([
  ...applyGameLaunchSettings(
    [frostbite],
    parseGameLaunchEnvironment(process.env),
  ),
  ...developmentGames(),
  frostRunnerGame,
  icicleDropGame,
  towerStackGame,
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
