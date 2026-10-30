import { block } from "@ador/game-sdk/pixels";

import { cellOpen } from "../rules/maze.ts";
import { lit } from "../rules/light.ts";
import type { MazeState } from "../rules/state.ts";
import { cell, originOf } from "./layout.ts";
import { colour, floorByDistance } from "./palette.ts";

// The cellar as the lantern shows it: cells never lit are black; cells lit before are dim, with their walls; cells lit now glow, brighter
// near the lantern. The key, the door and flasks show wherever they have been seen.
function walls(
  context: CanvasRenderingContext2D,
  state: MazeState,
  at: number,
  x: number,
  y: number,
  fill: string,
): void {
  const { maze } = state.layout;
  if (!cellOpen(maze, at, 0)) block(context, fill, x, y, cell, 1);
  if (!cellOpen(maze, at, 3)) block(context, fill, x, y, 1, cell);
  if (!cellOpen(maze, at, 2)) block(context, fill, x, y + cell - 1, cell, 1);
  if (!cellOpen(maze, at, 1)) block(context, fill, x + cell - 1, y, 1, cell);
}

function keyAt(context: CanvasRenderingContext2D, x: number, y: number): void {
  block(context, colour.key, x + 2, y + 2, 3, 3);
  block(context, colour.key, x + 5, y + 3, 2, 1);
  block(context, colour.black, x + 3, y + 3, 1, 1);
}

function flaskAt(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  block(context, colour.flaskGlass, x + 3, y + 1, 2, 1);
  block(context, colour.flask, x + 2, y + 2, 4, 4);
  block(context, colour.flaskGlass, x + 3, y + 3, 1, 1);
}

function doorAt(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  open: boolean,
): void {
  const fill = open ? colour.doorOpen : colour.door;
  block(context, fill, x + 1, y + 1, cell - 2, cell - 2);
  block(context, colour.black, x + 2, y + 2, cell - 4, cell - 4);
  if (!open) block(context, fill, x + 3, y + 3, 2, 2);
}

export function mazeView(
  context: CanvasRenderingContext2D,
  state: MazeState,
): void {
  const { layout } = state;
  const { maze } = layout;
  const origin = originOf(maze.width, maze.height);
  const lightNow = lit(maze, state.position, layout.sight);
  // The floor's footprint is shown from the start (how big the cellar is is no secret, only what is in it), in a dark that the lit cells stand out from.
  block(
    context,
    colour.footprint,
    origin.x - 1,
    origin.y - 1,
    maze.width * cell + 2,
    maze.height * cell + 2,
  );
  for (let at = 0; at < maze.open.length; at += 1) {
    if (state.seen[at] !== true) continue;
    const x = origin.x + (at % maze.width) * cell;
    const y = origin.y + Math.floor(at / maze.width) * cell;
    const near = lightNow.get(at);
    block(
      context,
      near === undefined
        ? colour.floorSeen
        : (floorByDistance[near] ?? colour.floorFar),
      x,
      y,
      cell,
      cell,
    );
    walls(
      context,
      state,
      at,
      x,
      y,
      near === undefined ? colour.wallSeen : colour.wall,
    );
    if (at === layout.door) doorAt(context, x, y, state.hasKey);
    if (at === layout.key && !state.hasKey) keyAt(context, x, y);
    if (state.flasks.includes(at)) flaskAt(context, x, y);
  }
}

// The lantern: a flame that flickers from one step to the next.
export function lantern(
  context: CanvasRenderingContext2D,
  state: MazeState,
): void {
  const { maze } = state.layout;
  const origin = originOf(maze.width, maze.height);
  const x = origin.x + (state.position % maze.width) * cell;
  const y = origin.y + Math.floor(state.position / maze.width) * cell;
  const flicker = state.moves % 2;
  block(context, colour.flame, x + 2, y + 2 + flicker, 4, 4 - flicker);
  block(context, colour.flameHot, x + 3, y + 3 + flicker, 2, 2 - flicker);
}
