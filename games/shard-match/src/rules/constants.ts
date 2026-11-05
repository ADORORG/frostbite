// Everything the rules measure, in whole numbers. A run is a list of swaps of two neighbouring shards; there is no clock. Nothing here is a
// float, so every engine plays a run out the same way.
export const gameId = "shard-match";
export const verifierId = "shard-match";
export const verifierVersion = 2;

// The board is `columns` by `rows`, held row by row. A cell holds a number: the kind of shard (0 to `kinds` - 1) plus `kindSlots` times
// its special: 0 none, 1 a bomb (clears the 3 by 3 around it), 2 a star (clears its row and its column).
export const columns = 8;
export const rows = 8;
export const cells = columns * rows;
export const kindSlots = 8;
export const bomb = 1;
export const star = 2;

// The four ways to swap a shard, in the order the inputs name them.
export const directions = ["up", "right", "down", "left"] as const;
export type Direction = (typeof directions)[number];
export const deltas = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

// A run record holds at most 5,000 inputs, and the last closes the run.
export const maxSwaps = 4_900;

// Shards come in five kinds on the first levels and six from `sixKindsFrom`.
export const fewKinds = 5;
export const manyKinds = 6;
export const sixKindsFrom = 4;

// A run is a series of levels, each on a fresh board, with a number of swaps to make its goal in. Odd levels ask for a score; even levels
// put frost on some cells, and the goal is to clear it all (a match that clears a frosted cell breaks its frost). Each swap uses one swap; a
// star gives `starMoves` more, each step of a chain past the second gives `chainMoves`; and what is left over when a level is cleared is paid
// in points (`leftoverPoints` a swap times the level) and up to `carryMoves` of it goes on into the next level.
export const starMoves = 1;
export const chainMoves = 1;
export const leftoverPoints = 50;
export const carryMoves = 3;

// The swaps a level gives (fewer as the levels go, to at least `fewestMoves`), the score a score level asks for, and the frost an even level
// lays (cells, to at most `mostFrost`).
export const firstMoves = 22;
export const fewestMoves = 13;
export const movesEvery = 3;
export const goalBase = 500;
export const goalPerLevel = 450;
export const frostBase = 8;
export const frostPerLevel = 3;
export const mostFrost = 36;

// Scoring: each shard cleared in a step of a chain is worth `shardPoints` times the step's number; each shard in a line past the third adds
// `linePoints` times the step's number.
export const shardPoints = 10;
export const linePoints = 50;
