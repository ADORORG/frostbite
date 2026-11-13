import { columns, hiddenRows } from "../rules/constants.ts";
import { levelOf, lockDelayFor } from "../rules/difficulty.ts";
import { dropped } from "../rules/motion.ts";
import { cellsOf } from "../rules/pieces.ts";
import type { PermafrostState } from "../rules/types.ts";
import { drawCell } from "./cells.ts";
import {
  boardHeight,
  boardLeft,
  boardTop,
  boardWidth,
  cell,
  screenHeight,
  screenWidth,
  visibleRows,
} from "./layout.ts";
import { colour } from "./palette.ts";
import { drawPanels } from "./panels.ts";

// What the screen draws: the state of the run. Pure drawing, no game logic.
export interface Frame {
  readonly state: PermafrostState;
}

// The row above the board is drawn dimly; the board's own rows are drawn in full.
const spawnRow = hiddenRows - 1;
const placeX = (x: number): number => boardLeft + x * cell;
const placeY = (y: number): number => boardTop + (y - hiddenRows) * cell;

function drawBoard(
  context: CanvasRenderingContext2D,
  state: PermafrostState,
): void {
  context.fillStyle = colour.grid;
  context.fillRect(boardLeft, boardTop, boardWidth, boardHeight);
  for (let y = spawnRow; y < hiddenRows + visibleRows; y += 1)
    for (let x = 0; x < columns; x += 1) {
      const kind = state.board[y * columns + x] ?? 0;
      if (kind === 0) continue;
      context.globalAlpha = y < hiddenRows ? 0.45 : 1;
      drawCell(context, kind, placeX(x), placeY(y));
    }
  context.globalAlpha = 1;
}

// Where the piece would land, as an outline, and the piece itself, which fades a little as it rests on the stack and the moment to set
// it runs out.
function drawPiece(
  context: CanvasRenderingContext2D,
  state: PermafrostState,
): void {
  const piece = state.piece;
  const cells = cellsOf(piece.kind, piece.rotation);
  const landing = dropped(state.board, piece).piece;
  context.strokeStyle = colour.ghost;
  context.globalAlpha = 0.5;
  for (const [cx, cy] of cells) {
    const y = landing.y + cy;
    if (y >= hiddenRows)
      context.strokeRect(
        placeX(landing.x + cx) + 1.5,
        placeY(y) + 1.5,
        cell - 3,
        cell - 3,
      );
  }
  const fade = piece.grounded / lockDelayFor(levelOf(state.lines));
  context.globalAlpha = 1 - Math.min(0.5, fade * 0.5);
  for (const [cx, cy] of cells) {
    const y = piece.y + cy;
    if (y < spawnRow) continue;
    if (y < hiddenRows) context.globalAlpha *= 0.45;
    drawCell(context, piece.kind, placeX(piece.x + cx), placeY(y));
    context.globalAlpha = 1 - Math.min(0.5, fade * 0.5);
  }
  context.globalAlpha = 1;
}

export function draw(context: CanvasRenderingContext2D, frame: Frame): void {
  const { state } = frame;
  context.fillStyle = colour.background;
  context.fillRect(0, 0, screenWidth, screenHeight);
  drawBoard(context, state);
  if (!state.blocked) drawPiece(context, state);
  context.strokeStyle = state.blocked ? colour.danger : colour.frame;
  context.strokeRect(
    boardLeft - 0.5,
    boardTop - 0.5,
    boardWidth + 1,
    boardHeight + 1,
  );
  drawPanels(context, state, levelOf(state.lines));
}
