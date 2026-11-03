import { cells, columns, rows } from "../rules/constants.ts";
import { kindOf } from "../rules/board.ts";
import type { Board } from "../rules/board.ts";
import { cell, cellX, cellY } from "./layout.ts";
import { burst, life, placeOf, type Particle } from "./particles.ts";
import { frames, type Timeline } from "./timeline.ts";

// What the screen shows at one frame of a playback: each shard where it is on the screen, which are frosted or flashing, the confetti, how much
// the screen shakes, the words on it, and the score and swaps to write. Worked out from the timeline and the frame number alone.
export interface Piece {
  readonly flash: boolean;
  readonly frosted: boolean;
  readonly value: number;
  readonly x: number;
  readonly y: number;
}

export interface Scene {
  readonly banner: boolean;
  readonly moves: number;
  readonly pieces: readonly Piece[];
  readonly praise: { readonly age: number; readonly text: string } | null;
  readonly score: number;
  readonly shake: number;
  readonly sparks: readonly {
    readonly age: number;
    readonly particle: Particle;
  }[];
}

export const praiseFrames = 46;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (progress: number): number => 1 - (1 - progress) ** 3;

function piecesOf(
  board: Board,
  frost: readonly boolean[],
  options: {
    readonly dy?: (index: number) => number;
    readonly flash?: ReadonlySet<number>;
    readonly slide?: ReadonlyMap<number, number>;
  } = {},
): Piece[] {
  return Array.from({ length: cells }, (_, index) => ({
    flash: options.flash?.has(index) ?? false,
    frosted: frost[index] === true,
    value: board[index] ?? 0,
    x: cellX(index) + (options.slide?.get(index) ?? 0),
    y: cellY(index) + (options.dy?.(index) ?? 0),
  }));
}

// The frost left after the steps before step `count` have cleared what they did.
function frostAfter(timeline: Timeline, count: number): readonly boolean[] {
  const gone = new Set(
    timeline.steps.slice(0, count).flatMap((step) => step.clear),
  );
  return timeline.before.frost.map(
    (frosted, index) => frosted && !gone.has(index),
  );
}

function sparksAt(timeline: Timeline, frame: number): Scene["sparks"] {
  const found: { age: number; particle: Particle }[] = [];
  timeline.steps.forEach((step, at) => {
    const age = frame - (timeline.pops[at] ?? 0);
    if (age < 0 || age >= life) return;
    const frozen = frostAfter(timeline, at);
    for (const index of step.clear) {
      const x = cellX(index) + cell / 2;
      const y = cellY(index) + cell / 2;
      for (const particle of burst(
        x,
        y,
        kindOf(step.before[index] ?? 0),
        index * 31 + at,
      ))
        found.push({ age, particle });
      if (frozen[index] === true)
        for (const particle of burst(x, y, "ice", index * 17 + at, 8))
          found.push({ age, particle });
    }
  });
  return found;
}

// The shake of the screen at a frame: a pixel or two, for the pop of a step that fired a bomb or star or ran a chain of three, and never otherwise.
function shakeAt(timeline: Timeline, frame: number): number {
  let magnitude = 0;
  timeline.steps.forEach((step, at) => {
    const age = frame - (timeline.pops[at] ?? 0);
    if (age < 0 || age >= frames.pop + 2) return;
    magnitude = Math.max(
      magnitude,
      step.fired.length > 0 ? 2 : at >= 2 ? 1 : 0,
    );
  });
  return magnitude === 0 ? 0 : (frame % 2 === 0 ? 1 : -1) * magnitude;
}

// The scene at `frame` of the playback, or null once it is over (the screen then shows the state itself).
export function sceneAt(timeline: Timeline, frame: number): Scene | null {
  if (frame >= timeline.length || frame < 0) return null;
  const { after, before, steps } = timeline;
  const last = steps.at(-1);
  const lastPop = (timeline.pops.at(-1) ?? 0) + frames.pop + frames.fall;
  const progress = clamp(
    (frame - frames.swap) / Math.max(1, lastPop - 1 - frames.swap),
  );
  const base = {
    banner: false,
    moves: frame >= lastPop ? after.moves : before.moves - 1,
    praise: null as Scene["praise"],
    score: Math.round(before.score + (after.score - before.score) * progress),
    shake: shakeAt(timeline, frame),
    sparks: sparksAt(timeline, frame),
  };
  const cue = timeline.cues
    .filter((c) => c.praise !== undefined && c.frame <= frame)
    .at(-1);
  if (cue?.praise !== undefined && frame - cue.frame < praiseFrames)
    base.praise = { age: frame - cue.frame, text: cue.praise };
  const [a, b] = timeline.swap;
  if (frame < frames.swap) {
    const p = easeOut(frame / frames.swap);
    const slide = new Map<number, number>([
      [a, (cellX(b) - cellX(a)) * p],
      [b, (cellX(a) - cellX(b)) * p],
    ]);
    const lift = new Map<number, number>([
      [a, (cellY(b) - cellY(a)) * p],
      [b, (cellY(a) - cellY(b)) * p],
    ]);
    return {
      ...base,
      pieces: piecesOf(before.board, before.frost, { slide }).map(
        (piece, index) => ({
          ...piece,
          y: piece.y + (lift.get(index) ?? 0),
        }),
      ),
    };
  }
  for (let at = 0; at < steps.length; at += 1) {
    const step = steps[at];
    const popStart = timeline.pops[at] ?? 0;
    if (step === undefined) break;
    if (frame < popStart + frames.pop)
      return {
        ...base,
        pieces: piecesOf(step.before, frostAfter(timeline, at), {
          flash: new Set(
            Math.floor((frame - popStart) / 2) % 2 === 0 ? step.clear : [],
          ),
        }),
      };
    if (frame < popStart + frames.pop + frames.fall) {
      const fall = easeOut((frame - popStart - frames.pop) / frames.fall);
      return {
        ...base,
        pieces: piecesOf(step.after, frostAfter(timeline, at + 1), {
          dy: (index) => -(step.drops[index] ?? 0) * cell * (1 - fall),
        }),
      };
    }
  }
  const settled = last?.after ?? after.board;
  if (timeline.bannerAt >= 0) {
    const into = frame - timeline.bannerAt;
    if (into < frames.banner)
      return {
        ...base,
        banner: true,
        pieces: piecesOf(settled, frostAfter(timeline, steps.length)),
      };
    const drop = frame - timeline.bannerAt - frames.banner;
    return {
      ...base,
      pieces: piecesOf(after.board, after.frost, {
        dy: (index) =>
          -rows * cell * (1 - easeOut(clamp((drop - (index % columns)) / 8))),
      }),
    };
  }
  if (timeline.shuffleAt >= 0) {
    const into = frame - timeline.shuffleAt;
    const old = into < frames.shuffle / 2;
    return {
      ...base,
      pieces: piecesOf(
        old ? settled : after.board,
        old ? frostAfter(timeline, steps.length) : after.frost,
      ),
      shake: old ? (frame % 2 === 0 ? 1 : -1) : 0,
    };
  }
  return { ...base, pieces: piecesOf(after.board, after.frost) };
}

export { placeOf };
