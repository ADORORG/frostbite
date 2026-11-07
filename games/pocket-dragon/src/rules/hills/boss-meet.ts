import {
  eggSize,
  fireHeight,
  fireWidth,
  heroHeight,
  heroWidth,
  stompDepth,
  tile,
  groundRow,
} from "./constants.ts";
import { touching } from "./collide.ts";
import {
  freeEggs,
  ghostHeight,
  ghostWidth,
  ghostY,
  guardHeight,
  guardWidth,
  guardY,
  rocketHeight,
  rocketWidth,
  rocketY,
  strikeHalf,
  striking,
} from "./boss.ts";
import type { Boss, Fireball, Ghost, Hero, Rocket } from "./types.ts";

// What touches what in the boss fight: Glitchy landing on a ghost dragon, the rocket or a guard (a hit on it), running into one (a hit on
// Glitchy), standing where a laser strike comes down, and catching freed eggs; and puffs of fire hitting them.
const hurtTicks = 24;
const groundY = groundRow * tile;

export interface Met {
  readonly boss: Boss;
  // Glitchy landed on something and bounces, or was hurt; eggs caught and guards cheered up this tick.
  readonly bounced: boolean;
  readonly caught: number;
  readonly cheered: number;
  readonly hurt: boolean;
}

const hitGhost = (ghost: Ghost, tick: number): Ghost =>
  ghost.hurt > 0
    ? ghost
    : {
        ...ghost,
        freed: ghost.hp === 1 ? tick : ghost.freed,
        hp: ghost.hp - 1,
        hurt: hurtTicks,
      };
const hitRocket = (rocket: Rocket): Rocket =>
  rocket.hurt > 0 ? rocket : { ...rocket, hp: rocket.hp - 1, hurt: hurtTicks };

// Burst rockets free their eggs, and once every ghost dragon and the rocket are beaten, the portal is unsealed and the guards go home.
function settle(before: Boss, boss: Boss, tick: number): Boss {
  const burst =
    before.rocket !== null &&
    before.rocket.hp > 0 &&
    boss.rocket !== null &&
    boss.rocket.hp <= 0;
  const freed =
    burst && boss.rocket !== null
      ? [...boss.freed, ...freeEggs(boss.rocket, tick)]
      : boss.freed;
  const won =
    boss.started >= 0 &&
    boss.beaten < 0 &&
    boss.ghosts.every((g) => g.hp <= 0) &&
    (boss.rocket === null || boss.rocket.hp <= 0);
  return won
    ? { ...boss, beaten: tick, freed, guards: [], strike: null }
    : { ...boss, freed };
}

// What Glitchy touched this tick. `bottom` is where its feet were before it moved; `falling`, how fast it was coming down. With the
// forcefield up (`shielded`), a guard bumped into is sent home too.
export function meetBoss(
  boss: Boss,
  hero: Hero,
  bottom: number,
  falling: number,
  stage: number,
  tick: number,
  shielded = false,
): Met {
  if (boss.started < 0)
    return { boss, bounced: false, caught: 0, cheered: 0, hurt: false };
  const on = (x: number, y: number, width: number, height: number) =>
    touching(hero.x, hero.y, heroWidth, heroHeight, x, y, width, height);
  const stomps = (top: number) => falling > 0 && bottom <= top + stompDepth;
  let bounced = false;
  let hurt = false;
  const ghosts = boss.ghosts.map((ghost) => {
    const y = ghostY(ghost, tick);
    if (ghost.hp <= 0 || !on(ghost.x, y, ghostWidth, ghostHeight)) return ghost;
    if (stomps(y)) {
      bounced = true;
      return hitGhost(ghost, tick);
    }
    hurt = true;
    return ghost;
  });
  let rocket = boss.rocket;
  if (
    rocket !== null &&
    rocket.hp > 0 &&
    on(rocket.x, rocketY(tick), rocketWidth, rocketHeight)
  ) {
    if (stomps(rocketY(tick))) {
      bounced = true;
      rocket = hitRocket(rocket);
    } else hurt = true;
  }
  const guards = boss.guards.filter((guard) => {
    if (!on(guard.x, guardY, guardWidth, guardHeight)) return true;
    const stomped = stomps(guardY);
    if (stomped) bounced = true;
    else if (!shielded) hurt = true;
    return !stomped && !shielded;
  });
  if (
    striking(boss.strike, tick, stage) &&
    (boss.strike?.marks ?? []).some((mark) =>
      on(mark - strikeHalf, groundY - 3 * tile, strikeHalf * 2, 3 * tile),
    )
  )
    hurt = true;
  let caught = 0;
  const freed = boss.freed.map((egg) => {
    if (egg.caught || !on(egg.x, egg.y, eggSize, eggSize)) return egg;
    caught += 1;
    return { ...egg, caught: true };
  });
  const next = settle(boss, { ...boss, freed, ghosts, guards, rocket }, tick);
  return {
    boss: next,
    bounced,
    caught,
    cheered: boss.guards.length - guards.length,
    hurt,
  };
}

// Puffs of fire that hit a ghost dragon, the rocket or a guard are spent on it.
export function fireAtBoss(
  boss: Boss,
  fireballs: readonly Fireball[],
  tick: number,
) {
  if (boss.started < 0 || boss.beaten >= 0)
    return { boss, cheered: 0, fireballs };
  let { ghosts, guards, rocket } = boss;
  let cheered = 0;
  const flying = fireballs.filter((ball) => {
    const hit = (x: number, y: number, width: number, height: number) =>
      touching(ball.x, ball.y, fireWidth, fireHeight, x, y, width, height);
    const ghost = ghosts.findIndex(
      (g) =>
        g.hp > 0 &&
        g.hurt === 0 &&
        hit(g.x, ghostY(g, tick), ghostWidth, ghostHeight),
    );
    if (ghost >= 0) {
      ghosts = ghosts.map((g, at) => (at === ghost ? hitGhost(g, tick) : g));
      return false;
    }
    if (
      rocket !== null &&
      rocket.hp > 0 &&
      rocket.hurt === 0 &&
      hit(rocket.x, rocketY(tick), rocketWidth, rocketHeight)
    ) {
      rocket = hitRocket(rocket);
      return false;
    }
    const guard = guards.findIndex((g) =>
      hit(g.x, guardY, guardWidth, guardHeight),
    );
    if (guard < 0) return true;
    guards = guards.filter((_, at) => at !== guard);
    cheered += 1;
    return false;
  });
  return {
    boss: settle(boss, { ...boss, ghosts, guards, rocket }, tick),
    cheered,
    fireballs: flying,
  };
}

// A glitch blast rolling through the fight: every guard it touches goes home, and a ghost dragon or the rocket it touches is hit (once,
// while they flash); unlike a puff of fire, it rolls on.
export function blastAtBoss(
  boss: Boss,
  x: number,
  y: number,
  size: number,
  tick: number,
): { readonly boss: Boss; readonly cheered: number } {
  if (boss.started < 0 || boss.beaten >= 0) return { boss, cheered: 0 };
  const hit = (left: number, top: number, width: number, height: number) =>
    touching(x, y, size, size, left, top, width, height);
  let changed = false;
  const ghosts = boss.ghosts.map((ghost) => {
    if (
      ghost.hp <= 0 ||
      ghost.hurt > 0 ||
      !hit(ghost.x, ghostY(ghost, tick), ghostWidth, ghostHeight)
    )
      return ghost;
    changed = true;
    return hitGhost(ghost, tick);
  });
  let { rocket } = boss;
  if (
    rocket !== null &&
    rocket.hp > 0 &&
    rocket.hurt === 0 &&
    hit(rocket.x, rocketY(tick), rocketWidth, rocketHeight)
  ) {
    changed = true;
    rocket = hitRocket(rocket);
  }
  const guards = boss.guards.filter(
    (guard) => !hit(guard.x, guardY, guardWidth, guardHeight),
  );
  if (!changed && guards.length === boss.guards.length)
    return { boss, cheered: 0 };
  return {
    boss: settle(boss, { ...boss, ghosts, guards, rocket }, tick),
    cheered: boss.guards.length - guards.length,
  };
}
