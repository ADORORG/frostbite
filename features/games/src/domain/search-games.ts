import { gameKindsOf, gameTagLabels } from "@frostbite/shared/games";

import type { PublicGame } from "./catalog.ts";
import { isEmptyQuery, type GameQuery } from "./game-query.ts";
import { withinTypo } from "./typo.ts";

// Finds games for a query. Pure and synchronous: the catalog is a short list the page already holds, so this runs on every keystroke
// with nothing to wait for.
//
// A game matches when every word asked for is found, as the start of a word in the game's title, tags, summary, description or
// milestone titles (so "frost run" finds Frost Runner, and "run" does not find "brunch"). The title and the tags also forgive one or
// two slipped letters in a longer word. Better places rank first: a title hit above a tag hit above a summary hit; equal scores keep the
// order the games were registered in, so the list never shuffles for no reason.

const maxWords = 6;
// How much a word found in each place is worth.
const worth = {
  description: 2,
  milestones: 1,
  summary: 4,
  tags: 6,
  title: 10,
} as const;
// A word found whole counts for more than one found at the start of a longer word; a word found only through a forgiven slip, less.
const wholeWordBonus = 1.5;
const slipFactor = 0.5;
// A title that is the whole query, or starts with it, beats any spread of smaller hits.
const titleIsQueryBonus = 50;
const titleStartsWithQueryBonus = 20;

// Letters without accents or case, so "Café" is found by "cafe" and by "CAFÉ".
const fold = (text: string): string =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

const wordsOf = (text: string): string[] =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");

// A title such as "FROST·BREAKER" is two words to read and one to type: both are found.
const wordsAndWhole = (text: string): string[] => [
  ...wordsOf(text),
  wordsOf(text).join(""),
];

interface Place {
  readonly forgiving: boolean;
  readonly weight: number;
  readonly words: readonly string[];
}

function placesOf(game: PublicGame): readonly Place[] {
  return [
    { forgiving: true, weight: worth.title, words: wordsAndWhole(game.title) },
    {
      forgiving: true,
      weight: worth.tags,
      // The game's own tags and the kinds they fall under, so "action" finds a platformer.
      words: [...game.tags, ...gameKindsOf(game.tags)].flatMap((tag) =>
        wordsOf(gameTagLabels[tag]),
      ),
    },
    { forgiving: false, weight: worth.summary, words: wordsOf(game.summary) },
    {
      forgiving: false,
      weight: worth.description,
      words: wordsOf(game.description),
    },
    {
      forgiving: false,
      weight: worth.milestones,
      words: game.milestones.flatMap(({ title }) => wordsOf(title)),
    },
  ];
}

// What one word asked for is worth in one place; 0 when it is not there.
function scoreWord(word: string, place: Place): number {
  let best = 0;
  for (const found of place.words) {
    if (found === word) return place.weight * wholeWordBonus;
    if (found.startsWith(word)) best = Math.max(best, place.weight);
    else if (place.forgiving && best === 0 && withinTypo(word, found))
      best = place.weight * slipFactor;
  }
  return best;
}

// The game's score for the words, or 0 when any one of them is nowhere in it.
function scoreGame(game: PublicGame, words: readonly string[]): number {
  const places = placesOf(game);
  let total = 0;
  for (const word of words) {
    const score = Math.max(...places.map((place) => scoreWord(word, place)));
    if (score === 0) return 0;
    total += score;
  }
  const title = wordsOf(game.title).join(" ");
  const asked = words.join(" ");
  if (title === asked) return total + titleIsQueryBonus;
  return title.startsWith(asked) ? total + titleStartsWithQueryBonus : total;
}

const keeps = (game: PublicGame, query: GameQuery): boolean =>
  (!query.playable || game.playable) &&
  (query.kinds.length === 0 ||
    gameKindsOf(game.tags).some((kind) => query.kinds.includes(kind)));

// The games for a query, best first. The empty query is every game in the order given.
export function searchGames(
  games: readonly PublicGame[],
  query: GameQuery,
): readonly PublicGame[] {
  // Spaces alone are no text: a caller that did not trim gets the same answer as one that did.
  const text = query.text.trim();
  if (isEmptyQuery({ ...query, text })) return games;
  const words = wordsOf(text).slice(0, maxWords);
  // Text with nothing to look for in it (".*", "!!") is a search for something that cannot be there, not for everything.
  if (text !== "" && words.length === 0) return [];
  const scored: { game: PublicGame; score: number }[] = [];
  for (const game of games.filter((each) => keeps(each, query))) {
    const score = words.length === 0 ? 1 : scoreGame(game, words);
    if (score > 0) scored.push({ game, score });
  }
  // Array#sort is stable, so equal scores stay in the order the games were registered in.
  return scored.sort((a, b) => b.score - a.score).map(({ game }) => game);
}
