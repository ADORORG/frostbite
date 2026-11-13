import { previewFor } from "../rules/difficulty.ts";
import { cellsOf } from "../rules/pieces.ts";
import type { PermafrostState } from "../rules/types.ts";
import { drawCell } from "./cells.ts";
import {
  holdLeft,
  mini,
  nextLeft,
  panelGap,
  panelHeight,
  panelTop,
  panelWidth,
} from "./layout.ts";
import { colour } from "./palette.ts";

function box(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
): void {
  context.fillStyle = colour.panel;
  context.fillRect(left, top, panelWidth, panelHeight);
  context.strokeStyle = colour.frame;
  context.strokeRect(left + 0.5, top + 0.5, panelWidth - 1, panelHeight - 1);
}

// A piece at the size of the side boxes, centred in the box whose top left is `left`, `top`.
function drawMini(
  context: CanvasRenderingContext2D,
  kind: number,
  left: number,
  top: number,
): void {
  const cells = cellsOf(kind, 0);
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const width = (Math.max(...xs) - Math.min(...xs) + 1) * mini;
  const height = (Math.max(...ys) - Math.min(...ys) + 1) * mini;
  const x0 =
    left + Math.floor((panelWidth - width) / 2) - Math.min(...xs) * mini;
  const y0 =
    top + Math.floor((panelHeight - height) / 2) - Math.min(...ys) * mini;
  for (const [cx, cy] of cells)
    drawCell(context, kind, x0 + cx * mini, y0 + cy * mini, mini);
}

// The piece held (dimmed once it has been used for this piece), and the pieces to come: as many as the level shows.
export function drawPanels(
  context: CanvasRenderingContext2D,
  state: PermafrostState,
  level: number,
): void {
  box(context, holdLeft, panelTop);
  if (state.hold !== 0) {
    context.globalAlpha = state.holdUsed ? 0.35 : 1;
    drawMini(context, state.hold, holdLeft, panelTop);
    context.globalAlpha = 1;
  }
  const shown = previewFor(level);
  for (let at = 0; at < shown; at += 1) {
    const top = panelTop + at * (panelHeight + panelGap);
    box(context, nextLeft, top);
    const kind = state.queue[at];
    if (kind !== undefined) drawMini(context, kind, nextLeft, top);
  }
}
