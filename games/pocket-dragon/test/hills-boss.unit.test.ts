import { describe, expect, it } from "vitest";

import { meetBoss } from "../src/rules/hills/boss-meet.ts";
import {
  bossOf,
  ghostHeight,
  ghostY,
  moveBoss,
  rocketY,
  startBoss,
  strikeTicks,
  striking,
} from "../src/rules/hills/boss.ts";
import {
  arenaX,
  heroWidth,
  levelTiles,
  tile,
} from "../src/rules/hills/constants.ts";
import { begun, groundY, run, standing } from "./support/hills-fight.ts";

describe("DeFu's fight", () => {
  it("is harder each stage: more ghost dragons, guards sent down, quicker strikes on more spots, and the egg rocket last", () => {
    const fights = [1, 2, 3].map(bossOf);
    expect(fights.map((fight) => fight.ghosts)).toEqual([1, 2, 2]);
    expect(fights.map((fight) => fight.guards)).toEqual([0, 3, 5]);
    expect(fights.map((fight) => fight.marks)).toEqual([1, 2, 3]);
    expect(fights.map((fight) => fight.rocket)).toEqual([false, false, true]);
    expect(fights.map((fight) => fight.strikeEvery)).toEqual([260, 200, 150]);
    expect(fights.map((fight) => fight.warning)).toEqual([60, 50, 42]);
    expect(bossOf(0)).toEqual(bossOf(1));
    expect(bossOf(9)).toEqual(bossOf(3));
  });

  it("starts from the seed: each ghost dragon in its place in the arena, and the rocket on the last stage", () => {
    const one = startBoss(5, 1);
    expect(one).toEqual(startBoss(5, 1));
    expect(one.ghosts.map((ghost) => ghost.x)).toEqual([arenaX + 6 * tile]);
    expect(one.rocket).toBeNull();
    expect([one.started, one.beaten]).toEqual([-1, -1]);
    const three = startBoss(5, 3);
    expect(three.ghosts.map((ghost) => [ghost.x, ghost.dir])).toEqual([
      [arenaX + 6 * tile, -1],
      [arenaX + 10 * tile, 1],
    ]);
    expect(three.rocket).toEqual({
      dir: 1,
      hp: 6,
      hurt: 0,
      x: arenaX + 5 * tile,
    });
    const seeds = [7, 99, 20_261_031, 123_456_789];
    const phases = new Set(
      seeds.map((seed) => startBoss(seed, 1).ghosts[0]?.phase),
    );
    expect(phases.size).toBeGreaterThan(1);
  });

  it("waits for Glitchy to come into the arena, then begins", () => {
    const boss = startBoss(5, 1);
    expect(moveBoss(boss, standing(arenaX - heroWidth), 1, 10)).toBe(boss);
    expect(
      moveBoss(boss, standing(arenaX - heroWidth + 1), 1, 10).started,
    ).toBe(10);
    const empty = meetBoss(boss, standing(arenaX), groundY, 0, 1, 10);
    expect(empty).toEqual({
      boss,
      bounced: false,
      caught: 0,
      cheered: 0,
      hurt: false,
    });
  });

  it("flies the ghost dragons and the rocket back and forth over the arena, from half a tile up to three and a half", () => {
    const hero = standing(arenaX + tile);
    let boss = begun(startBoss(5, 3));
    const turned = new Set<number>();
    for (let tick = 1; tick < 600; tick += 1) {
      boss = moveBoss(boss, hero, 3, tick);
      for (const ghost of boss.ghosts) {
        expect(ghost.x).toBeGreaterThanOrEqual(arenaX + 2 * tile);
        expect(ghost.x).toBeLessThanOrEqual(arenaX + 12 * tile);
        if (ghost.dir === 1) turned.add(tick);
        const y = ghostY(ghost, tick);
        expect(y).toBeLessThanOrEqual(groundY - ghostHeight - tile / 2);
        expect(y).toBeGreaterThanOrEqual(groundY - ghostHeight - 4 * tile);
      }
      expect(boss.rocket?.x).toBeGreaterThanOrEqual(arenaX + 3 * tile);
      expect(rocketY(tick)).toBeLessThan(groundY);
    }
    expect(turned.size).toBeGreaterThan(0);
    expect(turned.size).toBeLessThan(600);
  });

  it("sends guards down one after another on the later stages, who walk toward Glitchy", () => {
    const hero = standing(arenaX + tile);
    expect(run(begun(startBoss(5, 1)), hero, 1, 1, 2000).launched).toBe(0);
    const two = begun(startBoss(5, 2));
    expect(run(two, hero, 2, 1, 29).guards).toEqual([]);
    const first = run(two, hero, 2, 1, 30);
    expect(first.guards).toEqual([{ dir: -1, x: (levelTiles - 5) * tile }]);
    const walked = run(first, hero, 2, 31, 60);
    expect(walked.guards[0]?.x).toBe((levelTiles - 5) * tile - 30 * 5);
    expect(run(two, hero, 2, 1, 329).launched).toBe(1);
    expect(run(two, hero, 2, 1, 330).launched).toBe(2);
    expect(run(two, hero, 2, 1, 3000).launched).toBe(3);
    expect(run(begun(startBoss(5, 3)), hero, 3, 1, 3000).launched).toBe(5);
    const behind = run(
      first,
      standing(levelTiles * tile - heroWidth),
      2,
      31,
      40,
    );
    expect(behind.guards[0]).toEqual({
      dir: 1,
      x: (levelTiles - 5) * tile + 10 * 5,
    });
  });

  it("marks strike spots under Glitchy and around it, warns, then brings the lasers down for a moment", () => {
    const hero = standing(arenaX + 8 * tile - heroWidth / 2);
    const middle = arenaX + 8 * tile;
    const three = run(begun(startBoss(5, 3)), hero, 3, 1, 120);
    expect(three.strike).toEqual({
      marks: [middle, middle + 3 * tile, middle - 3 * tile],
      start: 120,
    });
    const { warning } = bossOf(3);
    expect(striking(three.strike, 120 + warning - 1, 3)).toBe(false);
    expect(striking(three.strike, 120 + warning, 3)).toBe(true);
    expect(striking(three.strike, 120 + warning + strikeTicks, 3)).toBe(false);
    expect(striking(null, 200, 3)).toBe(false);
    expect(
      run(three, hero, 3, 121, 120 + warning + strikeTicks).strike,
    ).toBeNull();
    expect(run(three, hero, 3, 121, 270).strike?.start).toBe(270);
    expect(run(begun(startBoss(5, 1)), hero, 1, 1, 120).strike?.marks).toEqual([
      middle,
    ]);
    const edge = standing(levelTiles * tile - heroWidth);
    const kept =
      run(begun(startBoss(5, 2)), edge, 2, 1, 120).strike?.marks ?? [];
    expect(kept.every((mark) => mark <= levelTiles * tile - 2 * tile)).toBe(
      true,
    );
  });
});
