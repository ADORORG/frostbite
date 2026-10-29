import type { TowerState } from "../rules/types.ts";
import type { Cut, Slab } from "../session.ts";
import { drawBackdrop, drawGround } from "./backdrop.ts";
import { colour, slabPalette } from "./palette.ts";
import {
  block,
  fieldLeft,
  rowTop,
  screenHeight,
  slabHeight,
} from "./layout.ts";

// Everything a frame needs to be drawn, so the drawing is a function of this and nothing else.
export interface View {
  readonly camera: number;
  readonly clock: number;
  readonly cut: Cut | null;
  readonly movingX: number;
  readonly slabs: readonly Slab[];
  readonly state: TowerState;
}

// A block of lit ice: its face, a bright edge along the top, a shaded foot, and a glint on a perfect one.
function drawSlab(
  context: CanvasRenderingContext2D,
  row: number,
  x: number,
  width: number,
  y: number,
  perfect: boolean,
): void {
  const palette = slabPalette(row);
  if (y > screenHeight || y < -slabHeight) return;
  block(context, palette.face, fieldLeft + x, y, width, slabHeight);
  block(context, palette.top, fieldLeft + x, y, width, 1);
  block(context, palette.foot, fieldLeft + x, y + slabHeight - 1, width, 1);
  if (perfect) block(context, colour.core, fieldLeft + x + 1, y + 1, 2, 1);
}

// The trimmed-off piece falling away, for the second after the drop that made it.
function drawCut(context: CanvasRenderingContext2D, view: View): void {
  const { cut } = view;
  if (cut === null) return;
  const age = view.clock - cut.at;
  if (age > 40) return;
  const row = view.slabs.length - 1;
  const y =
    rowTop(view.state.over ? row + 1 : row, view.camera) + age * age * 0.12;
  block(
    context,
    slabPalette(row + 1).foot,
    fieldLeft + cut.x,
    y,
    cut.width,
    slabHeight,
  );
}

export function draw(context: CanvasRenderingContext2D, view: View): void {
  const { camera, state } = view;
  drawBackdrop(context, view.clock, camera);
  drawGround(context, camera);
  const top = view.slabs[view.slabs.length - 1];
  if (top !== undefined && !state.over)
    block(
      context,
      colour.ghost,
      fieldLeft + top.x,
      0,
      top.width,
      rowTop(view.slabs.length - 1, camera),
    );
  view.slabs.forEach((slab, row) =>
    drawSlab(
      context,
      row,
      slab.x,
      slab.width,
      rowTop(row, camera),
      slab.perfect,
    ),
  );
  if (!state.ended && !state.over)
    drawSlab(
      context,
      view.slabs.length,
      view.movingX,
      state.width,
      rowTop(view.slabs.length, camera),
      false,
    );
  drawCut(context, view);
}
