import { dart as dartSpec, powers, shaveGap } from "./constants.ts";
import { happen, setTally, tallyOf, type Draft } from "./draft.ts";
import type { Lead } from "./leads.ts";
import {
  cageRing,
  cageSpike,
  crateRadius,
  solidShare,
  type Level,
} from "./levels.ts";
import {
  heightOf,
  isGrown,
  isRolling,
  knock,
  radiusOf,
  seesFrost,
} from "./player.ts";
import type { Dart, Snowball } from "./types.ts";
import { spawn, thirds } from "./spawn.ts";
import { div, isqrt } from "./ways.ts";

const hitsSolid = (
  draft: Draft,
  level: Level,
  x: number,
  y: number,
  r: number,
): boolean => {
  for (const [sx, sy, sr] of level.solids) {
    const reachSum = div(sr * solidShare.part, solidShare.whole) + r;
    if ((sx - x) * (sx - x) + (sy - y) * (sy - y) < reachSum * reachSum)
      return true;
  }
  for (const cage of draft.cages) {
    if (cage.brokenAt >= 0) continue;
    for (const [dx, dy] of cageRing) {
      const reachSum = cageSpike + r;
      if ((cage.x + dx - x) ** 2 + (cage.y + dy - y) ** 2 < reachSum * reachSum)
        return true;
    }
  }
  return draft.crates.some(
    (crate) =>
      crate.brokenAt < 0 &&
      (crate.x - x) ** 2 + (crate.y - y) ** 2 <
        (crateRadius + r) * (crateRadius + r),
  );
};

const slowed = (draft: Draft, v: number): number =>
  seesFrost(draft) ? div(v, powers.visionSlow) : v;

// One snowball's tick. Returns it as it now is, or undefined when it is gone.
const rollBall = (
  draft: Draft,
  lead: Lead,
  level: Level,
  ball: Snowball,
): Snowball | undefined => {
  if (draft.hazardClock < ball.rollsAt) return ball;
  const x = ball.x + slowed(draft, ball.vx);
  const y = ball.y + slowed(draft, ball.vy);
  let next: Snowball = { ...ball, x, y };
  const [cx, cy] = level.rollCentre;
  const gone = (kind: "splash" | "plunge" | "shatter"): undefined => {
    if (next.nearest < shaveGap && !next.hoppedOver)
      draft.feats.closeShave = true;
    happen(draft, kind, next.x, next.y, next.r);
    return undefined;
  };
  if ((x - cx) ** 2 + (y - cy) ** 2 > level.dropRadius * level.dropRadius)
    return gone(level.drop);
  if (hitsSolid(draft, level, x, y, ball.r)) return gone("shatter");
  const p = draft.player;
  const pr = radiusOf(draft, lead);
  const d = isqrt((p.x - x) ** 2 + (p.y - y) ** 2);
  const gap = d - (pr + ball.r);
  if (gap >= 0) {
    if (gap < next.nearest && !p.airborne) next = { ...next, nearest: gap };
    return next;
  }
  if (gap > -60) return next;
  if (p.z >= 2 * ball.r - 300) {
    if (!next.hoppedOver) draft.feats.hoppedOver += 1;
    return { ...next, hoppedOver: true };
  }
  if (
    isGrown(draft) ||
    (isRolling(draft) && (!ball.big || lead.rollBreaksBig))
  ) {
    draft.feats.crushed += 1;
    happen(draft, "crush", x, y, ball.r);
    return undefined;
  }
  if (draft.tick < p.safeUntil) return next;
  happen(draft, "burst", x, y, ball.r);
  knock(draft, lead, x, y);
  return undefined;
};

const flyDart = (draft: Draft, lead: Lead, dart: Dart): Dart | undefined => {
  if (draft.hazardClock < dart.fliesAt) return dart;
  const vx = slowed(draft, dart.vx);
  const vy = slowed(draft, dart.vy);
  const next: Dart = {
    ...dart,
    travelled: dart.travelled + isqrt(vx * vx + vy * vy),
    x: dart.x + vx,
    y: dart.y + vy,
  };
  if (next.travelled > next.range) return undefined;
  const p = draft.player;
  const near = radiusOf(draft, lead) + dartSpec.radius;
  if ((p.x - next.x) ** 2 + (p.y - next.y) ** 2 >= near * near) return next;
  const low = dartSpec.height - 150;
  const high = dartSpec.height + 150;
  const top = p.z + heightOf(draft, lead);
  if (p.z >= high || top <= low) {
    if (!next.dodged && top <= low) {
      draft.feats.ducked += 1;
      return { ...next, dodged: true };
    }
    return next;
  }
  if (isGrown(draft)) {
    draft.feats.crushed += 1;
    happen(draft, "crush", next.x, next.y, 0);
    return undefined;
  }
  if (draft.tick < p.safeUntil) return next;
  happen(draft, "shatter", next.x, next.y, 0);
  knock(draft, lead, next.x - next.vx, next.y - next.vy);
  return undefined;
};

const flyBolts = (draft: Draft, level: Level): void => {
  const kept = [];
  for (const bolt of draft.bolts) {
    if (draft.tick >= bolt.until) continue;
    const next = { ...bolt, x: bolt.x + bolt.vx, y: bolt.y + bolt.vy };
    const r = powers.boltRadius;
    const ball = draft.snowballs.findIndex(
      (b) =>
        draft.hazardClock >= b.rollsAt &&
        (b.x - next.x) ** 2 + (b.y - next.y) ** 2 < (b.r + r) * (b.r + r),
    );
    const struck = draft.snowballs[ball];
    if (struck !== undefined) {
      draft.snowballs.splice(ball, 1);
      draft.feats.crushed += 1;
      happen(draft, "crush", struck.x, struck.y, struck.r);
      continue;
    }
    const crate = draft.crates.findIndex(
      (c) =>
        c.brokenAt < 0 &&
        (c.x - next.x) ** 2 + (c.y - next.y) ** 2 <
          (crateRadius + r) * (crateRadius + r),
    );
    const cracked = draft.crates[crate];
    if (cracked !== undefined) {
      draft.crates[crate] = { ...cracked, brokenAt: draft.tick };
      setTally(draft, { cratesBroken: tallyOf(draft).cratesBroken + 1 });
      happen(draft, "crate", cracked.x, cracked.y, crate);
      continue;
    }
    const dart = draft.darts.findIndex(
      (d) =>
        (d.x - next.x) ** 2 + (d.y - next.y) ** 2 < (dartSpec.radius + r) ** 2,
    );
    const shot = draft.darts[dart];
    if (shot !== undefined) {
      draft.darts.splice(dart, 1);
      happen(draft, "shatter", shot.x, shot.y, 0);
      continue;
    }
    if (hitsSolid(draft, level, next.x, next.y, r)) {
      happen(draft, "shatter", next.x, next.y, 0);
      continue;
    }
    kept.push(next);
  }
  draft.bolts = kept;
};

export const stepHazards = (draft: Draft, lead: Lead, level: Level): void => {
  spawn(draft, level);
  flyBolts(draft, level);
  const balls: Snowball[] = [];
  for (const ball of draft.snowballs) {
    const next = rollBall(draft, lead, level, ball);
    if (next !== undefined) balls.push(next);
  }
  draft.snowballs = balls;
  const darts: Dart[] = [];
  for (const dart of draft.darts) {
    const next = flyDart(draft, lead, dart);
    if (next !== undefined) darts.push(next);
  }
  draft.darts = darts;
  draft.hazardClock += seesFrost(draft) ? 1 : thirds;
};
