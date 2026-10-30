import { startState } from "@ador/game-sdk/seeded";

import {
  fewKinds,
  levelBase,
  levelCurve,
  manyKinds,
  sixKindsFrom,
  startMoves,
} from "./constants.ts";
import { freshBoard } from "./moves.ts";
import type { Board } from "./board.ts";

// A run of SHARD MATCH at one moment. The numbers that decide milestones are running counts, so a milestone is a question about a state and
// nothing else.
export interface MatchState {
  readonly board: Board;
  readonly bestChain: number;
  readonly bestLine: number;
  // The most one swap has scored.
  readonly bestSwap: number;
  readonly bombsFired: number;
  readonly bombsMade: number;
  // Set when the swaps are used up ("out") or the record is full ("spent").
  readonly cause: "out" | "spent" | null;
  readonly cleared: number;
  readonly ended: boolean;
  // The cells the last swap cleared, how long its chain ran, and what it scored, for the screen and the sounds.
  readonly lastCleared: readonly number[];
  readonly lastDepth: number;
  readonly lastGain: number;
  readonly level: number;
  // The swaps still to make.
  readonly moves: number;
  readonly reshuffles: number;
  readonly rng: number;
  readonly score: number;
  readonly starsMade: number;
  readonly swaps: number;
}

export const kindsAt = (level: number): number =>
  level >= sixKindsFrom ? manyKinds : fewKinds;

// The score at which the player goes up from `level`.
export const targetOf = (level: number): number =>
  levelBase * level + levelCurve * level * level;

export function startRun(seed: number): MatchState {
  const first = freshBoard(startState(seed), kindsAt(1));
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
    lastCleared: [],
    lastDepth: 0,
    lastGain: 0,
    level: 1,
    moves: startMoves,
    reshuffles: 0,
    rng: first.state,
    score: 0,
    starsMade: 0,
    swaps: 0,
  };
}
