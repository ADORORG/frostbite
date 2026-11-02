import { block } from "@ador/game-sdk/pixels";

import type { ChapterId } from "../rules/constants.ts";
import { colour, friendColours, hillSkies } from "../screen/palette.ts";
import {
  friendKey,
  glitchyColours,
  glitchyFront,
  glitchySide,
} from "../screen/sprites.ts";
import type { Box } from "./layout.ts";
import { big, fall, sparkle } from "./paint.ts";

// The picture on a card: the chapter it tells of, in the game's own pixels at a grand size. Egg Hills is a bright sky over the hills
// with Glitchy leaping for eggs; the woods are moonlit hedges with DeFu's egg rocket; the castle is the guild before its walls, the
// banner flying and fireworks overhead once it is won. Everything is drawn on a grid 96 cells wide, so it looks the same at every size.
const cells = 96;
const eggRows = [
  "..kk..",
  ".kwwk.",
  "kwwwwk",
  "kwpwgk",
  "kwwwwk",
  "kwwwwk",
  ".kwwk.",
  "..kk..",
] as const;
const moonRows = [
  "..mmm..",
  ".mmc...",
  "mmc....",
  "mmc....",
  "mmc....",
  ".mmc...",
  "..mmm..",
] as const;
const moonKey = { c: colour.creamDark, m: colour.cream };
const eggKey = {
  g: colour.cyan,
  k: colour.ink,
  p: colour.pink,
  w: colour.belly,
};

interface Grid {
  readonly box: Box;
  readonly rows: number;
  readonly unit: number;
  // A block `w` by `h` cells at cell (x, y).
  readonly cell: (
    fill: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
}

function gridOf(context: CanvasRenderingContext2D, box: Box): Grid {
  const unit = box.width / cells;
  return {
    box,
    cell: (fill, x, y, w, h) =>
      block(
        context,
        fill,
        box.x + x * unit,
        box.y + y * unit,
        Math.ceil(w * unit),
        Math.ceil(h * unit),
      ),
    rows: Math.floor(box.height / unit),
    unit,
  };
}

function hills(context: CanvasRenderingContext2D, grid: Grid): void {
  const [high, low, far] = hillSkies[0] ?? ["#6ec6ff", "#c9f1ff", "#8ed88a"];
  context.fillStyle = fall(context, grid.box, high, low);
  context.fillRect(grid.box.x, grid.box.y, grid.box.width, grid.box.height);
  const ground = grid.rows - 12;
  grid.cell(colour.cream, 76, 6, 10, 10);
  for (const [x, y] of [
    [4, 5],
    [18, 15],
    [72, 24],
  ] as const) {
    grid.cell(colour.white, x, y, 12, 3);
    grid.cell(colour.white, x + 3, y - 2, 6, 2);
  }
  for (let x = 0; x < cells; x += 2) {
    const rise = Math.round(4 + 3 * Math.sin((x + 3) / 9));
    grid.cell(far, x, ground - rise, 2, rise);
  }
  grid.cell(colour.grass, 0, ground, cells, 2);
  grid.cell(colour.dirt, 0, ground + 2, cells, grid.rows - ground - 2);
  for (let x = 4; x < cells; x += 9)
    grid.cell(colour.dirtDark, x, ground + 5, 2, 2);
  const egg = Math.max(1, Math.round(grid.unit * 1.5));
  for (const x of [8, 22, 66, 82])
    big(
      context,
      eggRows,
      eggKey,
      grid.box.x + x * grid.unit,
      grid.box.y + (ground - 9) * grid.unit,
      egg,
    );
  const scale = Math.floor((grid.box.height * 0.42) / 16);
  big(
    context,
    glitchySide.jump,
    glitchyColours,
    grid.box.x + 34 * grid.unit,
    grid.box.y + 6 * grid.unit,
    scale,
  );
  // A puff of fire in front of the mouth.
  const mouth = 34 + (16 * scale) / grid.unit;
  grid.cell(colour.berry, mouth + 5, 13, 4, 6);
  grid.cell(colour.fire, mouth, 12, 7, 8);
  grid.cell(colour.fireHot, mouth + 1, 14, 4, 4);
  for (const [x, y] of [
    [9, 11],
    [10, 18],
    [12, 14],
  ] as const)
    grid.cell(colour.fire, mouth + x, y, 1.5, 1.5);
}

function woods(context: CanvasRenderingContext2D, grid: Grid): void {
  context.fillStyle = fall(context, grid.box, "#0b0626", "#3b1c6a");
  context.fillRect(grid.box.x, grid.box.y, grid.box.width, grid.box.height);
  for (let star = 0; star < 30; star += 1)
    grid.cell(
      star % 4 === 0 ? colour.cyan : colour.white,
      (star * 37) % cells,
      (star * 13) % 24,
      1,
      1,
    );
  big(
    context,
    moonRows,
    moonKey,
    grid.box.x + 66 * grid.unit,
    grid.box.y + 3 * grid.unit,
    Math.max(1, Math.round(grid.unit * 1.4)),
  );
  const ground = grid.rows - 14;
  grid.cell("#14301f", 0, ground, cells, grid.rows - ground);
  for (let row = 0; row < grid.rows; row += 4) {
    const reach = Math.max(4, 26 - Math.floor(row / 3));
    grid.cell("#1f5c3a", 0, row, reach, 4);
    grid.cell("#1f5c3a", cells - reach, row, reach, 4);
    grid.cell("#2d7a4a", reach - 3, row + 1, 3, 2);
    grid.cell("#2d7a4a", cells - reach, row + 1, 3, 2);
  }
  for (let x = 30; x < 66; x += 6) grid.cell("#2f6b3a", x, ground + 4, 3, 1);
  // DeFu's egg rocket, waiting on its pad.
  grid.cell(colour.stoneDark, 10, ground + 1, 14, 2);
  grid.cell(colour.white, 14, ground - 12, 6, 13);
  grid.cell(colour.berry, 15, ground - 15, 4, 3);
  grid.cell(colour.berry, 12, ground - 4, 2, 5);
  grid.cell(colour.berry, 20, ground - 4, 2, 5);
  grid.cell(colour.berry, 14, ground - 6, 6, 1);
  grid.cell(colour.cyan, 16, ground - 10, 2, 2);
  const scale = Math.floor((grid.box.height * 0.48) / 16);
  big(
    context,
    glitchyFront,
    glitchyColours,
    grid.box.x + grid.box.width / 2 - 8 * scale,
    grid.box.y + grid.box.height - 17 * scale,
    scale,
  );
  for (let mote = 0; mote < 18; mote += 1)
    grid.cell(
      mote % 2 === 0 ? colour.pink : colour.cyan,
      30 + ((mote * 23) % 40),
      20 + ((mote * 11) % 20),
      1,
      1,
    );
}

function castle(
  context: CanvasRenderingContext2D,
  grid: Grid,
  won: boolean,
): void {
  context.fillStyle = fall(context, grid.box, "#2a1a5e", "#ff9e7a");
  context.fillRect(grid.box.x, grid.box.y, grid.box.width, grid.box.height);
  const ground = grid.rows - 12;
  const wall = ground - 22;
  grid.cell(colour.stoneDark, 18, wall, 60, 22);
  for (const x of [14, 40, 70]) {
    grid.cell(colour.stone, x, wall - 10, 12, 32);
    for (let tooth = 0; tooth < 12; tooth += 4)
      grid.cell(colour.stone, x + tooth, wall - 13, 2, 3);
  }
  for (let tooth = 18; tooth < 78; tooth += 5)
    grid.cell(colour.stoneDark, tooth, wall - 3, 3, 3);
  grid.cell(colour.ink, 44, ground - 9, 4, 9);
  grid.cell(colour.woodDark, 46, wall - 26, 1, 16);
  grid.cell(won ? colour.gold : colour.stone, 47, wall - 26, 9, 5);
  grid.cell(won ? colour.pink : colour.stoneDark, 49, wall - 25, 4, 3);
  grid.cell(colour.grassDark, 0, ground, cells, grid.rows - ground);
  grid.cell(colour.grass, 0, ground, cells, 2);
  if (won)
    for (const [x, y, fill] of [
      [16, 6, colour.pink],
      [80, 10, colour.gold],
      [30, 14, colour.cyan],
      [62, 4, colour.mint],
    ] as const)
      sparkle(
        context,
        grid.box.x + x * grid.unit,
        grid.box.y + y * grid.unit,
        grid.unit * 7,
        fill,
      );
  const small = Math.max(1, Math.floor((grid.box.height * 0.2) / 16));
  friendColours.forEach((_, friend) =>
    big(
      context,
      glitchyFront,
      friendKey(friend),
      grid.box.x + (3 + friend * 11 + (friend > 1 ? 46 : 0)) * grid.unit,
      grid.box.y + grid.box.height - 17 * small,
      small,
    ),
  );
  const scale = Math.floor((grid.box.height * 0.42) / 16);
  big(
    context,
    glitchyFront,
    glitchyColours,
    grid.box.x + grid.box.width / 2 - 8 * scale,
    grid.box.y + grid.box.height - 17 * scale,
    scale,
  );
}

export function drawArt(
  context: CanvasRenderingContext2D,
  box: Box,
  chapter: ChapterId,
  won: boolean,
): void {
  const grid = gridOf(context, box);
  if (chapter === "hills") hills(context, grid);
  else if (chapter === "woods") woods(context, grid);
  else castle(context, grid, won);
}
