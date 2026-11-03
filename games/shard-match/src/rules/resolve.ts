import { bomb, kindSlots, linePoints, shardPoints, star } from "./constants.ts";
import {
  at,
  blastOf,
  kindOf,
  runsOf,
  settle,
  specialOf,
  type Board,
} from "./board.ts";

// One step of a chain, for the screen to play back: the board before it, the cells cleared, the specials made (cell and value) and the bombs
// and stars that went off, and the board after what is left has fallen and new shards have come in, with how far each shard fell.
export interface Step {
  readonly after: Board;
  readonly before: Board;
  readonly clear: readonly number[];
  readonly drops: readonly number[];
  readonly fired: readonly number[];
  readonly made: readonly (readonly [number, number])[];
}

// What one swap did: the board it left, the generator state, and the numbers the milestones count.
export interface Resolved {
  readonly board: Board;
  readonly bombsFired: number;
  readonly bombsMade: number;
  readonly cleared: number;
  readonly clearedCells: readonly number[];
  readonly depth: number;
  readonly longest: number;
  readonly points: number;
  readonly rng: number;
  readonly starsMade: number;
  readonly steps: readonly Step[];
}

// Plays out what a swap sets going: every line is cleared (a line of four leaves a bomb where the swapped shard was, a line of five or more
// a star), bombs and stars in a cleared line go off, what is left falls, new shards come in, and any new lines clear, until the board is
// still. `moved` are the two cells the swap changed, which decide where a made special goes on the first step.
export function resolve(
  start: Board,
  moved: readonly number[],
  kindsFor: number,
  rng: number,
): Resolved {
  let board = start;
  let state = rng;
  let depth = 0;
  const total = {
    bombsFired: 0,
    bombsMade: 0,
    cleared: 0,
    longest: 0,
    points: 0,
    starsMade: 0,
  };
  const everything = new Set<number>();
  const steps: Step[] = [];
  for (;;) {
    const runs = runsOf(board);
    if (runs.length === 0) break;
    depth += 1;
    const going = new Set<number>(runs.flatMap((run) => run.cells));
    const made = new Map<number, number>();
    let bonus = 0;
    for (const run of runs) {
      total.longest = Math.max(total.longest, run.cells.length);
      if (run.cells.length < 4) continue;
      bonus += linePoints * (run.cells.length - 3) * depth;
      const spot =
        (depth === 1
          ? moved.find((cell) => run.cells.includes(cell))
          : undefined) ??
        run.cells[Math.floor(run.cells.length / 2)] ??
        0;
      made.set(
        spot,
        kindOf(at(board, spot)) +
          (run.cells.length === 4 ? bomb : star) * kindSlots,
      );
    }
    // A bomb or star in a cleared line goes off, and what its blast reaches may go off too, until nothing new is reached.
    const fired = new Set<number>();
    const queue = [...going];
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head] ?? 0;
      const special = specialOf(at(board, cell));
      if (special === 0 || fired.has(cell)) continue;
      fired.add(cell);
      for (const hit of blastOf(cell, special))
        if (!going.has(hit)) {
          going.add(hit);
          queue.push(hit);
        }
    }
    for (const spot of made.keys()) going.delete(spot);
    total.bombsFired += [...fired].filter(
      (cell) => specialOf(at(board, cell)) === bomb,
    ).length;
    total.bombsMade += [...made.values()].filter(
      (value) => specialOf(value) === bomb,
    ).length;
    total.starsMade += [...made.values()].filter(
      (value) => specialOf(value) === star,
    ).length;
    total.cleared += going.size;
    total.points += going.size * shardPoints * depth + bonus;
    for (const cell of going) everything.add(cell);
    const placed = board.map((value, cell) => made.get(cell) ?? value);
    const next = settle(placed, going, kindsFor, state);
    steps.push({
      after: next.board,
      before: board,
      clear: [...going],
      drops: next.drops,
      fired: [...fired],
      made: [...made.entries()],
    });
    board = next.board;
    state = next.state;
  }
  return {
    ...total,
    board,
    clearedCells: [...everything],
    depth,
    rng: state,
    steps,
  };
}
