import { describe, expect, it } from "vitest";

import { fireAtBoss, meetBoss } from "../src/rules/hills/boss-meet.ts";
import {
  bossOf,
  freeEggs,
  ghostHeight,
  ghostY,
  guardY,
  moveBoss,
  rocketY,
  startBoss,
} from "../src/rules/hills/boss.ts";
import {
  arenaX,
  eggSize,
  heroHeight,
  heroWidth,
  tile,
} from "../src/rules/hills/constants.ts";
import { startHero } from "../src/rules/hills/state.ts";
import type { Boss, Ghost } from "../src/rules/hills/types.ts";
import {
  begun,
  ghostAt,
  groundY,
  landing,
  run,
  standing,
} from "./support/hills-fight.ts";

describe("what Glitchy touches in the fight", () => {
  const solo = (ghost: Ghost): Boss => ({
    ...begun(startBoss(5, 1)),
    ghosts: [ghost],
  });
  const top = groundY - ghostHeight - tile / 2;

  it("lands on a baby ghost dragon to hit it (it blinks a while, and is not hit again till then), and bounces", () => {
    const { bottom, hero } = landing(arenaX + 6 * tile, top);
    const hit = meetBoss(
      solo(ghostAt(arenaX + 6 * tile)),
      hero,
      bottom,
      20,
      1,
      0,
    );
    expect(hit.bounced).toBe(true);
    expect(hit.hurt).toBe(false);
    expect(hit.boss.ghosts[0]).toMatchObject({ hp: 2, hurt: 24 });
    expect(meetBoss(hit.boss, hero, bottom, 20, 1, 0).boss.ghosts[0]?.hp).toBe(
      2,
    );
    const bumped = meetBoss(
      solo(ghostAt(arenaX + 6 * tile)),
      { ...hero, y: top },
      groundY,
      0,
      1,
      0,
    );
    expect(bumped.hurt).toBe(true);
    expect(bumped.boss.ghosts[0]?.hp).toBe(3);
  });

  it("unseals the portal once the last hit frees the last ghost dragon, and sends the guards home", () => {
    const ghost = ghostAt(arenaX + 6 * tile, { hp: 1 });
    const { bottom, hero } = landing(ghost.x, ghostY(ghost, 77));
    const last = { ...solo(ghost), guards: [{ dir: -1 as const, x: arenaX }] };
    const won = meetBoss(last, hero, bottom, 20, 1, 77);
    expect(won.boss.ghosts[0]).toMatchObject({ freed: 77, hp: 0 });
    expect(won.boss.beaten).toBe(77);
    expect(won.boss.guards).toEqual([]);
    expect(won.boss.strike).toBeNull();
    expect(moveBoss(won.boss, hero, 1, 78).ghosts).toEqual(won.boss.ghosts);
  });

  it("cheers up a guard landed on (it goes home), and is bumped by one it runs into", () => {
    const guard = { dir: -1 as const, x: arenaX + 4 * tile };
    const boss = { ...solo(ghostAt(arenaX + 12 * tile)), guards: [guard] };
    const { bottom, hero } = landing(guard.x, guardY);
    const stomped = meetBoss(boss, hero, bottom, 20, 2, 0);
    expect([
      stomped.bounced,
      stomped.cheered,
      stomped.boss.guards.length,
    ]).toEqual([true, 1, 0]);
    const bumped = meetBoss(boss, standing(guard.x), groundY, 0, 2, 0);
    expect([bumped.hurt, bumped.cheered, bumped.boss.guards.length]).toEqual([
      true,
      0,
      1,
    ]);
  });

  it("bursts the egg rocket after six hits, freeing a dozen eggs, which fall to the ground and are caught", () => {
    const three = begun(startBoss(5, 3));
    const far = {
      ...three,
      ghosts: three.ghosts.map((ghost) => ({
        ...ghost,
        x: arenaX + 12 * tile,
      })),
    };
    const rocket = { dir: 1 as const, hp: 1, hurt: 0, x: arenaX + 5 * tile };
    const { bottom, hero } = landing(rocket.x, rocketY(0));
    const burst = meetBoss({ ...far, rocket }, hero, bottom, 20, 3, 0);
    expect(burst.bounced).toBe(true);
    expect(burst.boss.rocket?.hp).toBe(0);
    expect(burst.boss.freed).toEqual(freeEggs(rocket, 0));
    expect(burst.boss.freed).toHaveLength(12);
    expect(burst.boss.beaten).toBe(-1);
    const bumped = meetBoss(
      { ...far, rocket: { ...rocket, hp: 6 } },
      { ...hero, y: rocketY(0) },
      groundY,
      0,
      3,
      0,
    );
    expect([bumped.hurt, bumped.boss.rocket?.hp]).toEqual([true, 6]);
    const fallen = run(burst.boss, standing(arenaX), 3, 1, 200);
    for (const egg of fallen.freed) {
      expect(egg.y).toBe(groundY - eggSize);
      expect(egg.x).toBeGreaterThanOrEqual(arenaX);
    }
    const egg = fallen.freed[0];
    if (egg === undefined) throw new Error("no eggs");
    const caught = meetBoss(fallen, standing(egg.x), groundY, 0, 3, 201);
    expect(caught.caught).toBeGreaterThan(0);
    expect(caught.boss.freed[0]?.caught).toBe(true);
    expect(
      meetBoss(caught.boss, standing(egg.x), groundY, 0, 3, 202).caught,
    ).toBe(0);
  });

  it("is hurt standing where the lasers come down, but not while the spot is only marked", () => {
    const strike = { marks: [arenaX + 8 * tile], start: 100 };
    const boss = { ...solo(ghostAt(arenaX + 2 * tile)), strike };
    const hero = standing(arenaX + 8 * tile - heroWidth / 2);
    expect(meetBoss(boss, hero, groundY, 0, 1, 100).hurt).toBe(false);
    expect(
      meetBoss(boss, hero, groundY, 0, 1, 100 + bossOf(1).warning).hurt,
    ).toBe(true);
    expect(
      meetBoss(
        boss,
        standing(arenaX + 12 * tile),
        groundY,
        0,
        1,
        100 + bossOf(1).warning,
      ).hurt,
    ).toBe(false);
  });

  it("spends puffs of fire that hit a ghost dragon, the rocket or a guard, and lets the rest fly on", () => {
    const three = begun(startBoss(5, 3));
    const ghost = ghostAt(arenaX + 6 * tile);
    const rocket = { dir: 1 as const, hp: 6, hurt: 0, x: arenaX + 10 * tile };
    const guard = { dir: -1 as const, x: arenaX + 2 * tile };
    const boss = { ...three, ghosts: [ghost], guards: [guard], rocket };
    const ball = (x: number, y: number) => ({ life: 20, vx: 44, x, y });
    const balls = [
      ball(ghost.x, ghostY(ghost, 0)),
      ball(rocket.x, rocketY(0)),
      ball(guard.x, guardY),
      ball(arenaX + 14 * tile, 0),
    ];
    const fired = fireAtBoss(boss, balls, 0);
    expect(fired.fireballs).toEqual([balls[3]]);
    expect(fired.cheered).toBe(1);
    expect(fired.boss.ghosts[0]?.hp).toBe(2);
    expect(fired.boss.rocket?.hp).toBe(5);
    expect(fired.boss.guards).toEqual([]);
    const blinking = fireAtBoss(fired.boss, balls.slice(0, 2), 1);
    expect(blinking.boss.ghosts[0]?.hp).toBe(2);
    expect(blinking.fireballs).toHaveLength(2);
    const before = startBoss(5, 3);
    expect(fireAtBoss(before, balls, 0)).toEqual({
      boss: before,
      cheered: 0,
      fireballs: balls,
    });
    const over = { ...boss, beaten: 3 };
    expect(fireAtBoss(over, balls, 4).boss).toBe(over);
  });
});

describe("the forcefield in DeFu's fight", () => {
  it("send a guard home that the forcefield bumps, in DeFu's fight", () => {
    const hero = { ...startHero(), x: 155 * tile };
    const boss = {
      beaten: -1,
      freed: [],
      ghosts: [],
      guards: [{ dir: -1 as const, x: 155 * tile }],
      launched: -1,
      rng: 1,
      rocket: null,
      started: 0,
      strike: null,
    };
    const bottom = hero.y + heroHeight;
    expect(meetBoss(boss, hero, bottom, 0, 2, 5, true)).toMatchObject({
      cheered: 1,
      hurt: false,
    });
    expect(meetBoss(boss, hero, bottom, 0, 2, 5)).toMatchObject({
      cheered: 0,
      hurt: true,
    });
  });
});
