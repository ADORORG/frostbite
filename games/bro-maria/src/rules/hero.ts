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
import { columnsOf, moveAlongX, moveAlongY, standing } from "./collide.ts";
import type { Controls, Hero, Level } from "./types.ts";

export interface Moved {
  // The crates the hero's head struck, by their place in the level's list.
  readonly bumped: readonly number[];
  // The hero's fall speed this tick before it met anything: a stomp needs a hero that was coming down.
  readonly falling: number;
  readonly hero: Hero;
  readonly landed: boolean;
}

const toward = (speed: number, target: number, by: number): number =>
  speed < target ? Math.min(target, speed + by) : Math.max(target, speed - by);

// One tick of the hero: run, jump, fall, and meet the ground, the walls and the crates above. The jump button decides how high a jump goes
// (let go early and it is a hop); a jump pressed a few ticks before landing, or a few after leaving an edge, still counts.
export function moveHero(
  level: Level,
  before: Hero,
  controls: Controls,
  used: readonly boolean[],
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
  const across = moveAlongX(level, before.x, before.y, vx);
  if (across.blocked) vx = 0;
  const down = moveAlongY(level, across.x, before.y, vy);
  const bumped: number[] = [];
  if (down.hit === "ceiling") {
    const columns = columnsOf(across.x);
    level.crates.forEach((crate, at) => {
      if (
        crate.y === down.row &&
        columns.includes(crate.x) &&
        used[at] !== true
      )
        bumped.push(at);
    });
    vy = 0;
  } else if (down.hit === "floor") vy = 0;
  const grounded = standing(level, across.x, down.y);
  return {
    bumped,
    falling,
    hero: {
      buffer,
      coyote: grounded ? coyoteTicks : Math.max(0, coyote - 1),
      grounded,
      vx,
      vy,
      x: across.x,
      y: down.y,
    },
    landed: grounded && !before.grounded,
  };
}

// A jump pressed: it is remembered for a few ticks, so one pressed just before landing still counts.
export const pressJump = (hero: Hero): Hero => ({
  ...hero,
  buffer: bufferTicks + 1,
});
