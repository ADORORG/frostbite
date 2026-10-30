// Everything the rules measure, in whole numbers. A run is a list of swaps of two neighbouring shards; there is no clock. Nothing here is a
// float, so every engine plays a run out the same way.
export const gameId = "shard-match";
export const verifierId = "shard-match";
export const verifierVersion = 1;

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

// The run starts with `startMoves` swaps to make. Each swap uses one. A line of four or more makes a bomb (four) or a star (five or more);
// a star gives `starMoves` more swaps, and each step of a chain past the second gives `chainMoves`; going up a level gives `levelMoves`.
export const startMoves = 16;
export const starMoves = 1;
export const chainMoves = 1;
export const levelMoves = 3;

// Scoring: each shard cleared in a step of a chain is worth `shardPoints` times the step's number; each shard in a line past the third adds
// `linePoints` times the step's number.
export const shardPoints = 10;
export const linePoints = 50;

// The score that takes the player from level L to L + 1 is `levelBase` times L plus `levelCurve` times L squared.
export const levelBase = 600;
export const levelCurve = 400;
