import { button, player as body } from "../../src/rules/constants.ts";
import {
  leads,
  levelAt,
  type RunState,
  type Snowball,
} from "../../src/rules/index.ts";

// What the bot sees of a run before it decides: how far things are, which land a place is on, the treasure to go for next, the danger
// nearest in time, and the snowball a hunting bot goes after.
export interface BotStyle {
  // Skips the hazards entirely (to test that they matter) or plays with them.
  readonly dodge: boolean;
  // Takes the eggs and keys, or only the crystals (a weak run that should not win, and that lasts every round's full minute).
  readonly greedy: boolean;
  // How often it rethinks, in ticks.
  readonly every: number;
  // Shoots the snowballs that come for it (from the second round), or only hops them.
  readonly shoots: boolean;
  // Sets foot on every islet of Shatter Sound before anything else there.
  readonly tour: boolean;
  // Goes after the snowballs rather than the treasure: to shoot them (from the second round) or to hop over them.
  readonly hunts: "hop" | "shoot" | null;
}

export const dist2 = (ax: number, ay: number, bx: number, by: number): number =>
  (ax - bx) ** 2 + (ay - by) ** 2;

export const landIndex = (state: RunState, x: number, y: number): number =>
  levelAt(state.round).land.findIndex(
    ([lx, ly, lr]) => dist2(x, y, lx, ly) <= lr * lr,
  );

// Where it wants to go next, and whether something must break or open first.
export const target = (
  state: RunState,
  style: BotStyle,
): { x: number; y: number; act: number } | undefined => {
  const p = state.player;
  if (style.tour && state.round === 1) {
    const visited = state.tallies[1]?.isletsVisited ?? 0;
    const islet = levelAt(1).land.findIndex(
      (_land, at) => at >= 1 && (visited & (1 << (at - 1))) === 0,
    );
    const land = levelAt(1).land[islet];
    if (land !== undefined) return { act: 0, x: land[0], y: land[1] };
  }
  const seeing = state.tick < p.visionUntil;
  const grown = state.tick < p.growUntil;
  let best: { x: number; y: number; act: number; d: number } | undefined;
  for (const item of state.items) {
    if (item.takenAt >= 0) continue;
    if (!style.greedy && item.kind !== "crystal") continue;
    let act = 0;
    let { x, y } = item;
    const crate = state.crates[item.crate];
    if (crate !== undefined && crate.brokenAt < 0) act = button.shoot;
    const cage = state.cages[item.cage];
    if (cage !== undefined && cage.brokenAt < 0) {
      if (!grown && state.tick < p.growReady) continue;
      act = grown ? 0 : button.grow;
      x = cage.x;
      y = cage.y;
    }
    if (item.ghost && !seeing) {
      if (state.tick < p.visionReady) continue;
      act = button.vision;
    }
    let d = dist2(p.x, p.y, x, y);
    if (landIndex(state, x, y) !== landIndex(state, p.x, p.y)) d += 4_000_000;
    if (best === undefined || d < best.d) best = { act, d, x, y };
  }
  return best;
};

// The danger nearest in time: a snowball or dart whose path comes too close, and how many ticks until it does.
export const danger = (
  state: RunState,
):
  | { ticks: number; kind: "ball" | "dart"; r: number; side: number }
  | undefined => {
  const p = state.player;
  const lead = leads[state.lead];
  if (lead === undefined) return undefined;
  let worst:
    | { ticks: number; kind: "ball" | "dart"; r: number; side: number }
    | undefined;
  const look = (
    x: number,
    y: number,
    vx: number,
    vy: number,
    reach: number,
    kind: "ball" | "dart",
    r: number,
  ): void => {
    const rx = x - p.x;
    const ry = y - p.y;
    const wx = vx - p.vx;
    const wy = vy - p.vy;
    const w2 = wx * wx + wy * wy;
    if (w2 === 0) return;
    const t = -(rx * wx + ry * wy) / w2;
    if (t < 0 || t > 45) return;
    const cx = rx + wx * t;
    const cy = ry + wy * t;
    if (cx * cx + cy * cy > reach * reach) return;
    const side = rx * vy - ry * vx > 0 ? 1 : -1;
    if (worst === undefined || t < worst.ticks)
      worst = { kind, r, side, ticks: t };
  };
  for (const ball of state.snowballs) {
    if (state.hazardClock < ball.rollsAt) continue;
    look(
      ball.x,
      ball.y,
      ball.vx,
      ball.vy,
      lead.radius + ball.r + 250,
      "ball",
      ball.r,
    );
  }
  for (const dart of state.darts) {
    if (state.hazardClock < dart.fliesAt) continue;
    look(dart.x, dart.y, dart.vx, dart.vy, lead.radius + 400, "dart", 0);
  }
  return worst;
};

// The nearest snowball already rolling and small enough to stop, within nine metres: what a hunting bot goes for instead of treasure.
export const preyOf = (
  state: RunState,
  style: BotStyle,
): Snowball | undefined => {
  if (style.hunts === null || (style.hunts === "shoot" && state.round === 0))
    return undefined;
  const p = state.player;
  let best: Snowball | undefined;
  let nearest = 9000 * 9000;
  for (const ball of state.snowballs) {
    if (state.hazardClock < ball.rollsAt || ball.big) continue;
    const d = dist2(p.x, p.y, ball.x, ball.y);
    if (d < nearest) {
      best = ball;
      nearest = d;
    }
  }
  return best;
};

// How many ticks until the ball first touches the hero, as both move now; undefined when it will not.
export const contactTicks = (
  state: RunState,
  ball: Snowball,
): number | undefined => {
  const p = state.player;
  const reach = (leads[state.lead]?.radius ?? body.radius) + ball.r;
  const [rx, ry] = [ball.x - p.x, ball.y - p.y];
  const [wx, wy] = [ball.vx - p.vx, ball.vy - p.vy];
  const a = wx * wx + wy * wy;
  const b = rx * wx + ry * wy;
  const c = rx * rx + ry * ry - reach * reach;
  if (c <= 0) return 0;
  const disc = b * b - a * c;
  if (a === 0 || disc < 0 || b >= 0) return undefined;
  return (-b - Math.sqrt(disc)) / a;
};
