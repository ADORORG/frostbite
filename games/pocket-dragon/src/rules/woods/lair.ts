import { hurt, withBase } from "./base.ts";
import { defu, hallRows } from "./base-map.ts";
import {
  countdownTicks,
  laserEvery,
  laserOn,
  laserWarn,
  waveEvery,
  waveFirst,
  waveReach,
  waveStep,
  waveWarn,
} from "./constants.ts";
import { playScene } from "./scenes.ts";
import type { Base, WoodsState } from "./types.ts";

// DeFu's weapons in the hall of her castle, and the rocket's countdown. Her laser glows along the row (or, the next time, the column)
// Glitchy is on (the hall's last row when Glitchy is below it), then burns there; her shockwave spreads out from her platform a tile at a
// time. Both are shown before they hurt, and neither reaches the dungeon. When the countdown runs out the rocket launches.
export type LaserPhase = "burn" | "glow" | null;

export function laserPhase(base: Base, tick: number): LaserPhase {
  if (base.lairStart < 0 || tick < base.lairStart) return null;
  const into = (tick - base.lairStart) % laserEvery;
  if (into >= laserEvery - laserOn) return "burn";
  return into >= laserEvery - laserOn - laserWarn ? "glow" : null;
}

// The shockwave: glowing (radius 0) or how far it has spread now; null between waves.
export function waveAt(base: Base, tick: number): number | null {
  const since = tick - base.lairStart - waveFirst;
  if (base.lairStart < 0 || since < 0) return null;
  const into = since % waveEvery;
  if (into < waveWarn) return 0;
  const radius = Math.floor((into - waveWarn) / waveStep) + 1;
  return radius <= waveReach ? radius : null;
}

export const fromDefu = (x: number, y: number): number =>
  Math.max(Math.abs(x - defu.x), Math.abs(y - defu.y));

export const countdownLeft = (base: Base, tick: number): number =>
  base.lairStart < 0 || tick < base.lairStart
    ? countdownTicks
    : Math.max(0, countdownTicks - (tick - base.lairStart));

export function lairTick(state: WoodsState, base: Base): WoodsState {
  if (countdownLeft(base, state.tick) <= 0)
    return playScene(
      withBase({ ...state, outcome: "launched" }, base),
      "launch",
    );
  const { tick } = state;
  const phase = laserPhase(base, tick);
  const turnCount = Math.floor((tick - base.lairStart) / laserEvery);
  const aimed: Base =
    phase === "glow" && base.laser === null
      ? {
          ...base,
          laser:
            turnCount % 2 === 0
              ? { horizontal: true, line: Math.min(base.y, hallRows) }
              : { horizontal: false, line: base.x },
        }
      : phase === null && base.laser !== null
        ? { ...base, laser: null }
        : base;
  const inHall = aimed.y <= hallRows;
  const burnt =
    inHall &&
    phase === "burn" &&
    aimed.laser !== null &&
    (aimed.laser.horizontal ? aimed.y : aimed.x) === aimed.laser.line;
  const wave = waveAt(aimed, tick);
  const rung =
    inHall && wave !== null && wave > 0 && fromDefu(aimed.x, aimed.y) === wave;
  return burnt || rung ? hurt(state, aimed) : withBase(state, aimed);
}
