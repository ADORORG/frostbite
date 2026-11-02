import { block } from "@ador/game-sdk/pixels";

import { blastStepTicks, type Item, type TileBlast } from "../rules/kit.ts";
import { colour } from "./palette.ts";

// The backpack's foods as pictures: a small icon for the backpack on the screen, a picture of each lying in a level, and the same in the
// maze's sixteen-by-sixteen key (`woods-look.ts`). A berry is red, a mushroom is the glitchy pink one with cyan spots, a pineapple is
// gold with a green crown. A glitch blast is drawn as a ball of flickering pixels with its colours split, like a glitch.
export const kitKey: Readonly<Record<string, string>> = {
  G: colour.grassDark,
  R: colour.berryDark,
  Y: colour.goldDark,
  c: colour.cyan,
  g: colour.grass,
  k: colour.ink,
  p: colour.pink,
  r: colour.berry,
  w: colour.white,
  y: colour.gold,
};

export const kitIcons: Readonly<Record<Item, readonly string[]>> = {
  berry: [
    "...gg..",
    "..g....",
    ".rr.rr.",
    "rwrrwrr",
    "rrrrrrR",
    ".rrrrR.",
    "..rRR..",
  ],
  mushroom: [
    "..ppp..",
    ".pcppp.",
    "ppppcpp",
    "pcppppp",
    "..www..",
    "..wkw..",
    "..www..",
  ],
  pineapple: [
    "g.g.g..",
    ".ggg...",
    ".yYyY..",
    ".YyYy..",
    ".yYyY..",
    ".YyYy..",
    "..yY...",
  ],
};

export const kitPictures: Readonly<Record<Item, readonly string[]>> = {
  berry: [
    "....kgk...",
    "...kggk...",
    "..kkkkkk..",
    ".krrwrrrk.",
    "krrwrrrrrk",
    "krrrrrrrRk",
    "krrrrrrRRk",
    ".krrrrRRk.",
    "..kkkkkk..",
  ],
  mushroom: [
    "...kkkk...",
    "..kppppk..",
    ".kpcpppck.",
    "kppppcpppk",
    "kpcppppppk",
    ".kkkkkkkk.",
    "...kwwk...",
    "...kwwk...",
    "...kkkk...",
  ],
  pineapple: [
    "...g..g...",
    "....gg....",
    "...gggg...",
    "...kkkk...",
    "..kyYyYk..",
    "..kYyYyk..",
    "..kyYyYk..",
    "..kYyYyk..",
    "...kkkk...",
  ],
};

// In the maze's key: `r` red, `p` pink, `c` cyan, `w` white, `g` gold, `h` pale gold, `m` mint for leaves, `k` ink.
export const kitThings: Readonly<Record<Item, readonly string[]>> = {
  berry: [
    "................",
    "................",
    "................",
    "................",
    "........m.......",
    ".......mm.......",
    ".....kkkkk......",
    "....krrwrrk.....",
    "...krwrrrrrk....",
    "...krrrrrrrk....",
    "...krrrrrrrk....",
    "....krrrrrk.....",
    ".....kkkkk......",
    "................",
    "................",
    "................",
  ],
  mushroom: [
    "................",
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....kppcpppk....",
    "...kppppppcpk...",
    "...kpcppppppk...",
    "...kkkkkkkkkk...",
    "......kwwk......",
    "......kwwk......",
    "......kwwk......",
    "......kkkk......",
    "................",
    "................",
    "................",
  ],
  pineapple: [
    "................",
    "................",
    "......m..m......",
    ".......mm.......",
    "......mmmm......",
    "......kkkk......",
    ".....kghghk.....",
    ".....khghgk.....",
    ".....kghghk.....",
    ".....khghgk.....",
    ".....kghghk.....",
    "......kkkk......",
    "................",
    "................",
    "................",
    "................",
  ],
};

// A picture drawn `scale` pixels to each of its pixels: Glitchy grown big by a pineapple is drawn twice the size.
export function spriteScaled(
  context: CanvasRenderingContext2D,
  rows: readonly string[],
  key: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale: number,
): void {
  rows.forEach((row, line) => {
    [...row].forEach((cell, column) => {
      const fill = key[cell];
      if (fill !== undefined)
        block(
          context,
          fill,
          x + column * scale,
          y + line * scale,
          scale,
          scale,
        );
    });
  });
}

const glitchColours = [
  colour.pink,
  colour.cyan,
  colour.white,
  colour.lavender,
] as const;

// A glitch blast `size` pixels across with its top left at (x, y), rolling the way `way` says (-1 or 1), flickering with the tick: an
// echo in cyan behind it, an echo in pink ahead, then the ball of pixels, and a few specks of glitch falling off behind.
export function glitchBall(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tick: number,
  way: number,
): void {
  const half = size / 2;
  const middleX = Math.round(x + half);
  const middleY = Math.round(y + half);
  const disc = (dx: number, fill: (px: number, py: number) => string) => {
    for (let py = -half; py < half; py += 1)
      for (let px = -half; px < half; px += 1)
        if (px * px + py * py < half * half)
          block(context, fill(px, py), middleX + px + dx, middleY + py, 1, 1);
  };
  context.globalAlpha = 0.55;
  disc(-way * 2, () => colour.cyan);
  disc(way, () => colour.pink);
  context.globalAlpha = 1;
  disc(0, (px, py) => {
    const at = Math.abs(px * 7 + py * 13 + Math.floor(tick / 3) * 5) % 4;
    return glitchColours[at] ?? colour.white;
  });
  for (let speck = 1; speck <= 3; speck += 1)
    block(
      context,
      glitchColours[(speck + Math.floor(tick / 4)) % 4] ?? colour.pink,
      middleX - way * (half + speck * 3),
      middleY + ((speck * 5 + tick) % 7) - 3,
      1,
      1,
    );
}

// Where a blast rolling over tiles is drawn, in tiles: part way from the tile it left to the tile it is on.
export function rollingAt(
  blast: TileBlast,
  tick: number,
): { readonly x: number; readonly y: number } {
  const left = 1 - Math.min(1, (tick - blast.moved) / blastStepTicks);
  return { x: blast.x - blast.dx * left, y: blast.y - blast.dy * left };
}
