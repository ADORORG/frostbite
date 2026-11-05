import { block, wrap } from "@frostbite/game-sdk/pixels";

import { levelAt } from "../rules/course.ts";
import type { RunState, Shard } from "../rules/types.ts";
import { colour, skies } from "./palette.ts";
import {
  groundY,
  screenHeight,
  screenWidth,
  screenX,
  screenY,
} from "./layout.ts";

// The world behind and under the snowball: sky, stars, mountains, hills, snow falling, the ground with its crevasses, and what lies on it. It
// draws a state and decides nothing; everything that moves is worked out from the state's tick and distance, so nothing here is random.
export function sky(context: CanvasRenderingContext2D, state: RunState): void {
  const [top, low] = skies[
    Math.floor(levelAt(state.distance) / 3) % skies.length
  ] ??
    skies[0] ?? [colour.hill, colour.hill];
  const bands = 6;
  for (let band = 0; band < bands; band += 1)
    block(
      context,
      band < bands / 2 ? top : low,
      0,
      (groundY / bands) * band,
      screenWidth,
      groundY / bands + 1,
    );
  for (let star = 0; star < 14; star += 1) {
    const twinkle = (state.tick >> 4) + star;
    block(
      context,
      twinkle % 3 === 0 ? colour.text : colour.star,
      wrap(star * 37 - state.distance / 400, screenWidth),
      (star * 11) % 36,
      1,
      1,
    );
  }
}

export function hills(
  context: CanvasRenderingContext2D,
  state: RunState,
): void {
  for (let column = 0; column < screenWidth; column += 2) {
    const far = wrap(column + state.distance / 360, 96);
    const near = wrap(column + state.distance / 120, 64);
    const farHeight = 14 + Math.abs(far - 48) / 3;
    const nearHeight = 6 + Math.abs(near - 32) / 4;
    block(context, colour.hillFar, column, groundY - farHeight, 2, farHeight);
    block(context, colour.hill, column, groundY - nearHeight, 2, nearHeight);
  }
}

export function snowfall(
  context: CanvasRenderingContext2D,
  state: RunState,
): void {
  for (let flake = 0; flake < 26; flake += 1) {
    const drift = 1 + (flake % 3);
    block(
      context,
      flake % 4 === 0 ? colour.snow : colour.snowDark,
      wrap(
        flake * 41 - state.tick * drift * 0.4 - state.distance / 90,
        screenWidth,
      ),
      wrap(flake * 23 + state.tick * (0.3 + (flake % 3) * 0.15), screenHeight),
      1,
      1,
    );
  }
}

export function ground(
  context: CanvasRenderingContext2D,
  state: RunState,
): void {
  block(
    context,
    colour.ground,
    0,
    groundY,
    screenWidth,
    screenHeight - groundY,
  );
  block(context, colour.snow, 0, groundY, screenWidth, 2);
  block(context, colour.snowDark, 0, groundY + 2, screenWidth, 1);
  // Bumps in the snow, and cracks in the ice below it, scrolling at the speed of the ground.
  for (let bump = 0; bump < 8; bump += 1)
    block(
      context,
      colour.snow,
      wrap(bump * 23 - state.distance / 6, screenWidth),
      groundY - 1,
      3 + (bump % 3),
      1,
    );
  for (let crack = 0; crack < 10; crack += 1) {
    const x = wrap(crack * 19 - state.distance / 6, screenWidth);
    const y = groundY + 6 + (crack % 3) * 4;
    block(context, colour.hill, x, y, 6, 1);
    block(context, colour.hill, x + 6, y + 1, 3, 1);
  }
}

// Streaks of speed across the sky once the slope is quick: more of them, and longer, as it gets faster.
export function speedLines(
  context: CanvasRenderingContext2D,
  state: RunState,
  speed: number,
): void {
  if (speed < 14) return;
  context.globalAlpha = 0.35;
  for (let line = 0; line < speed - 12; line += 1)
    block(
      context,
      colour.snow,
      wrap(line * 53 - state.tick * (6 + (line % 3) * 2), screenWidth + 40) -
        20,
      6 + ((line * 17) % (groundY - 12)),
      10 + (speed - 12) * 2,
      1,
    );
  context.globalAlpha = 1;
}

export function shards(
  context: CanvasRenderingContext2D,
  state: RunState,
): void {
  state.shards.forEach((shard: Shard, index) => {
    const x = screenX(shard.x, state.distance);
    if (x < -4 || x > screenWidth) return;
    const bob = ((state.tick >> 3) + index) % 2;
    const y = screenY(shard.y) - bob;
    block(context, colour.yellow, x, y - 2, 1, 5);
    block(context, colour.yellow, x - 2, y, 5, 1);
    block(context, colour.snow, x - 1, y - 1, 3, 3);
  });
}
