import { walk, withBase } from "./base.ts";
import { eggFlies, guardsMove, shadowsMove } from "./foes.ts";
import { lairTick } from "./lair.ts";
import type { Base, FoundKind, WoodsState } from "./types.ts";

const count = (list: readonly boolean[]): number => list.filter(Boolean).length;

// What was just done outside the maze, if anything worth a word on the screen: a dragon freed from its cage, a rocket key found or
// fitted, a valve of the factory broken, a guard sent home, a shadow dragon set free, the forcefield or the heart taken.
function doneBetween(was: Base, now: Base): FoundKind | null {
  if (count(now.installed) > count(was.installed)) return "panel";
  if (count(now.pieces) > count(was.pieces)) return "key";
  if (count(now.allies) > count(was.allies)) return "ally";
  if (count(now.broken) > count(was.broken)) return "valve";
  if (now.cheered > was.cheered) return "home";
  if (now.freed > was.freed) return "freed";
  if (now.bubbleTaken && !was.bubbleTaken) return "bubble";
  if (now.heartTaken && !was.heartTaken) return "heart";
  return null;
}

export function withNews(before: WoodsState, after: WoodsState): WoodsState {
  const kind =
    before.base === null || after.base === null
      ? null
      : doneBetween(before.base, after.base);
  return kind === null
    ? after
    : { ...after, found: { kind, tick: after.tick } };
}

// One tick outside the maze (the clock already moved on): Glitchy's blinking and forcefield wear off, Glitchy steps, a launched egg
// flies; then in the woods the guards walk, and in the lair the shadow dragons chase and DeFu's weapons and the countdown go on.
export const tickBase = (state: WoodsState): WoodsState =>
  withNews(state, tickOutside(state));

function tickOutside(state: WoodsState): WoodsState {
  const { base } = state;
  if (base === null || state.outcome !== null) return state;
  const timed = withBase(state, {
    ...base,
    forcefield: Math.max(0, base.forcefield - 1),
    invulnerable: Math.max(0, base.invulnerable - 1),
  });
  let next = walk(timed, timed.base ?? base);
  next = eggFlies(next, next.base ?? base);
  const now = next.base ?? base;
  if (now.lairStart < 0) return guardsMove(next, now);
  next = shadowsMove(next, now);
  return next.outcome !== null ? next : lairTick(next, next.base ?? now);
}
