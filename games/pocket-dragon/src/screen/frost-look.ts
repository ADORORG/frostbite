import { block } from "@ador/game-sdk/pixels";

import type { Spot } from "../rules/grid.ts";
import { visionCost } from "../rules/woods/constants.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { plasmaLeft, visionOn } from "../rules/woods/vision.ts";
import { futuresOf, type Outcome } from "./frost-futures.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";
import { tileSize } from "./woods-base-tiles.ts";

// Flying and frost vision on the screen, out of the maze. Under the hearts: how high Glitchy flies and the keys to go up and down, and
// whether frost vision is on (and for how long), cooling down, short of metaplasma, or ready. While it lasts the screen frosts over at
// its edges with drifting snow, and (in the flat picture) the three futures are marked on their tiles: ice for safe, gold for a find,
// red for a bump.
export const outcomeColours: Readonly<Record<Outcome, string>> = {
  find: colour.gold,
  hurt: colour.berry,
  safe: colour.ice,
};

const heights = ["", "FLYING  Q: DOWN", "SOARING  Q: DOWN"] as const;

export function frostHud(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  base: Base,
): void {
  const height = heights[base.altitude];
  write(
    context,
    height === "" ? "E: FLY UP" : height,
    252,
    12,
    7,
    height === "" ? colour.lavender : colour.mint,
    "right",
  );
  const seconds = (ticks: number) => String(Math.ceil(ticks / 60));
  const [text, fill] = visionOn(base, state.tick)
    ? [`FROST VISION ${seconds(base.visionUntil - state.tick)}`, colour.ice]
    : state.tick < base.visionReady
      ? [`VISION IN ${seconds(base.visionReady - state.tick)}`, colour.lavender]
      : plasmaLeft(state) < visionCost
        ? [`VISION: ${String(visionCost)} PLASMA`, colour.lavender]
        : ["V: FROST VISION", colour.cyan];
  write(context, text, 252, 21, 7, fill, "right");
}

export function frostTint(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  base: Base,
): void {
  if (!visionOn(base, state.tick)) return;
  context.fillStyle = "rgb(150 220 255 / 0.12)";
  context.fillRect(0, 0, 256, 144);
  context.fillStyle = "rgb(200 240 255 / 0.35)";
  for (let edge = 0; edge < 4; edge += 1) {
    context.fillRect(0, edge * 2, 256, 2 - edge * 0.4);
    context.fillRect(0, 142 - edge * 2, 256, 2 - edge * 0.4);
    context.fillRect(edge * 2, 0, 2 - edge * 0.4, 144);
    context.fillRect(254 - edge * 2, 0, 2 - edge * 0.4, 144);
  }
  for (let flake = 0; flake < 24; flake += 1) {
    const x = (flake * 53 + state.tick * (1 + (flake % 3))) % 256;
    const y = (flake * 37 + state.tick * (2 + (flake % 2))) % 144;
    block(context, colour.white, x, y, 1, 1);
  }
}

export function flatFutures(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  camera: Spot,
): void {
  for (const future of futuresOf(state)) {
    const fill = outcomeColours[future.end];
    future.path.forEach((spot, at) => {
      const x = spot.x * tileSize - camera.x;
      const y = spot.y * tileSize - camera.y;
      const last = at === future.path.length - 1;
      context.globalAlpha = last ? 0.9 : 0.45;
      block(context, fill, x + 5, y + 5, 6, 6);
      if (last) {
        block(context, fill, x + 1, y + 1, 14, 2);
        block(context, fill, x + 1, y + 13, 14, 2);
      }
    });
  }
  context.globalAlpha = 1;
}
