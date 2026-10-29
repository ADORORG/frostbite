import { cells, size, type Direction } from "./constants.ts";

// The four cells of each line a move slides along, from the edge the tiles slide toward.
function lines(direction: Direction): readonly (readonly number[])[] {
  return Array.from({ length: size }, (_, line) =>
    Array.from({ length: size }, (_, step) => {
      switch (direction) {
        case "left":
          return line * size + step;
        case "right":
          return line * size + (size - 1 - step);
        case "up":
          return step * size + line;
        case "down":
          return (size - 1 - step) * size + line;
      }
    }),
  );
}

export interface Slid {
  readonly board: readonly number[];
  // How many pairs of tiles joined.
  readonly merges: number;
  readonly moved: boolean;
  // The value of the tiles the joins made, added up.
  readonly points: number;
}

// One move of the whole board: tiles slide as far as they can toward an edge, and two equal tiles that meet join into one of the next
// level (each tile joins at most once in a move, the pair nearest the edge first).
export function slide(board: readonly number[], direction: Direction): Slid {
  const next = [...board];
  let merges = 0;
  let points = 0;
  for (const line of lines(direction)) {
    const tiles = line.map((at) => board[at] ?? 0).filter((level) => level > 0);
    const joined: number[] = [];
    for (let at = 0; at < tiles.length; at += 1) {
      const level = tiles[at] ?? 0;
      if (level === tiles[at + 1]) {
        joined.push(level + 1);
        points += 2 ** (level + 1);
        merges += 1;
        at += 1;
      } else joined.push(level);
    }
    line.forEach((cell, step) => {
      next[cell] = joined[step] ?? 0;
    });
  }
  return {
    board: next,
    merges,
    moved: next.some((level, at) => level !== board[at]),
    points,
  };
}

export const emptyCells = (board: readonly number[]): readonly number[] =>
  board.flatMap((level, at) => (level === 0 ? [at] : []));

// Whether any move would change the board: an empty cell, or two equal tiles side by side.
export function canMove(board: readonly number[]): boolean {
  if (emptyCells(board).length > 0) return true;
  return (
    ["left", "up"].some(
      (direction) => slide(board, direction as Direction).moved,
    ) ||
    ["right", "down"].some(
      (direction) => slide(board, direction as Direction).moved,
    )
  );
}

export const highest = (board: readonly number[]): number =>
  Math.max(0, ...board);

const corners: readonly number[] = [0, size - 1, cells - size, cells - 1];
export const inCorner = (board: readonly number[], level: number): boolean =>
  corners.some((at) => board[at] === level);
