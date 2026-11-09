import type { GameManifest } from "@frostbite/shared/games";

import {
  createGameCatalog,
  type PublicGame,
} from "../../src/domain/catalog.ts";
import { chains, embeddedGame, signet } from "./template-game.ts";

// A small shelf to search: each game differs in the one thing a test looks at. Titles, summaries and tags are the platform's own kind.
const game = (
  id: string,
  title: string,
  summary: string,
  tags: GameManifest["tags"],
  more: Partial<GameManifest> = {},
): GameManifest => ({
  ...embeddedGame,
  description: "",
  id,
  milestones: [],
  network: signet,
  summary,
  tags,
  title,
  ...more,
});

export const shelf: readonly PublicGame[] = createGameCatalog(
  [
    game(
      "frost-runner",
      "Frost Runner",
      "An endless runner: jump spikes, slide under icicles.",
      ["endless", "reflex"],
      { description: "Dash past the spikes, even with friends. Gleaming ice." },
    ),
    game(
      "frost-breaker",
      "FROST·BREAKER",
      "A predictive minefield arcade on Bitcoin.",
      ["strategy"],
    ),
    game(
      "snowball-dash",
      "Snowball Dash",
      "Hop rocks and cut things fine to build a multiplier.",
      ["endless", "arcade"],
    ),
    game(
      "shard-match",
      "Shard Match",
      "Swap neighbouring shards to line up three or more.",
      ["puzzle"],
      {
        description: "Chains pay out. A frozen cell breaks only by a match.",
        milestones: [
          {
            claimPolicy: "once",
            criteria: "Make a chain of two.",
            description: "Two falls in one swap.",
            id: "creme-chain",
            title: "Crème brûlée chain",
          },
        ],
      },
    ),
    game(
      "icicle-drop",
      "Icicle Drop",
      "A sliding ice-tile puzzle: join two of a kind.",
      ["puzzle", "arcade"],
      {
        launch: { basePath: "", mode: "external", returnUrl: null, url: null },
      },
    ),
    // Late on the shelf. Its title holds a word an earlier game is only tagged with (but not at the start, where a bonus would decide it),
    // and its summary a word an earlier game has only in its description: places must decide, not the order.
    game(
      "grand-strategy",
      "Grand Strategy",
      "Plan a round with friends.",
      ["strategy"],
      { description: "Make the ice gleam." },
    ),
    // A title that starts with the query beats one that only holds it, and a title that is the query beats one that only starts with it,
    // each registered after the game it must outrank.
    game("strategy-rush-hour", "Strategy Rush Hour", "Beat the clock.", [
      "action",
    ]),
    // A platformer: no tag of its own says "action", only the kind its tag falls under does.
    game("strategy-rush", "Strategy Rush", "Beat the clock twice.", [
      "platformer",
    ]),
    // One letter from "puzz": a slip in a title must rank below a plain start of a tag word, though it comes after.
    game("pizza-party", "Pizza Party", "Slice and serve.", ["action"]),
  ],
  chains,
).list();

export const idsOf = (games: readonly PublicGame[]): string[] =>
  games.map(({ id }) => id);
