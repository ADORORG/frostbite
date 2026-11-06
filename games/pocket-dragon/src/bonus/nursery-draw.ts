import { block, sprite } from "@frostbite/game-sdk/pixels";

import { byInput } from "../page/input.ts";
import { egg } from "../screen/hills-things.ts";
import { spriteScaled } from "../screen/kit-sprites.ts";
import { colour, friendColours } from "../screen/palette.ts";
import {
  glitchyColours,
  glitchyFront,
  glitchySide,
  keyFor,
} from "../screen/sprites.ts";
import { write } from "../screen/text.ts";
import {
  dancing,
  door,
  followGap,
  mostDragons,
  nest,
  type NurseryState,
  type Spot,
} from "./nursery.ts";

// The Sky Nursery on the screen (256 by 144): a starry night with an aurora, the strokes of paint, the cloud nest at the bottom and the
// rainbow door out on the right, the floating eggs, the baby dragons flying after Glitchy (dancing when Glitchy dances), and the counts,
// the colour of the paint and what each key does.
export const lookColours: readonly (readonly [string, string])[] = [
  ...friendColours,
  ["#ff7ad9", "#c43fa0"],
  ["#7ae0ff", "#2f9ac4"],
  ["#c9a0ff", "#7d55d9"],
  ["#f4f4ff", "#b0b0d0"],
];
export const inkColours = [
  colour.berry,
  colour.fire,
  colour.gold,
  colour.mint,
  colour.cyan,
  colour.lavender,
  colour.pink,
] as const;

export const dragonKey = (look: number): Readonly<Record<string, string>> => {
  const [body, shade] = lookColours[look % lookColours.length] ?? [
    colour.mint,
    colour.mintDark,
  ];
  return keyFor(body, shade);
};

export function sky(
  context: CanvasRenderingContext2D,
  tick: number,
  width = 256,
  height = 144,
): void {
  const fill = context.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, "#160b3c");
  fill.addColorStop(0.6, "#33196a");
  fill.addColorStop(1, "#5d2f86");
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);
  for (let star = 0; star < 60; star += 1) {
    const twinkle = (star * 7 + Math.floor(tick / 12)) % 9 === 0;
    block(
      context,
      twinkle ? colour.white : colour.lavender,
      (star * 97) % width,
      (star * 53) % Math.round(height * 0.8),
      1,
      1,
    );
  }
  for (let x = 0; x < width; x += 2) {
    const wave = Math.round(Math.sin((x + tick) / 23) * 6);
    context.globalAlpha = 0.18;
    block(context, x % 4 === 0 ? colour.mint : colour.cyan, x, 30 + wave, 2, 8);
    context.globalAlpha = 1;
  }
}

export function paintDots(
  context: CanvasRenderingContext2D,
  state: NurseryState,
  size = 2,
  scale = 1,
  left = 0,
  top = 0,
): void {
  for (const dot of state.paint)
    block(
      context,
      inkColours[dot.ink] ?? colour.white,
      left + dot.x * scale - size / 2,
      top + dot.y * scale - size / 2,
      size,
      size,
    );
}

function nestAndDoor(context: CanvasRenderingContext2D): void {
  block(context, colour.cloud, nest.x - 34, nest.y + 4, 68, 10);
  block(context, colour.white, nest.x - 26, nest.y + 1, 52, 6);
  block(context, colour.woodDark, nest.x - 14, nest.y - 2, 28, 6);
  block(context, colour.wood, nest.x - 12, nest.y - 3, 24, 3);
  inkColours.forEach((fill, band) =>
    block(context, fill, door.left + band, door.top - band, 2, 40 + band * 2),
  );
  write(context, "OUT", 242, door.top - 12, 6, colour.white, "right");
}

// Where the dragon `at` (0 the first hatched) flies: along Glitchy's trail, or in the nest before there is trail enough.
export const dragonSpot = (state: NurseryState, at: number): Spot =>
  state.trail[(at + 1) * followGap - 1] ?? {
    x: nest.x - 20 + (at % 6) * 8,
    y: nest.y - 10 - Math.floor(at / 6) * 6,
  };

function hop(state: NurseryState, at: number): number {
  if (!dancing(state)) return Math.round(Math.sin(state.tick / 9 + at) * 1.5);
  const beat = (state.tick - state.danceStart + at * 4) / 6;
  return state.dance === 2
    ? -Math.abs(Math.round(Math.sin(beat) * 8))
    : Math.round(Math.sin(beat) * 4);
}

export function drawNursery(
  context: CanvasRenderingContext2D,
  state: NurseryState,
): void {
  sky(context, state.tick);
  paintDots(context, state);
  nestAndDoor(context);
  state.eggs.forEach((one, at) =>
    egg(
      context,
      one.x - 4,
      one.y - 4 + Math.round(Math.sin(state.tick / 10 + at) * 2),
      one.look,
    ),
  );
  const spun = dancing(state) && state.dance === 1;
  state.dragons.forEach((dragon, at) => {
    const spot = dragonSpot(state, at);
    const rows =
      spun && Math.floor((state.tick + at * 3) / 8) % 2 === 0
        ? glitchyFront.map((row) => [...row].reverse().join(""))
        : glitchyFront;
    sprite(
      context,
      rows,
      dragonKey(dragon.look),
      spot.x - 8,
      spot.y - 8 + hop(state, at),
    );
  });
  const flip = spun ? Math.floor(state.tick / 8) % 2 === 0 : state.facing < 0;
  const side = glitchySide.stand.map((row) =>
    flip ? [...row].reverse().join("") : row,
  );
  spriteScaled(
    context,
    side,
    glitchyColours,
    state.x - 8,
    state.y - 8 + hop(state, -1),
    1,
  );
  if (dancing(state))
    for (let note = 0; note < 4; note += 1) {
      const rise = (state.tick * 0.5 + note * 11) % 40;
      block(
        context,
        inkColours[note] ?? colour.gold,
        state.x - 12 + note * 8,
        state.y - 14 - rise,
        2,
        3,
      );
    }
  nurseryWords(context, state);
}

function nurseryWords(
  context: CanvasRenderingContext2D,
  state: NurseryState,
): void {
  write(
    context,
    `EGGS ${String(state.carried)}  DRAGONS ${String(state.dragons.length)}/${String(mostDragons)}`,
    4,
    4,
    7,
    colour.cyan,
    "left",
  );
  write(context, "INK", 236, 4, 7, colour.white, "right");
  block(context, inkColours[state.ink] ?? colour.white, 239, 4, 12, 7);
  const newest = state.dragons[state.dragons.length - 1];
  const words =
    newest !== undefined && state.tick - state.hatchTick < 90
      ? `${newest.name} HATCHED!`
      : state.tick < 240
        ? "WELCOME TO THE SECRET SKY NURSERY!"
        : state.carried > 0 && state.dragons.length < mostDragons
          ? "BRING THE EGGS TO THE NEST TO HATCH THEM"
          : "";
  if (words !== "") write(context, words, 128, 22, 8, colour.gold);
  context.fillStyle = "rgb(12 6 32 / 0.6)";
  context.fillRect(0, 133, 256, 11);
  write(
    context,
    byInput(
      "SPACE DANCE  F PAINT  Q/E INK  C CLEAR  RAINBOW: OUT",
      "RIGHT THUMB: DANCE, PAINT   INK, CLEAR   RAINBOW: OUT",
    ),
    128,
    135,
    6,
    colour.white,
  );
}
