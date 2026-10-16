import { cells } from "../verifier/ice-field.ts";

export const columns = 5;

// How many of a tile's up to eight neighbours are mines: the classic hint shown on a safe tile once it is picked. It reads
// the layout and changes no rule.
export function neighbourMines(tile: number, mines: readonly number[]): number {
  const row = Math.floor(tile / columns);
  const column = tile % columns;
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const neighbourRow = row + dy;
      const neighbourColumn = column + dx;
      if (
        neighbourRow < 0 ||
        neighbourColumn < 0 ||
        neighbourColumn >= columns ||
        neighbourRow * columns + neighbourColumn >= cells
      )
        continue;
      if (mines.includes(neighbourRow * columns + neighbourColumn)) count += 1;
    }
  }
  return count;
}
