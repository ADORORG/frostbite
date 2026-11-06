import { sprite } from "@frostbite/game-sdk/pixels";

import { blastSize, heroHeight, pixel } from "../rules/hills/constants.ts";
import type { HillsState } from "../rules/hills/types.ts";
import {
  glitchBall,
  kitKey,
  kitPictures,
  spriteScaled,
} from "./kit-sprites.ts";
import { glitchyColours, glitchySide } from "./sprites.ts";

// Egg Hills' share of the backpack on the screen: the foods lying along the way (bobbing, until picked up), the glitch blasts rolling,
// and Glitchy, twice as big while a pineapple lasts (standing on the same feet).
const px = (units: number): number => Math.round(units / pixel);

export function kitThings(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const bob = Math.floor(state.tick / 15) % 2;
  state.level.kit.forEach((spot, at) => {
    if (state.kitTaken[at] !== true)
      sprite(
        context,
        kitPictures[spot.item],
        kitKey,
        px(spot.x) - camera + 1,
        px(spot.y) + 1 + bob,
      );
  });
  for (const ball of state.blasts)
    glitchBall(
      context,
      px(ball.x) - camera - 1,
      px(ball.y) - 2,
      px(blastSize) + 2,
      state.tick,
      Math.sign(ball.vx),
    );
}

export function hillsHero(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  if (state.invulnerable > 0 && Math.floor(state.tick / 4) % 2 === 0) return;
  const { hero: h } = state;
  const breathing = state.fireCooldown > 10;
  const picture = breathing
    ? glitchySide.breathe
    : !h.grounded
      ? glitchySide.jump
      : h.vx === 0
        ? glitchySide.stand
        : (glitchySide.run[Math.floor(state.tick / 6) % 2] ??
          glitchySide.stand);
  const rowsOf =
    h.facing > 0 ? picture : picture.map((row) => [...row].reverse().join(""));
  const feet = px(h.y) + px(heroHeight);
  if (!state.powers.big) {
    sprite(
      context,
      rowsOf,
      glitchyColours,
      px(h.x) - camera - 2,
      feet - rowsOf.length,
    );
    return;
  }
  spriteScaled(
    context,
    rowsOf,
    glitchyColours,
    px(h.x) - camera - 10,
    feet - rowsOf.length * 2,
    2,
  );
}
