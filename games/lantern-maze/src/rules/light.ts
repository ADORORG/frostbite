import { cellOpen, neighbour, type Maze } from "./maze.ts";

// The lantern lights every cell within `sight` steps of it along the open sides (light goes down passages, not through walls). Returns
// the cells seen so far with those added.
export function lightAround(
  maze: Maze,
  seen: readonly boolean[],
  from: number,
  sight: number,
): readonly boolean[] {
  const next = [...seen];
  for (const cell of lit(maze, from, sight).keys()) next[cell] = true;
  return next;
}

// The cells the lantern lights from `from`, each with how many steps from it. The screen draws the near ones brighter.
export function lit(
  maze: Maze,
  from: number,
  sight: number,
): ReadonlyMap<number, number> {
  const reach = new Map<number, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head] ?? 0;
    const steps = reach.get(cell) ?? 0;
    if (steps >= sight) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      if (!cellOpen(maze, cell, direction)) continue;
      const other = neighbour(maze.width, maze.height, cell, direction);
      if (other < 0 || reach.has(other)) continue;
      reach.set(other, steps + 1);
      queue.push(other);
    }
  }
  return reach;
}
