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

export function showBoard(grid: HTMLElement, board: readonly number[]): void {
  ensureCells(grid).forEach((cell, at) => {
    const level = board[at] ?? 0;
    cell.dataset.level = String(Math.min(level, 12));
    cell.textContent = level === 0 ? "" : String(tileValue(level));
  });
  grid.setAttribute(
    "aria-label",
    `Board: ${board.map((level) => (level === 0 ? "empty" : String(tileValue(level)))).join(", ")}`,
  );
}
