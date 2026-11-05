import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import {
  cells,
  fewKinds,
  fewestMoves,
  firstMoves,
  frostBase,
  frostPerLevel,
  goalBase,
  goalPerLevel,
  manyKinds,
  mostFrost,
  movesEvery,
  sixKindsFrom,
} from "./constants.ts";
import { freshBoard } from "./moves.ts";
import type { Board } from "./board.ts";

// A run of SHARD MATCH at one moment. The numbers that decide milestones are running counts, so a milestone is a question about a state and
// nothing else.
export interface MatchState {
  readonly bestChain: number;
  readonly bestLine: number;
  // The most one swap has scored.
  readonly bestSwap: number;
  readonly board: Board;
  readonly bombsFired: number;
  readonly bombsMade: number;
  // Set when the swaps are used up before the goal ("out") or the record is full ("spent").
  readonly cause: "out" | "spent" | null;
  readonly cleared: number;
  readonly ended: boolean;
  // The frost on the board: for each cell whether it is still frosted, and how many frosted cells the run has broken.
  readonly frost: readonly boolean[];
  readonly frostBroken: number;
  // What the last swap did, for the screen and the sounds: the cells cleared, how long the chain ran, what it scored, and whether it cleared
  // the level (the board is then the next level's).
  readonly lastCleared: readonly number[];
  readonly lastDepth: number;
  readonly lastGain: number;
  readonly levelCleared: boolean;
  readonly level: number;
  // The score made on this level, for a score level's goal.
  readonly levelScore: number;
  readonly levelsCleared: number;
  // The swaps still to make on this level.
  readonly moves: number;
  readonly reshuffles: number;
  readonly rng: number;
  readonly score: number;
  readonly starsMade: number;
  readonly swaps: number;
}

export const kindsAt = (level: number): number =>
  level >= sixKindsFrom ? manyKinds : fewKinds;

// A level's goal: odd levels a score, even levels the frost cleared.
export type Goal =
  | { readonly kind: "frost" }
  | { readonly kind: "score"; readonly target: number };

export const goalOf = (level: number): Goal =>
  level % 2 === 0
    ? { kind: "frost" }
    : { kind: "score", target: goalBase + goalPerLevel * level };

export const movesFor = (level: number): number =>
  Math.max(fewestMoves, firstMoves - Math.floor(level / movesEvery));

export const frostFor = (level: number): number =>
  level % 2 === 0 ? Math.min(mostFrost, frostBase + frostPerLevel * level) : 0;

// A new level's board and frost, from the generator state: a board with no line and a swap to make, and the frosted cells (distinct, from the
// generator).
export function newLevel(
  level: number,
  rng: number,
): {
  readonly board: Board;
  readonly frost: readonly boolean[];
  readonly rng: number;
} {
  const fresh = freshBoard(rng, kindsAt(level));
  const frost = new Array<boolean>(cells).fill(false);
  let state = fresh.state;
  for (let placed = 0; placed < frostFor(level);) {
    const stepped = stepInt(state, cells);
    state = stepped.state;
    if (frost[stepped.value] === true) continue;
    frost[stepped.value] = true;
    placed += 1;
  }
  return { board: fresh.board, frost, rng: state };
}

export function startRun(seed: number): MatchState {
  const first = newLevel(1, startState(seed));
  return {
    bestChain: 0,
    bestLine: 0,
    bestSwap: 0,
    board: first.board,
    bombsFired: 0,
    bombsMade: 0,
    cause: null,
    cleared: 0,
    ended: false,
    frost: first.frost,
    frostBroken: 0,
    lastCleared: [],
    lastDepth: 0,
    lastGain: 0,
    level: 1,
    levelCleared: false,
    levelScore: 0,
    levelsCleared: 0,
    moves: movesFor(1),
    reshuffles: 0,
    rng: first.rng,
    score: 0,
    starsMade: 0,
    swaps: 0,
  };
}
