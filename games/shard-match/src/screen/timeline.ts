import type { EffectName } from "../audio.ts";
import { bomb, star } from "../rules/constants.ts";
import { neighbour, specialOf } from "../rules/board.ts";
import type { Resolved, Step } from "../rules/resolve.ts";
import type { MatchState } from "../rules/state.ts";

// How long each part of a swap's playback is, in frames of the screen (sixty a second): the two shards trading places, a step's cleared shards
// popping, what is left falling in, the level's clear banner, and a new board coming in or a shuffle.
export const frames = {
  banner: 54,
  drop: 16,
  fall: 10,
  pop: 9,
  shuffle: 18,
  swap: 6,
} as const;

// A cue: something to be heard or said at a frame of the playback.
export interface Cue {
  readonly frame: number;
  readonly praise?: string;
  readonly sound?: EffectName;
}

// A playback: the state before and after the swap, the swap, the steps, and where each part begins. The screen plays it by frame; nothing in it
// is read by the rules.
export interface Timeline {
  readonly after: MatchState;
  readonly before: MatchState;
  readonly cues: readonly Cue[];
  readonly length: number;
  // The frame each step's pop begins on (a step's fall follows it).
  readonly pops: readonly number[];
  readonly shuffled: boolean;
  readonly steps: readonly Step[];
  readonly swap: readonly [number, number];
  // Where the banner (the level cleared) and the new board's coming in begin, or -1.
  readonly bannerAt: number;
  readonly shuffleAt: number;
}

// The words for a chain of this many steps, or for what a swap made: the praise grows with the play.
export function praiseFor(
  depth: number,
  steps: readonly Step[],
): string | null {
  if (depth >= 5) return "DIVINE!";
  if (depth === 4) return "DELICIOUS!";
  if (depth === 3) return "TASTY!";
  if (
    steps.some((step) =>
      step.made.some(([, value]) => specialOf(value) === star),
    )
  )
    return "STAR!";
  if (
    steps.some((step) =>
      step.made.some(([, value]) => specialOf(value) === bomb),
    )
  )
    return "BOMB!";
  if (depth === 2) return "SWEET!";
  return null;
}

const matchSound = (depth: number): EffectName =>
  `match${String(Math.min(4, Math.max(0, depth - 1)))}` as EffectName;

export function buildTimeline(
  before: MatchState,
  after: MatchState,
  cell: number,
  direction: number,
  done: Resolved,
): Timeline {
  const cues: Cue[] = [{ frame: 0, sound: "swap" }];
  const pops: number[] = [];
  let at: number = frames.swap;
  done.steps.forEach((step, index) => {
    pops.push(at);
    cues.push({ frame: at, sound: matchSound(index + 1) });
    if (step.fired.length > 0) cues.push({ frame: at + 2, sound: "blast" });
    if (step.made.length > 0)
      cues.push({ frame: at + frames.pop, sound: "special" });
    at += frames.pop + frames.fall;
  });
  const praise = praiseFor(done.depth, done.steps);
  if (praise !== null) cues.push({ frame: at - frames.fall, praise });
  const shuffled = !after.levelCleared && after.reshuffles > before.reshuffles;
  let bannerAt = -1;
  let shuffleAt = -1;
  if (after.levelCleared) {
    bannerAt = at;
    cues.push({ frame: at, praise: "LEVEL CLEAR!", sound: "level" });
    at += frames.banner;
    cues.push({ frame: at, sound: "start" });
    at += frames.drop;
  } else if (shuffled) {
    shuffleAt = at;
    cues.push({ frame: at, praise: "NO MOVES - SHUFFLE", sound: "shuffle" });
    at += frames.shuffle;
  }
  if (after.ended) cues.push({ frame: at, sound: "lose" });
  return {
    after,
    before,
    bannerAt,
    cues,
    length: at,
    pops,
    shuffleAt,
    shuffled,
    steps: done.steps,
    swap: [cell, neighbour(cell, direction)],
  };
}
