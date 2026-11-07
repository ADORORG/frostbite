import { block, sprite } from "@frostbite/game-sdk/pixels";

import {
  forceTicks,
  heroHeight,
  heroWidth,
  pixel,
  tile,
  ventEvery,
  ventHeight,
  ventOn,
  wingTicks,
} from "../rules/hills/constants.ts";
import {
  rollerX,
  sectionOf,
  ventOnAt,
  type Section,
} from "../rules/hills/secrets.ts";
import type { HillsState, Spot } from "../rules/hills/types.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// The secret areas of Egg Hills and what is new on a stage: their backdrops (a cave of glowing crystals, a high bright sky), springs,
// steam vents, rolling boulders, the wings and the forcefield (floating to be taken, and on Glitchy once taken), the burrow and the swirl
// cloud (each showing itself only up close), and the ways back out.
const width = 256;
const height = 144;
const px = (units: number): number => Math.round(units / pixel);
const near = (state: HillsState, spot: Spot, tiles: number): boolean =>
  Math.abs(state.hero.x - spot.x) < tiles * tile;

export const sectionNames: Readonly<Record<Section, string>> = {
  main: "",
  sky: "SKY ISLANDS",
  tunnel: "SECRET TUNNEL",
};

export function secretBackdrop(
  context: CanvasRenderingContext2D,
  section: Section,
  camera: number,
  tick: number,
): void {
  const cave = section === "tunnel";
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, cave ? "#1b0f33" : "#7fd2ff");
  sky.addColorStop(1, cave ? "#3b2266" : "#f2fbff");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  for (let at = 0; at < 9; at += 1) {
    const x = ((((at * 53 - camera * 0.3) % 300) + 300) % 300) - 20;
    if (cave) {
      const glow = (Math.floor(tick / 20) + at) % 3 === 0;
      block(
        context,
        glow ? colour.cyan : colour.lavender,
        x,
        60 + (at % 3) * 18,
        3,
        7,
      );
      block(context, colour.lavenderDark, x - 2, 64 + (at % 3) * 18, 2, 4);
    } else {
      block(context, colour.white, x, 20 + (at % 4) * 26, 26, 6);
      block(context, colour.white, x + 6, 16 + (at % 4) * 26, 13, 4);
    }
  }
  if (!cave) block(context, "#fff6b0", 28, 14, 16, 16);
}

// A tile of a secret area: the cave's rock and floor, or a cloud.
export function secretTile(
  context: CanvasRenderingContext2D,
  section: Section,
  x: number,
  y: number,
  top: boolean,
): void {
  const size = tile / pixel;
  if (section === "sky") {
    block(context, "#d6ecff", x, y + 2, size, size - 4);
    block(context, colour.white, x + 1, y, size - 2, size - 6);
    return;
  }
  block(context, colour.stoneDark, x, y, size, size);
  block(
    context,
    top ? "#6b5a8f" : colour.stone,
    x + 1,
    y + 1,
    size - 2,
    size - 2,
  );
  block(context, colour.stoneDark, x + 5, y + 6, 3, 2);
}

const springRows = [
  ".rrrwrrrrwr.",
  "rrwrrrrrrrrr",
  "rrrrrrwrrrrr",
  ".....cc.....",
  "....cccc....",
  "....cccc....",
];
const springKey = { c: colour.cream, r: colour.berry, w: colour.white };
const boulderRows = [
  "....kkkkk.....",
  "..kksssssk....",
  ".ksssswsssk...",
  ".kssswwssssk..",
  "kssssssssssk..",
  "ksssskssssssk.",
  "kssssskkssssk.",
  "ksssssssksssk.",
  "kssssssssssk..",
  ".ksssssssssk..",
  ".kksssssskk...",
  "...kkkkkk.....",
];
const boulderKey = { k: colour.stoneDark, s: colour.stone, w: colour.white };
const wingRows = [
  "ww.....ww",
  "www...www",
  ".wwwkwww.",
  "..wwwww..",
  "...w.w...",
];
const wingKey = { k: colour.ink, w: colour.white };

function bubble(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  tick: number,
): void {
  for (let dot = 0; dot < 24; dot += 1) {
    const angle = (dot / 24) * Math.PI * 2 + tick / 30;
    block(
      context,
      dot % 3 === 0 ? colour.white : colour.cyan,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      1,
      1,
    );
  }
}

function swirl(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
): void {
  for (let dot = 0; dot < 20; dot += 1) {
    const angle = dot * 0.6 + tick / 12;
    const radius = 1 + dot * 0.4;
    block(
      context,
      dot % 2 === 0 ? colour.lavender : colour.white,
      x + 8 + Math.cos(angle) * radius,
      y + 8 + Math.sin(angle) * radius,
      2,
      2,
    );
  }
}

// What a stage holds that is new, and the doors of its secret areas.
export function secretThings(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { level, tick } = state;
  const at = (spot: Spot): readonly [number, number] => [
    px(spot.x) - camera,
    px(spot.y),
  ];
  for (const spring of level.springs) {
    const [x, y] = at(spring);
    sprite(context, springRows, springKey, x, y);
  }
  for (const vent of level.vents) {
    const [x, y] = at(vent);
    block(context, colour.stoneDark, x - 1, y - 2, 12, 2);
    const phase = (tick + vent.phase) % ventEvery;
    const rising = ventOnAt(vent, tick)
      ? px(ventHeight)
      : phase > ventEvery - 20
        ? 6
        : 0;
    for (let puff = 0; puff < rising; puff += 4)
      block(
        context,
        puff % 8 === 0 ? colour.white : colour.cloud,
        x + ((puff + tick) % 3) - 1,
        y - 4 - puff,
        10,
        4,
      );
    if (phase >= ventOn && phase <= ventEvery - 20)
      block(context, colour.cloudDark, x + 3, y - 4, 4, 2);
  }
  for (const [gone, roller] of level.rollers.entries()) {
    if (state.rollersGone[gone] === true) continue;
    const x = px(rollerX(roller, tick)) - camera;
    const rows =
      Math.floor(x / 4) % 2 === 0
        ? boulderRows
        : boulderRows.map((row) => [...row].reverse().join(""));
    sprite(context, rows, boulderKey, x, px(roller.y) + 2);
  }
  const bob = Math.floor(tick / 15) % 2;
  if (!state.wingsTaken) {
    const [x, y] = at(level.wings);
    sprite(context, wingRows, wingKey, x + 1, y + 3 + bob);
  }
  if (!state.forceTaken) {
    const [x, y] = at(level.forcefield);
    bubble(context, x + 6, y + 6 + bob, 6, tick);
  }
  if (near(state, level.burrow, 4)) {
    const [x, y] = at(level.burrow);
    block(context, colour.ink, x + 3, y - 1, 10, 3);
    block(context, colour.dirt, x + 12, y - 3, 4, 3);
    if (near(state, level.burrow, 1) && state.hero.grounded)
      write(context, "DOWN", x + 8, y - 26 - bob, 7, colour.gold);
  }
  const [gx, gy] = at(level.cloudGate);
  context.globalAlpha = near(state, level.cloudGate, 6) ? 1 : 0.25;
  swirl(context, gx, gy, tick);
  context.globalAlpha = 1;
  const [tx, ty] = at(level.tunnelEnd);
  for (let rung = 0; rung < 5; rung += 1)
    block(context, colour.wood, tx + 3, ty + 12 - rung * 8, 10, 2);
  block(context, colour.woodDark, tx + 2, ty - 26, 2, 42);
  block(context, colour.woodDark, tx + 12, ty - 26, 2, 42);
  const [sx, sy] = at(level.skyEnd);
  [colour.berry, colour.fire, colour.gold, colour.mint, colour.cyan].forEach(
    (fill, band) =>
      block(context, fill, sx - 4 + band * 2, sy + band * 2, 24 - band * 4, 2),
  );
}

// Glitchy's wings and forcefield, blinking in their last two seconds; and the name of the secret area Glitchy is in.
export function heroGear(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { hero, tick } = state;
  const x = px(hero.x) - camera;
  const y = px(hero.y);
  const fading = (left: number) => left < 120 && Math.floor(tick / 6) % 2 === 0;
  if (state.wings > 0 && !fading(state.wings)) {
    const up = Math.floor(tick / 4) % 2 === 0 || hero.grounded;
    sprite(
      context,
      up ? wingRows : wingRows.slice().reverse(),
      wingKey,
      x + (hero.facing > 0 ? -5 : 8),
      y - 2,
    );
  }
  if (state.forcefield > 0 && !fading(state.forcefield))
    bubble(context, x + px(heroWidth) / 2, y + px(heroHeight) / 2, 11, tick);
  const name = sectionNames[sectionOf(hero.x)];
  if (name !== "") write(context, name, width / 2, 14, 8, colour.gold);
}

// How long the wings and the forcefield have left, as bars under the metaplasma.
export function powerBars(
  context: CanvasRenderingContext2D,
  state: HillsState,
): void {
  const bars: readonly (readonly [number, number, string])[] = [
    [state.wings, wingTicks, colour.white],
    [state.forcefield, forceTicks, colour.cyan],
  ];
  let y = 23;
  for (const [left, most, fill] of bars) {
    if (left <= 0) continue;
    block(context, colour.ink, 4, y, 42, 4);
    block(context, fill, 5, y + 1, Math.ceil((40 * left) / most), 2);
    y += 6;
  }
}
