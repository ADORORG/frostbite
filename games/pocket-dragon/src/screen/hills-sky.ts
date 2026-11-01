import { block, sprite } from "@ador/game-sdk/pixels";

import { heroWidth, pixel, tile } from "../rules/hills/constants.ts";
import type { HillsState } from "../rules/hills/types.ts";
import { windOf } from "../rules/hills/weather.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// What is in the air of Egg Hills: the weather (wind streaks, rain, fog that hides all but what is near Glitchy), metaplasma, the
// secret charm (it shows itself only when Glitchy is close), and in a corner the charms found and the metaplasma gathered.
const px = (units: number): number => Math.round(units / pixel);
const width = 256;
const height = 144;

export const featherIcon = [
  "......ll.",
  ".....lwl.",
  "....lwl..",
  "...lwl...",
  "..lwl....",
  ".lwl.....",
  "lwl......",
  "ll.......",
  "k........",
];
export const shieldIcon = [
  ".ttttttt.",
  "ttwttttTt",
  "ttwttttTt",
  "tttttttTt",
  ".tttttTt.",
  ".ttttTTt.",
  "..tttTt..",
  "...tTt...",
  "....t....",
];
export const magnetIcon = [
  "ww.....ww",
  "rr.....rr",
  "rr.....rr",
  "rr.....rr",
  "rr.....rr",
  "rrr...rrr",
  ".rrrrrrr.",
  "..rrrrr..",
  ".........",
];
export const charmKey: Readonly<Record<string, string>> = {
  T: "#169a8e",
  k: colour.ink,
  l: colour.lavender,
  r: "#e8344e",
  t: "#2ed8c3",
  w: colour.white,
};
const icons = [featherIcon, shieldIcon, magnetIcon] as const;

export function weather(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { tick } = state;
  const kind = state.level.weather;
  if (kind === "wind") {
    const push = windOf(state);
    if (push === 0) return;
    context.globalAlpha = 0.55;
    for (let streak = 0; streak < 16; streak += 1) {
      const x = (((streak * 37 + tick * 5 * push) % width) + width) % width;
      block(context, colour.white, x, 6 + ((streak * 23) % 110), 9, 1);
    }
    context.globalAlpha = 1;
  } else if (kind === "rain") {
    context.globalAlpha = 0.6;
    for (let drop = 0; drop < 48; drop += 1) {
      const x = (drop * 53 + tick * 2) % width;
      const y = (drop * 31 + tick * 7) % height;
      block(context, "#9fd3ff", x, y, 1, 3);
      block(context, "#9fd3ff", x - 1, y + 3, 1, 2);
    }
    context.globalAlpha = 1;
  } else {
    const middle = px(state.hero.x + heroWidth / 2) - camera;
    for (let x = 0; x < width; x += 4) {
      const far = Math.abs(x + 2 - middle);
      context.globalAlpha = Math.min(0.7, Math.max(0, (far - 36) / 120));
      block(context, "#d9d4ee", x, 0, 4, height);
    }
    context.globalAlpha = 1;
  }
}

export function plasma(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { motes } = state.level;
  const { drifting, taken } = state.plasma;
  const twinkle = Math.floor(state.tick / 10);
  motes.forEach((mote, at) => {
    if (taken[at] === true) return;
    const x = px(mote.x) - camera;
    if (x < -2 || x > width + 2) return;
    const fill =
      (at + twinkle) % 3 === 0
        ? colour.white
        : at % 2 === 0
          ? colour.cyan
          : colour.pink;
    block(context, fill, x, px(mote.y), 1, 1);
  });
  for (const mote of drifting)
    block(context, colour.white, px(mote.x) - camera, px(mote.y), 2, 2);
}

export function secretCharm(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  if (state.charmTaken) return;
  const { charm } = state.level;
  const close =
    Math.abs(charm.x - state.hero.x) < 5 * tile &&
    Math.abs(charm.y - state.hero.y) < 5 * tile;
  const x = px(charm.x) - camera;
  const y = px(charm.y);
  if (close) {
    sprite(
      context,
      icons[state.stage - 1] ?? featherIcon,
      charmKey,
      x + 1,
      y + 1,
    );
    if (Math.floor(state.tick / 6) % 2 === 0)
      block(context, colour.gold, x - 1, y - 1, 1, 1);
  } else if (state.tick % 120 < 8)
    block(context, colour.white, x + 5, y + 5, 1, 1);
}

export function hillsHud(
  context: CanvasRenderingContext2D,
  state: HillsState,
): void {
  write(
    context,
    `PLASMA ${String(state.plasmaBanked + state.plasma.gathered)}`,
    4,
    13,
    7,
    colour.cyan,
    "left",
  );
  const have = [state.feather, state.shield, state.magnet];
  have.forEach((on, at) => {
    if (on)
      sprite(context, icons[at] ?? featherIcon, charmKey, 160 + at * 11, 14);
  });
}
