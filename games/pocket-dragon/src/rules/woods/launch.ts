import {
  aimHigh,
  aimLow,
  aimStart,
  eggGravity,
  fieldGround,
  fieldWidth,
  flyingEgg,
  launcherX,
  launcherY,
  launchTicks,
  powerHigh,
  powerLow,
  powerStart,
} from "./constants.ts";
import { cosOf, sinOf, unit } from "./trig.ts";
import type { Launch, WoodsState } from "./types.ts";

// The launch round, after Glitchy is out of the woods with the launcher built: tilt it with up and down, set its power with left and
// right, and launch the eggs found in the woods one at a time at the targets in the clearing. A hit scores the target's value.
export const startLaunch = (
  eggs: number,
  targets: number,
  tick: number,
): Launch => ({
  aim: aimStart,
  ended: eggs === 0,
  eggsLeft: eggs,
  flying: null,
  hits: Array.from({ length: targets }, () => 0),
  last: null,
  power: powerStart,
  score: 0,
  start: tick,
});

// An egg leaves the launcher at the tilt and power set: the power is half again as many field units a tick.
export function launchEgg(state: WoodsState): WoodsState {
  const { launch } = state;
  if (
    launch === null ||
    launch.ended ||
    launch.flying !== null ||
    launch.eggsLeft <= 0
  )
    return state;
  const speed = (launch.power * 3) / 2;
  return {
    ...state,
    launch: {
      ...launch,
      eggsLeft: launch.eggsLeft - 1,
      flying: {
        vx: Math.trunc((cosOf(launch.aim) * speed) / unit),
        vy: -Math.trunc((sinOf(launch.aim) * speed) / unit),
        x: launcherX,
        y: launcherY,
      },
    },
  };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

export function tickLaunch(state: WoodsState): WoodsState {
  const { launch, controls } = state;
  const tick = state.tick + 1;
  if (launch === null || launch.ended) return { ...state, tick };
  const aim = clamp(
    launch.aim + (controls.up ? 2 : 0) - (controls.down ? 2 : 0),
    aimLow,
    aimHigh,
  );
  const power = clamp(
    launch.power + (controls.right ? 1 : 0) - (controls.left ? 1 : 0),
    powerLow,
    powerHigh,
  );
  let next: Launch = { ...launch, aim, power };
  const egg = launch.flying;
  if (egg !== null) {
    const moved = {
      vx: egg.vx,
      vy: egg.vy + eggGravity,
      x: egg.x + egg.vx,
      y: egg.y + egg.vy,
    };
    const half = flyingEgg / 2;
    const hit = state.level.targets.findIndex(
      (target) =>
        moved.x + half > target.x &&
        moved.x - half < target.x + target.width &&
        moved.y + half > target.y &&
        moved.y - half < target.y + target.height,
    );
    if (hit >= 0)
      next = {
        ...next,
        flying: null,
        hits: next.hits.map((count, at) => (at === hit ? count + 1 : count)),
        last: { target: hit, tick },
        score: next.score + (state.level.targets[hit]?.value ?? 0),
      };
    else if (
      moved.y >= fieldGround ||
      moved.x > fieldWidth + 256 ||
      moved.x < 0
    )
      next = { ...next, flying: null };
    else next = { ...next, flying: moved };
  }
  const over =
    (next.eggsLeft === 0 && next.flying === null) ||
    tick - next.start >= launchTicks;
  return { ...state, launch: over ? { ...next, ended: true } : next, tick };
}
