import { block, sprite } from "@frostbite/game-sdk/pixels";

import { colour } from "./palette.ts";

// The little things of Egg Hills, each drawn at a place on the screen in pixels: eggs, the golden egg, the fire berry, a thorn bush,
// a gloomling (and the rainbow puff it becomes), a puff of fire, the nest halfway and the portal at the end.
const speckles = [
  colour.mint,
  colour.pink,
  colour.lavender,
  colour.cyan,
] as const;
const eggRows = [
  "..ww....",
  ".wwww...",
  "wwswww..",
  "wwwwsw..",
  "wswwww..",
  "wwwwww..",
  ".wwww...",
  "..ww....",
].map((row) => row.slice(0, 6));

export function egg(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  at: number,
): void {
  sprite(
    context,
    eggRows,
    { s: speckles[at % speckles.length] ?? colour.mint, w: colour.belly },
    x + 1,
    y,
  );
  block(context, colour.ink, x + 1, y + 8, 6, 1);
}

export function goldenEgg(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
): void {
  sprite(context, eggRows, { s: colour.white, w: colour.gold }, x + 1, y);
  if (Math.floor(tick / 10) % 3 === 0)
    block(context, colour.white, x - 1, y - 2, 1, 1);
  if (Math.floor(tick / 10) % 3 === 1)
    block(context, colour.white, x + 8, y + 1, 1, 1);
  block(context, colour.goldDark, x + 1, y + 8, 6, 1);
}

export function berry(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
): void {
  const glow = Math.floor(tick / 8) % 2 === 0;
  if (glow) block(context, "rgb(255 154 46 / 0.35)", x - 2, y - 2, 14, 14);
  sprite(
    context,
    [
      "....ll....",
      "...ll.....",
      "..rrrrr...",
      ".rrhrrrr..",
      ".rhrrrrr..",
      ".rrrrrrd..",
      "..rrrrd...",
      "...ddd....",
    ],
    { d: colour.berryDark, h: colour.fireHot, l: colour.leaf, r: colour.berry },
    x,
    y + 1,
  );
}

export function thorn(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  sprite(
    context,
    [
      "..p...p...p.",
      ".gpg.gpg.gpg",
      "gggggggggggg",
      "gdgggpggdggg",
      "gggdgggggpdg",
      ".ggggdgggg..",
      "..dddddddd..",
      "...d....d...",
      "............",
    ],
    { d: colour.grassDark, g: colour.leaf, p: colour.lavender },
    x,
    y,
  );
}

export function gloomling(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
  at: number,
): void {
  const bob = Math.floor((tick + at * 9) / 12) % 2;
  sprite(
    context,
    [
      "....cccccc....",
      "..cccccccccc..",
      ".cckkccccckkcc.",
      "cccckcccckcccc",
      "ccceeccccceecc",
      "cccccckkcccccc",
      ".cccckcckccccc.",
      "..cccccccccc..",
    ],
    { c: colour.cloud, e: colour.eye, k: colour.cloudDark },
    x,
    y + bob,
  );
  const drop = Math.floor(tick / 6 + at) % 4;
  block(context, colour.iceDark, x + 3, y + 8 + drop, 1, 2);
  block(context, colour.iceDark, x + 9, y + 9 + ((drop + 2) % 4), 1, 2);
}

const rainbow = [
  colour.berry,
  colour.fire,
  colour.gold,
  colour.grass,
  colour.cyan,
  colour.lavender,
] as const;

export function cheerPuff(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
): void {
  const rise = Math.floor(age / 3);
  rainbow.forEach((fill, band) =>
    block(context, fill, x + band, y - rise + band, 14 - band * 2, 1),
  );
  if (age % 8 < 4) block(context, colour.white, x + 6, y - rise - 3, 2, 2);
}

export function fireball(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
): void {
  block(context, colour.fire, x, y + 1, 8, 4);
  block(context, colour.fireHot, x + 2, y + 2, 4, 2);
  block(context, colour.berry, x + (tick % 2 === 0 ? 0 : 7), y, 1, 6);
}

export function nest(
  context: CanvasRenderingContext2D,
  x: number,
  ground: number,
  passed: boolean,
): void {
  block(context, colour.woodDark, x, ground - 26, 2, 26);
  block(context, passed ? colour.pink : colour.stone, x + 2, ground - 26, 9, 6);
  block(context, colour.wood, x - 4, ground - 4, 10, 4);
  block(context, colour.woodDark, x - 4, ground - 1, 10, 1);
}

export function portal(
  context: CanvasRenderingContext2D,
  x: number,
  ground: number,
  tick: number,
): void {
  const spin = Math.floor(tick / 5) % 4;
  const rings = [
    colour.pink,
    colour.lavender,
    colour.cyan,
    colour.mint,
  ] as const;
  for (let ring = 0; ring < 4; ring += 1) {
    const size = 22 - ring * 5;
    block(
      context,
      rings[(ring + spin) % 4] ?? colour.cyan,
      x - size / 2,
      ground - 12 - size / 2 - 6,
      size,
      size,
    );
  }
  block(context, colour.wood, x - 14, ground - 5, 28, 5);
  block(context, colour.woodDark, x - 14, ground - 1, 28, 1);
}

export function iceBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  block(context, colour.iceDark, x, y, 16, 16);
  block(context, colour.ice, x + 1, y + 1, 14, 14);
  block(context, colour.white, x + 3, y + 3, 5, 1);
  block(context, colour.white, x + 3, y + 4, 1, 4);
  block(context, colour.iceDark, x + 10, y + 9, 3, 1);
}
