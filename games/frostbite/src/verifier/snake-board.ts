import { pickDistinct, startState, stepSeed } from "./seeded.ts";

// The geometry of SAT SNAKE and the one move it is made of. No clock: a move is a tick, and the screen decides how long a
// tick lasts. The board, the wrap-around edges, the starting snake and the clear rows around it are the game's own.

export const gridSize = 12;
export const cellCount = gridSize * gridSize;
export const mineCount = 7;
// The snake starts in this row heading right; this row and the ones either side are kept clear of mines, so the player has
// room to react before the first hazard.
export const startRow = 6;
export const clearRowsEitherSide = 1;
// Mixed into the seed for the food's own stream of draws, so food does not follow the mine layout's numbers.
export const foodSeedOffset = 0x9e37_79b9;

export type Direction = "down" | "left" | "right" | "up";
export type Cell = readonly [number, number];

const steps: Record<Direction, Cell> = {
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
};
const opposites: Record<Direction, Direction> = {
  down: "up",
  left: "right",
  right: "left",
  up: "down",
};
export const directions = Object.keys(steps) as readonly Direction[];
export const isOpposite = (a: Direction, b: Direction): boolean =>
  opposites[a] === b;

export const startingSnake: readonly Cell[] = [
  [6, startRow],
  [5, startRow],
  [4, startRow],
];
export const startingHeading: Direction = "right";

export const sameCell = (a: Cell, b: Cell): boolean =>
  a[0] === b[0] && a[1] === b[1];
export const holds = (cells: readonly Cell[], cell: Cell): boolean =>
  cells.some((held) => sameCell(held, cell));

// The mines of a run: seven distinct cells from its seed, none in the rows kept clear.
export function placeMines(seed: number): readonly Cell[] {
  return pickDistinct(seed, cellCount, mineCount)
    .map((index): Cell => [index % gridSize, Math.floor(index / gridSize)])
    .filter(([, y]) => Math.abs(y - startRow) > clearRowsEitherSide);
}

export const nextHead = (head: Cell, direction: Direction): Cell => {
  const [dx, dy] = steps[direction];
  return [
    (head[0] + dx + gridSize) % gridSize,
    (head[1] + dy + gridSize) % gridSize,
  ];
};

export interface Food {
  readonly cell: Cell | null;
  readonly generator: number;
}

// Where the next food goes: one draw picks among the cells the snake and the mines do not hold, so it always lands, the
// draw count never depends on how crowded the board is, and the food is never on a mine. No free cell: no food.
export function placeFood(
  generator: number,
  snake: readonly Cell[],
  mines: readonly Cell[],
): Food {
  const free: Cell[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const cell: Cell = [index % gridSize, Math.floor(index / gridSize)];
    if (!holds(snake, cell) && !holds(mines, cell)) free.push(cell);
  }
  const drawn = stepSeed(generator);
  return {
    cell: free[Math.floor(drawn.value * free.length)] ?? null,
    generator: drawn.state,
  };
}

export const foodGenerator = (seed: number): number =>
  startState((seed + foodSeedOffset) >>> 0);
