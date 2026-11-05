import type { RunInput } from "@frostbite/game-sdk/run-record";

import {
  directions,
  holds,
  nextHead,
  sameCell,
  type Cell,
  type Direction,
} from "../../src/verifier/snake-board.ts";
import {
  createSnakeSession,
  type SnakeSession,
} from "../../src/snake/session.ts";
import {
  advanceTo,
  moveOnce,
  snakeRules,
  startSnake,
  type SnakeState,
} from "../../src/verifier/snake.ts";

// A player for the tests: it walks to the food by the shortest way that avoids the snake's body and the mines, steering the
// way the cabinet does (a turn is recorded only when the direction changes), and stops when the target length is reached
// or it has no way to go. What it produces is a record of turns and one end, played on the real rules.

function pathToFood(state: SnakeState): readonly Direction[] | null {
  const [head] = state.snake;
  const { food } = state;
  if (head === undefined || food === null) return null;
  const seen = new Map<string, readonly Direction[]>([[head.join(","), []]]);
  const queue: Cell[] = [head];
  for (const cell of queue) {
    const way = seen.get(cell.join(",")) ?? [];
    if (sameCell(cell, food)) return way;
    for (const direction of directions) {
      const next = nextHead(cell, direction);
      const key = next.join(",");
      if (seen.has(key) || holds(state.snake, next) || holds(state.mines, next))
        continue;
      seen.set(key, [...way, direction]);
      queue.push(next);
    }
  }
  return null;
}

export interface SolvedRun {
  readonly inputs: readonly RunInput[];
  // The turns among the inputs, readable: the direction and the tick it was chosen on.
  readonly turns: readonly { readonly dir: Direction; readonly tick: number }[];
  readonly state: SnakeState;
}

export function playSnake(seed: number, goal: number): SolvedRun | null {
  let state = startSnake(seed);
  const inputs: RunInput[] = [];
  const turns: { dir: Direction; tick: number }[] = [];
  while (state.snake.length < goal) {
    const way = pathToFood(state);
    if (way === null || state.tick + way.length > 1_000) return null;
    for (const dir of way) {
      if (dir !== state.planned) {
        const turned = snakeRules.step(state, {
          data: { dir, tick: state.tick },
          type: "turn",
        });
        if (!turned.ok) return null;
        state = turned.state;
        inputs.push({ data: { dir, tick: state.tick }, type: "turn" });
        turns.push({ dir, tick: state.tick });
      }
      state = moveOnce(state);
      if (!state.alive) return null;
    }
  }
  inputs.push({ data: { tick: state.tick }, type: "end" });
  return { inputs, state: advanceTo(state, state.tick), turns };
}

// The first seed from `from` that this player can win with.
export function winnableSeed(goal: number, from = 1): number {
  for (let seed = from; seed < from + 500; seed += 1)
    if (playSnake(seed, goal) !== null) return seed;
  throw new Error("No seed was winnable.");
}

// The same player at the cabinet: it steers the session the screen drives, one `turn` and one `tick` at a time. Gives the
// session, still open, when it has grown to `goal`; null if it could not.
export function playSession(
  seed: number,
  goal: number,
  onEarned?: (milestone: string) => void,
): SnakeSession | null {
  const session = createSnakeSession({ onEarned, seed });
  while (session.state().snake.length < goal) {
    const way = pathToFood(session.state());
    if (way === null || session.state().tick + way.length > 1_000) return null;
    for (const dir of way) {
      if (!session.turn(dir).ok) return null;
      session.tick();
      if (!session.state().alive) return null;
    }
  }
  return session;
}
