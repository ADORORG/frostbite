import { button, noWay, player as body, powers } from "./constants.ts";
import {
  happen,
  nextId,
  penalize,
  setTally,
  tallyOf,
  type Draft,
} from "./draft.ts";
import type { Lead } from "./leads.ts";
import {
  cageRing,
  cageSpike,
  crateRadius,
  isletCount,
  solidShare,
  type Level,
} from "./levels.ts";
import { div, isqrt, stepOf } from "./ways.ts";

// What the player can do grows round by round: hop and duck from the start; roll, shoot and hover from the second round; grow and frost
// vision in the third.
export const canRollShootHover = (round: number): boolean => round >= 1;
export const canGrowSee = (round: number): boolean => round >= 2;

export const isGrown = (draft: Pick<Draft, "player" | "tick">): boolean =>
  draft.tick < draft.player.growUntil;
export const isRolling = (draft: Pick<Draft, "player" | "tick">): boolean =>
  draft.tick < draft.player.rollUntil;
export const seesFrost = (draft: Pick<Draft, "player" | "tick">): boolean =>
  draft.tick < draft.player.visionUntil;

export const radiusOf = (draft: Draft, lead: Lead): number =>
  isGrown(draft) ? body.grownRadius : lead.radius;
export const heightOf = (draft: Draft, lead: Lead): number => {
  if (isGrown(draft)) return body.grownHeight;
  if (isRolling(draft) || draft.player.ducking) return lead.duckHeight;
  return lead.height;
};

const usePowers = (draft: Draft, lead: Lead): void => {
  const p = draft.player;
  const pressed = draft.pressed;
  const grounded = !p.airborne;
  const [fx, fy] = stepOf(p.facing);
  if ((pressed & button.hop) !== 0 && grounded && !isRolling(draft)) {
    p.vz = lead.hopSpeed;
    p.airborne = true;
    p.ducking = false;
    happen(draft, "hop", p.x, p.y);
  }
  const speed = isqrt(p.vx * p.vx + p.vy * p.vy);
  if (
    canRollShootHover(draft.round) &&
    (pressed & button.duck) !== 0 &&
    !p.airborne &&
    speed >= 40 &&
    draft.tick >= p.rollReady
  ) {
    p.rollUntil = draft.tick + body.rollTicks;
    p.rollReady = p.rollUntil + body.rollCooldown;
    happen(draft, "roll", p.x, p.y);
  }
  if (
    canRollShootHover(draft.round) &&
    (pressed & button.shoot) !== 0 &&
    draft.tick >= p.boltReady
  ) {
    p.boltReady = draft.tick + powers.boltCooldown;
    const lead1 = radiusOf(draft, lead) + 200;
    draft.bolts.push({
      id: nextId(draft),
      until: draft.tick + lead.boltLife,
      vx: div(fx * powers.boltSpeed, 1000),
      vy: div(fy * powers.boltSpeed, 1000),
      x: p.x + div(fx * lead1, 1000),
      y: p.y + div(fy * lead1, 1000),
    });
    happen(draft, "bolt", p.x, p.y, p.facing);
  }
  if (
    canGrowSee(draft.round) &&
    (pressed & button.grow) !== 0 &&
    draft.tick >= p.growReady
  ) {
    p.growUntil = draft.tick + lead.growTicks;
    p.growReady = draft.tick + powers.growCooldown;
    happen(draft, "grow", p.x, p.y);
  }
  if (
    canGrowSee(draft.round) &&
    (pressed & button.vision) !== 0 &&
    draft.tick >= p.visionReady
  ) {
    p.visionUntil = draft.tick + lead.visionTicks;
    p.visionReady = draft.tick + powers.visionCooldown;
    happen(draft, "vision", p.x, p.y);
  }
};

const steerToward = (v: number, target: number, steps: number): number =>
  v + div(target - v, steps);

const moveFlat = (draft: Draft, lead: Lead): void => {
  const p = draft.player;
  if (draft.tick < p.stunUntil) {
    p.vx = div(p.vx * 7, 8);
    p.vy = div(p.vy * 7, 8);
    return;
  }
  if (draft.pad.way !== noWay) p.facing = draft.pad.way;
  if (isRolling(draft)) {
    const [fx, fy] = stepOf(p.facing);
    p.vx = div(fx * lead.rollSpeed, 1000);
    p.vy = div(fy * lead.rollSpeed, 1000);
    return;
  }
  p.ducking =
    !p.airborne && (draft.pad.buttons & button.duck) !== 0 && !isGrown(draft);
  let speed = lead.runSpeed;
  if (isGrown(draft)) speed = body.grownSpeed;
  else if (p.ducking) speed = body.duckSpeed;
  else if (p.hovering) speed = body.hoverSpeed;
  const [wx, wy] = draft.pad.way === noWay ? [0, 0] : stepOf(draft.pad.way);
  const steps = p.hovering
    ? body.hoverSteer
    : p.airborne
      ? body.airSteer
      : body.steer;
  p.vx = steerToward(p.vx, div(wx * speed, 1000), steps);
  p.vy = steerToward(p.vy, div(wy * speed, 1000), steps);
};

const moveUp = (draft: Draft, lead: Lead): void => {
  const p = draft.player;
  if (!p.airborne) {
    p.hovering = false;
    return;
  }
  p.hovering =
    canRollShootHover(draft.round) &&
    (draft.pad.buttons & button.hop) !== 0 &&
    p.vz <= 0 &&
    p.hoverLeft > 0;
  p.z += p.vz;
  if (p.hovering) {
    p.vz = -body.hoverFall;
    p.hoverLeft -= 1;
  } else {
    p.vz -= body.gravity;
  }
  if (p.z <= 0) {
    p.z = 0;
    p.vz = 0;
    p.airborne = false;
    p.hovering = false;
    p.hoverLeft = lead.hoverTicks;
    happen(draft, "land", p.x, p.y);
  }
};

// Pushes the player out of a solid circle. Returns whether they touched.
const pushOut = (
  draft: Draft,
  cx: number,
  cy: number,
  cr: number,
  pr: number,
): boolean => {
  const p = draft.player;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const reachSum = cr + pr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= reachSum * reachSum) return false;
  const d = isqrt(d2);
  if (d === 0) {
    p.y = cy + reachSum;
    return true;
  }
  p.x = cx + div(dx * reachSum, d);
  p.y = cy + div(dy * reachSum, d);
  return true;
};

const collideWorld = (draft: Draft, lead: Lead, level: Level): void => {
  const pr = radiusOf(draft, lead);
  for (const [sx, sy, sr] of level.solids)
    pushOut(draft, sx, sy, div(sr * solidShare.part, solidShare.whole), pr);
  draft.crates.forEach((crate, index) => {
    if (crate.brokenAt >= 0) return;
    const touched = pushOut(draft, crate.x, crate.y, crateRadius, pr);
    if (touched && isRolling(draft)) {
      draft.crates[index] = { ...crate, brokenAt: draft.tick };
      setTally(draft, { cratesBroken: tallyOf(draft).cratesBroken + 1 });
      happen(draft, "crate", crate.x, crate.y, index);
    }
  });
  draft.cages.forEach((cage, index) => {
    if (cage.brokenAt >= 0) return;
    for (const [dx, dy] of cageRing) {
      if (!pushOut(draft, cage.x + dx, cage.y + dy, cageSpike, pr)) continue;
      if (isGrown(draft)) {
        draft.cages[index] = { ...cage, brokenAt: draft.tick };
        setTally(draft, { cagesBroken: tallyOf(draft).cagesBroken + 1 });
        happen(draft, "cage", cage.x, cage.y, index);
        return;
      }
    }
  });
};

const onLand = (level: Level, x: number, y: number): number =>
  level.land.findIndex(
    ([lx, ly, lr]) => (x - lx) * (x - lx) + (y - ly) * (y - ly) <= lr * lr,
  );

// The edge of a single floe holds the player in; among islets, stepping off is a fall into the water.
const keepOnLand = (draft: Draft, lead: Lead, level: Level): void => {
  const p = draft.player;
  const pr = radiusOf(draft, lead);
  const only = level.land.length === 1 ? level.land[0] : undefined;
  if (only !== undefined) {
    const limit = only[2] - pr;
    const d = isqrt(
      (p.x - only[0]) * (p.x - only[0]) + (p.y - only[1]) * (p.y - only[1]),
    );
    if (d > limit && d > 0) {
      p.x = only[0] + div((p.x - only[0]) * limit, d);
      p.y = only[1] + div((p.y - only[1]) * limit, d);
    }
    p.lastSafeX = p.x;
    p.lastSafeY = p.y;
    return;
  }
  if (p.airborne) return;
  const standing = onLand(level, p.x, p.y);
  const land = level.land[standing];
  if (land !== undefined) {
    // A place to come back to after a fall: well inside the edge, never on it.
    const inside =
      land[2] -
      isqrt(
        (p.x - land[0]) * (p.x - land[0]) + (p.y - land[1]) * (p.y - land[1]),
      );
    if (inside >= safeMargin) {
      p.lastSafeX = p.x;
      p.lastSafeY = p.y;
    }
    if (standing >= 1 && standing <= isletCount) {
      setTally(draft, {
        isletsVisited: tallyOf(draft).isletsVisited | (1 << (standing - 1)),
      });
    }
    return;
  }
  happen(draft, "splash", p.x, p.y, 1);
  if (draft.tick >= p.safeUntil) penalize(draft, lead, p.x, p.y);
  p.x = p.lastSafeX;
  p.y = p.lastSafeY;
  p.vx = 0;
  p.vy = 0;
  p.rollUntil = draft.tick;
  p.stunUntil = draft.tick + body.stunTicks;
  p.safeUntil = draft.tick + body.safeTicks;
};

const safeMargin = 900;

export const stepPlayer = (draft: Draft, lead: Lead, level: Level): void => {
  if (draft.tick >= draft.player.stunUntil) usePowers(draft, lead);
  moveFlat(draft, lead);
  moveUp(draft, lead);
  draft.player.x += draft.player.vx;
  draft.player.y += draft.player.vy;
  collideWorld(draft, lead, level);
  keepOnLand(draft, lead, level);
};

// A knock: pushed away from (fromX, fromY), dazed for a moment and safe from the next knock for a little longer.
export const knock = (
  draft: Draft,
  lead: Lead,
  fromX: number,
  fromY: number,
): void => {
  const p = draft.player;
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const d = Math.max(1, isqrt(dx * dx + dy * dy));
  p.vx = div(dx * lead.knockSpeed, d);
  p.vy = div(dy * lead.knockSpeed, d);
  p.rollUntil = draft.tick;
  p.stunUntil = draft.tick + body.stunTicks;
  p.safeUntil = draft.tick + body.safeTicks;
  penalize(draft, lead, p.x, p.y);
};
