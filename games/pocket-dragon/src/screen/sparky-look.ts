import { block, sprite } from "@ador/game-sdk/pixels";

import type { Spot } from "../rules/grid.ts";
import { nookAhead, nooks, sparkyTicks } from "../rules/woods/sparky.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";
import { tileSize } from "./woods-base-tiles.ts";

// Sparky, the tiny glowing atom, drawn flat: a bright nucleus in two rings of electrons, hovering by Glitchy (or zipping to a nook and
// back), and a glint in every nook not yet emptied. Also its picture for the scenes, and the line under the hearts about it.
export const sparkyRows = [
  "................",
  "................",
  "....c......c....",
  ".....c....c.....",
  "......cccc......",
  "...c.cwyywc.c...",
  "....cwyyyywc....",
  "....cyywwyyc....",
  "....cyywwyyc....",
  "....cwyyyywc....",
  "...c.cwyywc.c...",
  "......cccc......",
  ".....c....c.....",
  "....c......c....",
  "................",
  "................",
] as const;
export const sparkyKey = {
  c: colour.cyan,
  w: colour.white,
  y: colour.fireHot,
} as const;

// Where Sparky is, in tiles (fractions included), at rest by Glitchy or along a trip.
export function sparkyAt(base: Base, tick: number, rest: Spot): Spot {
  const { trip } = base;
  const nook = trip === null ? undefined : nooks[trip.nook];
  if (trip === null || nook === undefined) return rest;
  const share = Math.min(1, (tick - trip.start) / sparkyTicks);
  const out = share < 0.5 ? share * 2 : 2 - share * 2;
  return {
    x: rest.x + (nook.x - rest.x) * out,
    y: rest.y + (nook.y - rest.y) * out,
  };
}

export function flatSparky(
  context: CanvasRenderingContext2D,
  base: Base,
  tick: number,
  camera: Spot,
  glitchy: Spot,
): void {
  nooks.forEach((nook, at) => {
    if (base.nooksTaken[at] === true || Math.floor(tick / 10 + at) % 3 !== 0)
      return;
    block(
      context,
      colour.fireHot,
      nook.x * tileSize - camera.x + 7,
      nook.y * tileSize - camera.y + 6,
      2,
      2,
    );
  });
  const rest = { x: glitchy.x / tileSize + 0.6, y: glitchy.y / tileSize - 0.5 };
  const at = sparkyAt(base, tick, rest);
  const bob = Math.round(Math.sin(tick / 8));
  sprite(
    context,
    sparkyRows.slice(4, 12).map((row) => row.slice(4, 12)),
    sparkyKey,
    Math.round(at.x * tileSize - camera.x),
    Math.round(at.y * tileSize - camera.y) + bob,
  );
}

export function sparkyHud(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  base: Base,
): void {
  const [text, fill] =
    base.trip !== null
      ? ["SPARKY IS OFF!", colour.cyan]
      : nookAhead(base) >= 0
        ? ["H: SPARKY CAN REACH IT!", colour.gold]
        : ["H: SPARKY", colour.lavender];
  if (state.scene === null) write(context, text, 252, 30, 7, fill, "right");
}
