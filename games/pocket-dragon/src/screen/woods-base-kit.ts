import { sprite } from "@ador/game-sdk/pixels";

import type { Spot } from "../rules/grid.ts";
import { baseKit } from "../rules/woods/base-map.ts";
import type { Base } from "../rules/woods/types.ts";
import { glitchBall, kitKey, kitPictures, rollingAt } from "./kit-sprites.ts";
import { tileSize } from "./woods-base-tiles.ts";

// The backpack's share of the woods seen flat from above: the foods lying on their tiles (bobbing, until picked up), and a glitch blast
// rolling from tile to tile, drawn part way along its roll.
export function baseKitLook(
  context: CanvasRenderingContext2D,
  base: Base,
  tick: number,
  camera: Spot,
): void {
  const bob = Math.floor(tick / 15) % 2;
  baseKit.forEach((spot, at) => {
    if (base.kitTaken[at] !== true)
      sprite(
        context,
        kitPictures[spot.item],
        kitKey,
        spot.x * tileSize - camera.x + 3,
        spot.y * tileSize - camera.y + 3 + bob,
      );
  });
  const { blast } = base;
  if (blast === null) return;
  const rolling = rollingAt(blast, tick);
  glitchBall(
    context,
    rolling.x * tileSize - camera.x + 3,
    rolling.y * tileSize - camera.y + 3,
    10,
    tick,
    blast.dx === 0 ? 1 : blast.dx,
  );
}
