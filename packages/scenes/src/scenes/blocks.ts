import {
  palette,
  rect,
  seededRandom,
  sceneHeight,
  sceneWidth,
  stars,
  type Scene,
} from "../engine/index.ts";

// Falling blocks: seven generic shapes drop onto a stack. Each shape is a list of [column, row] cells. The stack is worked out once, so
// every shape comes to rest where the ones before it left room, and the loop fades and starts over.
type Cell = readonly [number, number];
const shapes: readonly (readonly Cell[])[] = [
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
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
];
const tints = [
  palette.cyan,
  palette.yellow,
  palette.purple,
  palette.red,
  palette.green,
  palette.pink,
  palette.cyan,
] as const;

const columns = 10;
const rows = 18;
const cell = 5;
const pieces = 15;
const secondsPerPiece = 1.25;
const fallCellsPerSecond = 16;
const fadeSeconds = 1;
const well = (sceneWidth - columns * cell) / 2;

interface Piece {
  readonly cells: readonly Cell[];
  readonly colour: string;
  readonly column: number;
  readonly row: number;
  readonly start: number;
}

function layOut(): readonly Piece[] {
  const random = seededRandom(7);
  const board: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );
  const laid: Piece[] = [];
  for (let at = 0; at < pieces; at += 1) {
    const kind = Math.floor(random() * shapes.length);
    const cells = shapes[kind] ?? shapes[0] ?? [];
    const width = Math.max(...cells.map(([column]) => column)) + 1;
    const column = Math.floor(random() * (columns - width + 1));
    const colour = tints[kind] ?? palette.cyan;
    const fits = (row: number) =>
      cells.every(([across, down]) => {
        const line = board[row + down];
        return line !== undefined && line[column + across] === null;
      });
    let row = 0;
    while (fits(row + 1)) row += 1;
    for (const [across, down] of cells) {
      const line = board[row + down];
      if (line !== undefined) line[column + across] = colour;
    }
    laid.push({ cells, colour, column, row, start: at * secondsPerPiece });
  }
  return laid;
}

export const blocks: Scene = {
  id: "blocks",
  make: () => {
    const laid = layOut();
    const loopSeconds = Math.ceil(laid.length * secondsPerPiece + 2);
    return {
      draw: (surface, t) => {
        rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
        stars(surface, 5, 40, 60);
        rect(surface, well - 2, 0, 2, sceneHeight, palette.deeper);
        rect(surface, well + columns * cell, 0, 2, sceneHeight, palette.deeper);
        surface.globalAlpha =
          t > loopSeconds - fadeSeconds ? Math.max(0, loopSeconds - t) : 1;
        for (const piece of laid) {
          if (t < piece.start) continue;
          const top = Math.min(
            piece.row,
            (t - piece.start) * fallCellsPerSecond,
          );
          for (const [across, down] of piece.cells) {
            rect(
              surface,
              well + (piece.column + across) * cell,
              Math.floor(top + down) * cell,
              cell - 1,
              cell - 1,
              piece.colour,
            );
          }
        }
        surface.globalAlpha = 1;
      },
      loopSeconds,
    };
  },
  name: "Falling blocks",
};
