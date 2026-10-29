import {
  ease,
  loopTime,
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  stars,
  type Scene,
  type Surface,
} from "../engine/index.ts";

// Falling blocks, as a puzzle that solves itself and starts again without a seam. Two rows at the bottom of the well are filled but for
// holes shaped to take four pieces. The pieces fall in and complete the rows, the rows flash and go, and a fresh pair of rows rises from
// below, so the end of the loop is the start of the next. A second puzzle, with different holes, shares the loop.
type Cell = readonly [number, number];
interface Piece {
  readonly cells: readonly Cell[];
  readonly colour: string;
  readonly column: number;
  readonly row: number;
}
interface Puzzle {
  readonly holes: readonly number[];
  readonly pieces: readonly Piece[];
}

const columns = 10;
const cell = 5;
const rows = 18;
const well = (sceneWidth - columns * cell) / 2;
const upper = rows - 2;
const lower = rows - 1;
const bar: readonly Cell[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
];
const square: readonly Cell[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

// Each puzzle lists the columns left open and the pieces that fill them. Every hole is open from above, so a piece can fall in, and the
// pieces together fill every hole in both rows.
const puzzles: readonly Puzzle[] = [
  {
    holes: [0, 1, 3, 4, 5, 6, 8, 9],
    pieces: [
      { cells: bar, colour: palette.cyan, column: 3, row: lower },
      { cells: bar, colour: palette.yellow, column: 3, row: upper },
      { cells: square, colour: palette.pink, column: 0, row: upper },
      { cells: square, colour: palette.green, column: 8, row: upper },
    ],
  },
  {
    holes: [0, 1, 2, 3, 5, 6, 8, 9],
    pieces: [
      { cells: square, colour: palette.purple, column: 5, row: upper },
      { cells: bar, colour: palette.red, column: 0, row: lower },
      { cells: square, colour: palette.cyan, column: 8, row: upper },
      { cells: bar, colour: palette.yellow, column: 0, row: upper },
    ],
  },
];

const puzzleSeconds = 9;
const loopSeconds = puzzles.length * puzzleSeconds;
const firstDrop = 0.5;
const secondsPerPiece = 1.6;
const fallRowsPerSecond = 14;
const clearAt = 7;
const flashSeconds = 0.8;
const flashBlink = 0.1;
const riseSeconds = 0.5;

function drawStack(surface: Surface, holes: readonly number[], lift: number) {
  for (const row of [upper, lower])
    for (let column = 0; column < columns; column += 1)
      if (!holes.includes(column))
        rect(
          surface,
          well + column * cell,
          row * cell + lift,
          cell - 1,
          cell - 1,
          palette.ridge,
        );
}

function drawPieces(surface: Surface, puzzle: Puzzle, local: number) {
  puzzle.pieces.forEach((piece, index) => {
    const start = firstDrop + index * secondsPerPiece;
    if (local < start) return;
    const top = Math.min(piece.row, -2 + (local - start) * fallRowsPerSecond);
    for (const [across, down] of piece.cells)
      rect(
        surface,
        well + (piece.column + across) * cell,
        Math.floor(top + down) * cell,
        cell - 1,
        cell - 1,
        piece.colour,
      );
  });
}

export const blocks: Scene = {
  id: "blocks",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
      stars(surface, 5, 40, 60);
      rect(surface, well - 2, 0, 2, sceneHeight, palette.deeper);
      rect(surface, well + columns * cell, 0, 2, sceneHeight, palette.deeper);
      puzzles.forEach((puzzle, at) => {
        // This puzzle's own clock. It starts a moment before zero, while its rows rise, so the first puzzle's rows are already in place
        // when the loop begins.
        const local =
          loopTime(t - at * puzzleSeconds + riseSeconds, loopSeconds) -
          riseSeconds;
        if (local >= clearAt + flashSeconds) return;
        const lift =
          local < 0
            ? (1 - ease((local + riseSeconds) / riseSeconds)) * 2 * cell
            : 0;
        const flashing =
          local >= clearAt &&
          Math.floor((local - clearAt) / flashBlink) % 2 === 0;
        if (flashing) {
          for (const row of [upper, lower])
            rect(
              surface,
              well,
              row * cell,
              columns * cell - 1,
              cell - 1,
              palette.white,
            );
          return;
        }
        drawStack(surface, puzzle.holes, lift);
        drawPieces(surface, puzzle, local);
      });
    },
    loopSeconds,
  }),
  name: "Falling blocks",
};
