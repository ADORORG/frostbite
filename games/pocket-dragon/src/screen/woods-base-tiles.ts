import { block, sprite } from "@frostbite/game-sdk/pixels";

import type { Spot } from "../rules/grid.ts";
import {
  baseRows,
  baseTile,
  cages,
  chests,
  panels,
  valves,
} from "../rules/woods/base-map.ts";
import type { Base } from "../rules/woods/types.ts";
import { colour } from "./palette.ts";
import { friendKey, glitchyFront } from "./sprites.ts";

// The ground of the woods outside the maze, seen from above, sixteen pixels to a tile: grass and paths, trees, water, the stone of
// DeFu's castle and the dark floor of her dungeon, and what stands on them (chests, cages with their dragons, the egg factory and its
// valves, the rocket and its panels, her platform and the pillars of her hall), each drawn as it is now.
export const tileSize = 16;

const floors: Readonly<Record<string, readonly [string, string]>> = {
  ",": ["#d9b77a", "#b8935a"],
  F: ["#4a3a6a", "#3a2c56"],
  G: ["#5d5888", "#4a4670"],
  P: ["#3b2a78", "#2c1f5c"],
  R: ["#6f6a9a", "#5d5888"],
  d: ["#3a3456", "#2c2744"],
  f: ["#6f6a9a", "#5d5888"],
  n: ["#6f6a9a", "#5d5888"],
  p: ["#6f6a9a", "#5d5888"],
  t: [colour.stoneDark, colour.stoneDark],
  v: ["#4a3a6a", "#3a2c56"],
  W: [colour.stoneDark, colour.stoneDark],
  "~": ["#3a7fd8", "#5a9fe8"],
};
const grass: readonly [string, string] = [colour.grass, colour.grassDark];

export const indexAt = (list: readonly Spot[], x: number, y: number): number =>
  list.findIndex((spot) => spot.x === x && spot.y === y);

// The middle of everything made of one kind of tile (the rocket, the factory, DeFu's platform), in tiles from the map's corner.
export function middleOf(tile: string): Spot {
  const spots = baseRows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === tile ? [{ x, y }] : [])),
  );
  const across = (pick: (spot: Spot) => number): number =>
    spots.reduce((sum, spot) => sum + pick(spot), 0) /
      Math.max(1, spots.length) +
    0.5;
  return { x: across((spot) => spot.x), y: across((spot) => spot.y) };
}

const bars = (
  context: CanvasRenderingContext2D,
  fill: string,
  x: number,
  y: number,
  wide: number,
): void => {
  for (let bar = 0; bar < 4; bar += 1)
    block(context, fill, x + 1 + bar * 4, y, wide, tileSize);
};

function standing(
  context: CanvasRenderingContext2D,
  base: Base,
  tile: string,
  tx: number,
  ty: number,
  x: number,
  y: number,
): void {
  switch (tile) {
    case "T":
      block(context, colour.woodDark, x + 6, y + 10, 4, 6);
      block(context, "#1f6a38", x + 1, y + 2, 14, 10);
      block(context, colour.leaf, x + 2, y + 1, 11, 8);
      return;
    case "W":
      block(context, colour.stone, x + 1, y + 1, 14, 6);
      block(context, colour.stone, x + 1, y + 9, 6, 6);
      block(context, colour.stone, x + 9, y + 9, 6, 6);
      return;
    case "t":
      block(context, colour.fire, x + 6, y + 3, 4, 6);
      block(context, colour.fireHot, x + 7, y + 4, 2, 3);
      return;
    case "G":
      if (!base.pieces.every(Boolean)) bars(context, colour.ink, x, y, 2);
      return;
    case "X": {
      const open = base.pieces[indexAt(chests, tx, ty)] === true;
      block(context, colour.woodDark, x + 2, y + 5, 12, 9);
      block(context, open ? colour.ink : colour.wood, x + 3, y + 6, 10, 4);
      block(context, colour.gold, x + 7, y + 8, 2, 3);
      return;
    }
    case "C": {
      const freed = base.allies[indexAt(cages, tx, ty)] === true;
      if (!freed)
        sprite(context, glitchyFront, friendKey(indexAt(cages, tx, ty)), x, y);
      bars(context, freed ? colour.stone : colour.ink, x, y, 1);
      return;
    }
    case "F":
      block(
        context,
        base.broken.every(Boolean) ? colour.stone : colour.pink,
        x + 4,
        y + 4,
        8,
        8,
      );
      return;
    case "v":
      block(
        context,
        base.broken[indexAt(valves, tx, ty)] === true
          ? colour.stoneDark
          : colour.gold,
        x + 4,
        y + 4,
        8,
        8,
      );
      return;
    case "R":
      block(context, colour.white, x + 2, y, 12, 16);
      block(context, colour.berry, x + 2, y + 10, 12, 3);
      return;
    case "n":
      block(context, colour.ink, x + 3, y + 3, 10, 10);
      block(
        context,
        base.installed[indexAt(panels, tx, ty)] === true
          ? colour.mint
          : colour.berry,
        x + 6,
        y + 6,
        4,
        4,
      );
      return;
    case "p":
      block(context, colour.stoneDark, x + 2, y, 12, 16);
      block(context, colour.stone, x + 4, y + 1, 4, 14);
      return;
    default:
  }
}

// Every tile in view of the camera (its top-left corner, in pixels of the whole map).
export function drawTiles(
  context: CanvasRenderingContext2D,
  base: Base,
  camera: Spot,
  width: number,
  height: number,
): void {
  const firstX = Math.floor(camera.x / tileSize);
  const firstY = Math.floor(camera.y / tileSize);
  for (let ty = firstY; ty <= firstY + height / tileSize; ty += 1)
    for (let tx = firstX; tx <= firstX + width / tileSize; tx += 1) {
      const tile = baseTile(tx, ty);
      const x = tx * tileSize - camera.x;
      const y = ty * tileSize - camera.y;
      const [fill, shade] = floors[tile] ?? grass;
      block(context, fill, x, y, tileSize, tileSize);
      if ((tx * 7 + ty * 3) % 5 === 0)
        block(context, shade, x + 5, y + 9, 2, 2);
      standing(context, base, tile, tx, ty, x, y);
    }
}
