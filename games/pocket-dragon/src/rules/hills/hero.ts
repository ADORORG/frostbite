import {
  accel,
  bufferTicks,
  coyoteTicks,
  gravity,
  jumpSpeed,
  maxFall,
  shortHop,
  topSpeed,
} from "./constants.ts";
import { moveAlongX, moveAlongY, standing } from "./collide.ts";
import type { Hero, HillsControl, HillsLevel } from "./types.ts";

export interface Moved {
  // How fast Glitchy was falling this tick before landing on anything: a stomp needs a dragon coming down.
  readonly falling: number;
  readonly hero: Hero;
  readonly landed: boolean;
}

const toward = (speed: number, target: number, by: number): number =>
  speed < target ? Math.min(target, speed + by) : Math.max(target, speed - by);

// One tick of Glitchy: run, turn, jump, fall, and meet the ground, ledges and ice. Let go of jump early and it is a hop; a jump pressed
// just before landing, or just after running off an edge, still counts.
export function moveHero(
  level: HillsLevel,
  melted: readonly boolean[],
  before: Hero,
  controls: Readonly<Record<HillsControl, boolean>>,
): Moved {
  const direction = Number(controls.right) - Number(controls.left);
  let vx = toward(before.vx, direction * topSpeed, accel);
  let vy = before.vy;
  let buffer = Math.max(0, before.buffer - 1);
  let coyote = before.coyote;
  if (before.buffer > 0 && (before.grounded || coyote > 0)) {
    vy = -jumpSpeed;
    coyote = 0;
    buffer = 0;
  }
  if (!controls.jump && vy < -shortHop) vy = -shortHop;
  vy = Math.min(vy + gravity, maxFall);
  const falling = vy;
  const across = moveAlongX(level, melted, before.x, before.y, vx);
  if (across.blocked) vx = 0;
  const down = moveAlongY(level, melted, across.x, before.y, vy);
  if (down.hit !== null) vy = 0;
  const grounded = standing(level, melted, across.x, down.y);
  return {
    falling,
    hero: {
      buffer,
      coyote: grounded ? coyoteTicks : Math.max(0, coyote - 1),
      facing: direction === 0 ? before.facing : direction > 0 ? 1 : -1,
      grounded,
      vx,
      vy,
      x: across.x,
      y: down.y,
    },
    landed: grounded && !before.grounded,
  };
}

export const pressJump = (hero: Hero): Hero => ({
  ...hero,
  buffer: bufferTicks + 1,
});
