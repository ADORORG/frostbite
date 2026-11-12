type Cell = readonly [x: number, y: number];

// The seven pieces, numbered 1 to 7 in this order, each drawn in the top rows of its box.
const base: readonly (readonly Cell[])[] = [
  [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
];
export const pieceNames = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export const pieceCount = base.length;
// The width of the box each is turned in; the square never turns.
const boxes: readonly number[] = [4, 2, 3, 3, 3, 3, 3];
const square = 2;

const turned = (cells: readonly Cell[], box: number): readonly Cell[] =>
  cells.map(([x, y]): Cell => [box - 1 - y, x]);

// shapes[piece - 1][rotation]: the four cells it fills, by box.
const shapes: readonly (readonly (readonly Cell[])[])[] = base.map(
  (cells, at) => {
    const box = boxes[at] ?? 3;
    if (at === square - 1) return [cells, cells, cells, cells];
    const first = cells;
    const second = turned(first, box);
    const third = turned(second, box);
    return [first, second, third, turned(third, box)];
  },
);

const noCells: readonly Cell[] = [];
export const cellsOf = (kind: number, rotation: number): readonly Cell[] =>
  shapes[kind - 1]?.[rotation & 3] ?? noCells;

// Where to try a piece when a turn would put it into a wall or the stack: where it is, a column to either side, one row up, and for the
// long piece two columns. This is simpler than the usual kick tables, and the same for everyone.
const nearby: readonly Cell[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
];
const longReach: readonly Cell[] = [
  [-2, 0],
  [2, 0],
];
export const kicksFor = (kind: number): readonly Cell[] =>
  kind === 1 ? [...nearby, ...longReach] : nearby;
