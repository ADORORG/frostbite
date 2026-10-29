import { cells, tileValue } from "../rules/constants.ts";

// Draws a board into the page's grid: one element per cell, the tile's value as its text, and its level as a data attribute the page's
// styles colour. It reads the board and changes nothing but the page.
export function ensureCells(grid: HTMLElement): readonly HTMLElement[] {
  if (grid.children.length !== cells) {
    grid.replaceChildren(
      ...Array.from({ length: cells }, () => {
        const cell = document.createElement("div");
        cell.className = "tile";
        return cell;
      }),
    );
  }
  return [...grid.children] as HTMLElement[];
}

// `previous` is the board before the move: a tile where there was none is new, and one of a higher level than was there before is the
// product of a join. The page's styles animate both; with no previous board (a fresh run) nothing is marked.
export function showBoard(
  grid: HTMLElement,
  board: readonly number[],
  previous: readonly number[] | null = null,
): void {
  ensureCells(grid).forEach((cell, at) => {
    const level = board[at] ?? 0;
    const before = previous?.[at] ?? 0;
    cell.dataset.level = String(Math.min(level, 12));
    cell.textContent = level === 0 ? "" : String(tileValue(level));
    cell.dataset.new = String(previous !== null && level > 0 && before === 0);
    cell.dataset.merged = String(
      previous !== null && before > 0 && level > before,
    );
  });
  grid.setAttribute(
    "aria-label",
    `Board: ${board.map((level) => (level === 0 ? "empty" : String(tileValue(level)))).join(", ")}`,
  );
}
