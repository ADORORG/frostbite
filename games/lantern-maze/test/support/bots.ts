import { cellOpen, distances, neighbour } from "../../src/rules/maze.ts";
import { stepOnce } from "../../src/rules/move.ts";
import { startRun, type MazeState } from "../../src/rules/state.ts";

// Two players, to measure the game with. The scout sees the whole maze and takes the shortest route (and, if it has oil to spare, the
// flasks near it). The wanderer sees only what the lantern has lit, and explores the nearest dark corner of it, which is a careful
// player with a good memory.
export interface Result {
  readonly state: MazeState;
  readonly steps: readonly number[];
}

const run = (
  seed: number,
  choose: (state: MazeState) => number | null,
  limit = 6_000,
): Result => {
  let state = startRun(seed);
  const steps: number[] = [];
  while (!state.ended && steps.length < limit) {
    const direction = choose(state);
    if (direction === null) break;
    const next = stepOnce(state, direction);
    if (typeof next === "string") break;
    state = next;
    steps.push(direction);
  }
  return { state, steps };
};

// The first step of a shortest way from `from` to `to`, among the cells `allowed`.
function firstStep(
  state: MazeState,
  to: (cell: number) => boolean,
  allowed: (cell: number) => boolean = () => true,
): number | null {
  const { maze } = state.layout;
  const queue = [state.position];
  const first = new Map<number, number>([[state.position, -1]]);
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head] ?? 0;
    if (cell !== state.position && to(cell)) return first.get(cell) ?? null;
    for (let d = 0; d < 4; d += 1) {
      if (!cellOpen(maze, cell, d)) continue;
      const other = neighbour(maze.width, maze.height, cell, d);
      if (other < 0 || first.has(other) || !allowed(other)) continue;
      first.set(other, cell === state.position ? d : (first.get(cell) ?? d));
      queue.push(other);
    }
  }
  return null;
}

const goal = (state: MazeState): number =>
  state.hasKey ? state.layout.door : state.layout.key;

// Sees everything: the shortest route, with a detour for a flask when the oil left after the whole detour still covers the route.
export const scout = (seed: number, greedy = false): Result =>
  run(seed, (state) => {
    if (greedy) {
      const far = distances(state.layout.maze, state.position);
      const home = distances(state.layout.maze, goal(state));
      const near = state.flasks
        .filter(
          (cell) =>
            (far[cell] ?? 0) * 2 +
              (home[cell] ?? 0) +
              (home[state.position] ?? 0) <
            state.oil - (home[state.position] ?? 0) + state.layout.flaskValue,
        )
        .sort((a, b) => (far[a] ?? 0) - (far[b] ?? 0))[0];
      if (near !== undefined) return firstStep(state, (cell) => cell === near);
    }
    return firstStep(state, (cell) => cell === goal(state));
  });

// Sees only lit cells. Goes to the key or door if it has been lit, else to the nearest lit cell next to a dark one.
export const wanderer = (seed: number): Result =>
  run(seed, (state) => {
    const { maze } = state.layout;
    const lit = (cell: number): boolean => state.seen[cell] === true;
    if (lit(goal(state)))
      return firstStep(state, (cell) => cell === goal(state), lit);
    const frontier = (cell: number): boolean =>
      [0, 1, 2, 3].some((d) => {
        if (!cellOpen(maze, cell, d)) return false;
        const other = neighbour(maze.width, maze.height, cell, d);
        return other >= 0 && !lit(other);
      });
    return (
      firstStep(
        state,
        (cell) => state.flasks.includes(cell) && lit(cell),
        lit,
      ) ?? firstStep(state, frontier, lit)
    );
  });
