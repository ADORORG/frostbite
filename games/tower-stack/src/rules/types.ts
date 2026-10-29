// A run in progress. Nothing in it is a clock or a random source: where each block begins comes from `generator`, a seeded generator's
// state, and where it is at any tick follows from the tick it began on (`startTick`) and its `phase`.
export interface TowerState {
  // The most perfect drops in a row, and how many separate runs of five there have been.
  readonly bestStreak: number;
  readonly fives: number;
  readonly byHair: boolean;
  readonly ended: boolean;
  readonly generator: number;
  // Blocks stacked on the first one.
  readonly height: number;
  readonly marathon: boolean;
  readonly needle: boolean;
  // A drop missed the tower: the run is over.
  readonly over: boolean;
  readonly perfects: number;
  // Where on its sweep the block that is moving began.
  readonly phase: number;
  readonly regrown: boolean;
  // The tick on which the block that is moving appeared, and the tick of the last choice (the same, until the run ends).
  readonly startTick: number;
  readonly streak: number;
  readonly tick: number;
  readonly tidy: boolean;
  // The left edge and the width of the top of the tower, which is also the width of the block that is moving.
  readonly topX: number;
  readonly wideLoad: boolean;
  readonly width: number;
}
