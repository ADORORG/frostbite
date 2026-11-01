import { moveBoss } from "../../src/rules/hills/boss.ts";
import {
  groundRow,
  heroHeight,
  pixel,
  tile,
} from "../../src/rules/hills/constants.ts";
import { startHero } from "../../src/rules/hills/state.ts";
import type { Boss, Ghost, Hero } from "../../src/rules/hills/types.ts";

// Pieces of DeFu's fight made by hand for the tests of its rules.
export const groundY = groundRow * tile;
export const standing = (x: number): Hero => ({ ...startHero(), x });
// Glitchy coming down onto something whose top is at `top`: its feet were just above it, and now it is a little way in.
export const landing = (x: number, top: number) => ({
  bottom: top - pixel,
  hero: {
    ...startHero(),
    grounded: false,
    vy: 20,
    x,
    y: top - heroHeight + 2 * pixel,
  },
});
export const begun = (boss: Boss): Boss => ({ ...boss, started: 0 });
export const ghostAt = (x: number, more: Partial<Ghost> = {}): Ghost => ({
  dir: 1,
  freed: -1,
  hp: 3,
  hurt: 0,
  phase: 0,
  x,
  ...more,
});
// The fight from tick `from` to tick `to` with Glitchy standing still.
export function run(
  boss: Boss,
  hero: Hero,
  stage: number,
  from: number,
  to: number,
): Boss {
  let now = boss;
  for (let tick = from; tick <= to; tick += 1)
    now = moveBoss(now, hero, stage, tick);
  return now;
}
