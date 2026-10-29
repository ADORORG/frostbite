import { startState, stepInt } from "@ador/game-sdk/seeded";

import {
  cells,
  lowTileChance,
  spawnRolls,
  startingTiles,
} from "./constants.ts";
import { emptyCells } from "./board.ts";

// A run in progress. Nothing in it is a clock or a random source: new tiles come from `generator`, a seeded generator's state.
export interface DropState {
  readonly board: readonly number[];
  // Whether the board was full and the run still went on.
  readonly closeShave: boolean;
  // Whether the biggest tile (a 256 or more) has sat in a corner.
  readonly cornerKing: boolean;
  readonly ended: boolean;
  readonly generator: number;
  // The most pairs joined in one move.
  readonly mostMerges: number;
  readonly merges: number;
  readonly moves: number;
  // No move is left.
  readonly over: boolean;
  // For each level, the move on which it was first reached (0 for one not reached yet).
  readonly reachedAt: readonly number[];
  readonly score: number;
  // Whether a 128 has been held with half the board empty.
  readonly spacious: boolean;
  // Moves in a row that joined something, now and at the most.
  readonly streak: number;
  readonly bestStreak: number;
}

// Puts one new tile on a random empty cell.
export function spawn(board: readonly number[], generator: number) {
  const free = emptyCells(board);
  const where = stepInt(generator, free.length);
  const which = stepInt(where.state, spawnRolls);
  const next = [...board];
  next[free[where.value] ?? 0] = which.value < lowTileChance ? 1 : 2;
  return { board: next, generator: which.state };
}

export function startDrop(seed: number): DropState {
  let board: readonly number[] = Array.from({ length: cells }, () => 0);
  let generator = startState(seed);
  for (let tile = 0; tile < startingTiles; tile += 1) {
    const placed = spawn(board, generator);
    board = placed.board;
    generator = placed.generator;
  }
  return {
    bestStreak: 0,
    board,
    closeShave: false,
    cornerKing: false,
    ended: false,
    generator,
    merges: 0,
    mostMerges: 0,
    moves: 0,
    over: false,
    reachedAt: Array.from({ length: 16 }, () => 0),
    score: 0,
    spacious: false,
    streak: 0,
  };
}
