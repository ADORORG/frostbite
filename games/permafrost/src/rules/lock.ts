import { stepInt } from "@frostbite/game-sdk/seeded";

import { filled } from "./bag.ts";
import {
  aboveScreen,
  clearFull,
  fits,
  isEmpty,
  rise,
  setDown,
} from "./board.ts";
import {
  columns,
  fourLines,
  hardDropPoints,
  spawnColumn,
  spawnRow,
} from "./constants.ts";
import { garbageEvery, levelOf, sameGapPercent } from "./difficulty.ts";
import { clearPoints } from "./scoring.ts";
import type { ActivePiece, PermafrostState } from "./types.ts";

export const newPiece = (kind: number): ActivePiece => ({
  fall: 0,
  grounded: 0,
  kind,
  resets: 0,
  rotation: 0,
  x: spawnColumn,
  y: spawnRow,
});

// The run, stopped because the stack reached the top.
const blockedOut = (state: PermafrostState): PermafrostState => ({
  ...state,
  blocked: true,
  cause: "blocked",
  softDrop: false,
});

// A grey row rises when enough pieces have been set; the gap is where the last was, or somewhere new.
function maybeRise(state: PermafrostState): PermafrostState {
  const every = garbageEvery(levelOf(state.lines));
  if (every === null || state.piecesSinceGarbage < every) return state;
  const roll = stepInt(state.rng, 100);
  const pick = stepInt(roll.state, columns);
  const gap =
    state.gap >= 0 && roll.value < sameGapPercent ? state.gap : pick.value;
  const board = rise(state.board, gap);
  if (board === null) return blockedOut({ ...state, rng: pick.state });
  return {
    ...state,
    board,
    gap,
    garbageRows: state.garbageRows + 1,
    piecesSinceGarbage: 0,
    rng: pick.state,
  };
}

// The next piece from the queue (or `kind`, when one is taken out of hold), put at the top; the run is blocked if it does not fit.
export function bringIn(
  state: PermafrostState,
  kind: number | null,
): PermafrostState {
  const refilled = filled(state.queue, state.rng);
  const [first = 1, ...rest] = refilled.queue;
  const piece = newPiece(kind ?? first);
  const next = {
    ...state,
    piece,
    queue: kind === null ? rest : refilled.queue,
    rng: refilled.rng,
  };
  return fits(next.board, piece) ? next : blockedOut(next);
}

// Sets the piece down for good: scores the rows it completes, raises a grey row if one is due, and brings in the next piece.
export function lock(state: PermafrostState): PermafrostState {
  if (aboveScreen(state.piece)) return blockedOut(state);
  const level = levelOf(state.lines);
  const cleared = clearFull(setDown(state.board, state.piece));
  const lines = state.lines + cleared.cleared;
  const emptied = cleared.cleared > 0 && isEmpty(cleared.board);
  const combo = cleared.cleared > 0 ? state.combo + 1 : -1;
  const again = cleared.cleared === fourLines && state.backToBack;
  const points = clearPoints({
    backToBack: state.backToBack,
    cleared: cleared.cleared,
    combo,
    emptied,
    level,
  });
  const done: PermafrostState = {
    ...state,
    backToBack:
      cleared.cleared === fourLines
        ? true
        : cleared.cleared > 0
          ? false
          : state.backToBack,
    backToBackFours: state.backToBackFours + (again ? 1 : 0),
    board: cleared.board,
    combo,
    fours: state.fours + (cleared.cleared === fourLines ? 1 : 0),
    holdUsed: false,
    lines,
    maxCombo: Math.max(state.maxCombo, combo),
    perfectClears: state.perfectClears + (emptied ? 1 : 0),
    piecesSinceGarbage: state.piecesSinceGarbage + 1,
    score: state.score + points,
    sprintTick:
      state.sprintTick === null && lines >= 40 ? state.tick : state.sprintTick,
  };
  const risen = maybeRise(done);
  return risen.blocked ? risen : bringIn(risen, null);
}

// A hard drop: the piece falls as far as it can, scores two a row, and is set at once.
export function hardDrop(
  state: PermafrostState,
  piece: ActivePiece,
  rows: number,
): PermafrostState {
  return lock({
    ...state,
    piece,
    score: state.score + rows * hardDropPoints,
  });
}
