import { startState } from "@frostbite/game-sdk/seeded";

import { filled } from "./bag.ts";
import { emptyBoard } from "./board.ts";
import { newPiece } from "./lock.ts";
import type { PermafrostState } from "./types.ts";

// A run at its first tick: an empty board, the first piece in hand, and the seed's pieces to come.
export function startRun(seed: number): PermafrostState {
  const bag = filled([], startState(seed));
  const [first = 1, ...queue] = bag.queue;
  return {
    backToBack: false,
    backToBackFours: 0,
    blocked: false,
    board: emptyBoard,
    cause: null,
    combo: -1,
    ended: false,
    fours: 0,
    garbageRows: 0,
    gap: -1,
    hold: 0,
    holdUsed: false,
    holds: 0,
    lines: 0,
    maxCombo: 0,
    perfectClears: 0,
    piece: newPiece(first),
    piecesSinceGarbage: 0,
    queue,
    rng: bag.rng,
    score: 0,
    seed,
    softDrop: false,
    sprintTick: null,
    tick: 0,
  };
}
