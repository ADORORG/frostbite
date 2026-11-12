// The piece being moved: which of the seven, which way round, where its box's top left is, and how it is resting.
export interface ActivePiece {
  // Ticks it has fallen towards the next row.
  readonly fall: number;
  // Ticks it has rested on the stack.
  readonly grounded: number;
  readonly kind: number;
  // How many times a move or turn has put off its setting since it last came to rest on a new row.
  readonly resets: number;
  readonly rotation: number;
  readonly x: number;
  readonly y: number;
}

export type Cause = "blocked" | "ended" | null;

// A run, as the rules hold it. `board` is columns by rows, row by row from the top; `tick` is the tick the state is as of.
export interface PermafrostState {
  readonly backToBack: boolean;
  readonly backToBackFours: number;
  readonly board: readonly number[];
  // Set when the stack reached the top: the run stops moving, and waits to be closed.
  readonly blocked: boolean;
  readonly cause: Cause;
  readonly combo: number;
  readonly ended: boolean;
  readonly fours: number;
  readonly garbageRows: number;
  // The column of the last grey row's gap, or -1.
  readonly gap: number;
  readonly hold: number;
  readonly holdUsed: boolean;
  readonly holds: number;
  readonly lines: number;
  readonly maxCombo: number;
  readonly perfectClears: number;
  readonly piece: ActivePiece;
  readonly piecesSinceGarbage: number;
  readonly queue: readonly number[];
  readonly rng: number;
  readonly score: number;
  readonly seed: number;
  readonly softDrop: boolean;
  // The tick the fortieth line was cleared on, or null.
  readonly sprintTick: number | null;
  readonly tick: number;
}

export type Action =
  | "hard"
  | "hold"
  | "left"
  | "right"
  | "softOff"
  | "softOn"
  | "turnLeft"
  | "turnRight";
