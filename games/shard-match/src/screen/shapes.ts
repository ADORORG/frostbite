import { block, sprite } from "@ador/game-sdk/pixels";

import { bomb, kindSlots, star } from "../rules/constants.ts";
import { colour, kindColours } from "./palette.ts";

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

export function shard(
  context: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
): void {
  const kind = value % kindSlots;
  const special = Math.floor(value / kindSlots);
  const fill = kindColours[kind] ?? colour.text;
  const rows = shapes[kind];
  if (rows !== undefined) sprite(context, rows, { "#": fill }, x + 1, y + 1);
  if (special === bomb) frame(context, colour.white, x, y, 10);
  if (special === star) {
    frame(context, colour.grab, x, y, 10);
    block(context, colour.white, x + 4, y + 4, 2, 2);
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
