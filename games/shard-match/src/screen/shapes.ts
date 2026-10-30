import { block, sprite } from "@ador/game-sdk/pixels";

import { bomb, kindSlots, star } from "../rules/constants.ts";
import { colour, frostColour, kindColours, kindShades } from "./palette.ts";

// A shard is a picture of 8 by 8 pixels, a different shape for each kind (so the kinds do not rely on colour alone).
const shapes: readonly (readonly string[])[] = [
  [
    "...##...",
    "..####..",
    ".######.",
    "########",
    "########",
    ".######.",
    "..####..",
    "...##...",
  ],
  [
    ".######.",
    "########",
    "##....##",
    "##.##.##",
    "##.##.##",
    "##....##",
    "########",
    ".######.",
  ],
  [
    "..####..",
    ".######.",
    "########",
    "########",
    "########",
    "########",
    ".######.",
    "..####..",
  ],
  [
    "...##...",
    "...##...",
    "..####..",
    "..####..",
    ".######.",
    ".######.",
    "########",
    "########",
  ],
  [
    "##....##",
    "###..###",
    ".######.",
    "..####..",
    "..####..",
    ".######.",
    "###..###",
    "##....##",
  ],
  [
    "..####..",
    ".######.",
    "###..###",
    "###..###",
    "###..###",
    "###..###",
    ".######.",
    "..####..",
  ],
];

// A shard at (x, y) on the screen: its shape in its colour, a darker underside and a bright glint so it looks rounded, and a frame for a bomb
// or a star. `flash` draws it white (as it pops), and `frosted` lays frost over the cell.
export function shard(
  context: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  options: { readonly flash?: boolean; readonly frosted?: boolean } = {},
): void {
  const kind = value % kindSlots;
  const special = Math.floor(value / kindSlots);
  const rows = shapes[kind];
  if (rows !== undefined) {
    const fill =
      options.flash === true
        ? colour.white
        : (kindColours[kind] ?? colour.text);
    sprite(context, rows, { "#": fill }, x + 1, y + 1);
    if (options.flash !== true) {
      sprite(
        context,
        rows.map((row, at) => (at >= 6 ? row : row.replace(/#/gu, "."))),
        { "#": kindShades[kind] ?? fill },
        x + 1,
        y + 1,
      );
      block(context, colour.white, x + 3, y + 3, 2, 1);
      block(context, colour.white, x + 3, y + 4, 1, 1);
    }
  }
  if (special === bomb) frame(context, colour.white, x, y, 10);
  if (special === star) {
    frame(context, colour.grab, x, y, 10);
    block(context, colour.white, x + 4, y + 4, 2, 2);
  }
  if (options.frosted === true) {
    context.globalAlpha = 0.5;
    block(context, frostColour, x, y, 10, 10);
    context.globalAlpha = 1;
    frame(context, colour.white, x, y, 10);
    block(context, colour.white, x + 1, y + 1, 2, 1);
  }
}

// A one pixel frame `size` pixels square.
export function frame(
  context: CanvasRenderingContext2D,
  fill: string,
  x: number,
  y: number,
  size: number,
): void {
  block(context, fill, x, y, size, 1);
  block(context, fill, x, y + size - 1, size, 1);
  block(context, fill, x, y, 1, size);
  block(context, fill, x + size - 1, y, 1, size);
}
