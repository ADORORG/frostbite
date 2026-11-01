import { describe, expect, it } from "vitest";

import { freshPlasma } from "../src/rules/plasma.ts";
import {
  aimHigh,
  aimLow,
  aimStart,
  cell,
  charmCount,
  eggCount,
  fieldGround,
  fieldWidth,
  launchTicks,
  launcherX,
  launcherY,
  open,
  partCount,
  powerHigh,
  powerLow,
  powerStart,
  size,
  swiftSpeed,
  walkSpeed,
} from "../src/rules/woods/constants.ts";
import { startWoods, woodsChapter } from "../src/rules/woods/index.ts";
import {
  launchEgg,
  startLaunch,
  tickLaunch,
} from "../src/rules/woods/launch.ts";
import { distances, generateWoods, indexOf } from "../src/rules/woods/maze.ts";
import { woodsEarned } from "../src/rules/woods/milestones.ts";
import { tickWoods } from "../src/rules/woods/tick.ts";
import type { Place, WoodsState } from "../src/rules/woods/types.ts";
import { gateOpen } from "../src/rules/woods/walk.ts";

const seeds = [3, 11, 77, 20_261_031, 1_989_854];
const at = (state: WoodsState, place: Place): WoodsState => ({
  ...state,
  x: place.x * cell + cell / 2,
  y: place.y * cell + cell / 2,
});
const all = (count: number) => Array.from({ length: count }, () => true);
const still = {
  down: false,
  fire: false,
  left: false,
  right: false,
  up: false,
};
// Out of the woods with `eggs` eggs to launch.
const out = (eggs: number, tick = 500): WoodsState => ({
  ...startWoods(3),
  escaped: true,
  finishTick: tick,
  launch: startLaunch(eggs, 5, tick),
  tick,
});
const play = (state: WoodsState, count: number) => {
  let now = state;
  for (let step = 0; step < count; step += 1) now = tickWoods(now);
  return now;
};

describe("what else hides in the Whispering Woods", () => {
  it("is the launcher's parts and the eggs on the paths, and the secret charms in dead ends, each on its own cell where Glitchy can walk", () => {
    for (const seed of seeds) {
      const level = generateWoods(seed);
      expect([
        level.parts.length,
        level.eggs.length,
        level.charms.length,
      ]).toEqual([partCount, eggCount, charmCount]);
      const far = distances(level.walls, { x: 1, y: 1 });
      const others = [
        level.moonChest,
        ...level.clues,
        ...level.chests,
        ...level.lanterns,
      ];
      const hidden = [...level.parts, ...level.eggs, ...level.charms];
      const cells = new Set(
        [...others, ...hidden].map((p) => indexOf(p.x, p.y)),
      );
      expect(cells.size).toBe(others.length + hidden.length);
      for (const place of hidden) {
        expect(level.walls[indexOf(place.x, place.y)]).toBe(open);
        expect(far[indexOf(place.x, place.y)]).toBeGreaterThan(0);
      }
    }
    expect(generateWoods(8).parts).toEqual(generateWoods(8).parts);
  });

  it("is metaplasma three to an open cell, sorted, and the launch round's targets: three baskets, a high ring and a higher star", () => {
    const level = generateWoods(11);
    const opens = level.walls.filter(
      (wall, index) => wall === open && index !== size + 1,
    ).length;
    expect(level.motes).toHaveLength(3 * opens);
    level.motes.forEach((mote, index) =>
      expect(mote.x).toBeGreaterThanOrEqual(level.motes[index - 1]?.x ?? 0),
    );
    expect(level.targets.map((target) => target.value)).toEqual([
      100, 200, 300, 400, 500,
    ]);
    for (const target of level.targets) {
      expect(target.x).toBeGreaterThan(launcherX);
      expect(target.x + target.width).toBeLessThan(fieldWidth);
      expect(target.y + target.height).toBeLessThanOrEqual(fieldGround);
    }
    expect(
      level.targets
        .slice(0, 3)
        .every((target) => target.y + target.height === fieldGround),
    ).toBe(true);
    expect(level.targets[4]?.y ?? 0).toBeLessThan(level.targets[3]?.y ?? 0);
  });

  it("is picked up when Glitchy comes close, saying what it was, and the last part builds the launcher", () => {
    const start = startWoods(11);
    const { charms, eggs, parts } = start.level;
    const found = (state: WoodsState, place: Place | undefined) =>
      tickWoods(at(state, place ?? { x: 1, y: 1 }));
    const part = found(start, parts[0]);
    expect(part.parts).toEqual([true, false, false, false]);
    expect(part.found?.kind).toBe("part");
    const built = found(
      { ...start, parts: [true, true, true, false] },
      parts[3],
    );
    expect(built.parts).toEqual(all(partCount));
    expect(built.found?.kind).toBe("launcher");
    expect(found(start, eggs[4]).eggs.filter(Boolean)).toHaveLength(1);
    expect(found(start, eggs[4]).found?.kind).toBe("egg");
    const charm = found(start, charms[1]);
    expect(charm.charms).toEqual([false, true, false]);
    expect(charm.found?.kind).toBe("charm");
    expect(tickWoods(part).parts).toBe(part.parts);
  });

  it("speeds Glitchy up with the swift charm, and draws metaplasma from much farther with the magnet charm", () => {
    const start = { ...startWoods(11), controls: { ...still, up: true } };
    const stride = (state: WoodsState) => {
      const next = tickWoods(state);
      return Math.round(Math.hypot(next.x - state.x, next.y - state.y));
    };
    expect(stride(start)).toBe(walkSpeed);
    expect(stride({ ...start, charms: [true, false, false] })).toBe(swiftSpeed);
    const mote = { x: start.x + 400, y: start.y };
    const lone = {
      ...startWoods(11),
      level: { ...start.level, motes: [mote] },
      plasma: freshPlasma([mote]),
    };
    expect(tickWoods(lone).plasma.drifting).toEqual([]);
    const drawn = tickWoods({ ...lone, charms: [false, false, true] });
    expect(drawn.plasma.drifting).toHaveLength(1);
    expect(play(drawn, 30).plasma.gathered).toBe(1);
  });

  it("keeps the moon gate shut until every clue stone is read and every launcher part found", () => {
    const start = startWoods(11);
    expect(gateOpen(start)).toBe(false);
    expect(gateOpen({ ...start, clues: all(3) })).toBe(false);
    expect(gateOpen({ ...start, parts: all(partCount) })).toBe(false);
    expect(gateOpen({ ...start, clues: all(3), parts: all(partCount) })).toBe(
      true,
    );
  });
});

describe("the launch round", () => {
  it("begins with the eggs found, the launcher tilted halfway and at middling power, and is over at once with no eggs", () => {
    expect(startLaunch(3, 5, 100)).toEqual({
      aim: aimStart,
      ended: false,
      eggsLeft: 3,
      flying: null,
      hits: [0, 0, 0, 0, 0],
      last: null,
      power: powerStart,
      score: 0,
      start: 100,
    });
    expect(startLaunch(0, 5, 100).ended).toBe(true);
    expect(woodsChapter.done(out(0))).toBe(true);
    expect(woodsChapter.done(out(2))).toBe(false);
  });

  it("tilts the launcher with up and down and sets its power with left and right, within their limits", () => {
    const held = (controls: Partial<typeof still>) =>
      play({ ...out(2), controls: { ...still, ...controls } }, 200).launch;
    expect(held({ up: true })?.aim).toBe(aimHigh);
    expect(held({ down: true })?.aim).toBe(aimLow);
    expect(held({ right: true })?.power).toBe(powerHigh);
    expect(held({ left: true })?.power).toBe(powerLow);
    expect(held({ left: true, right: true })?.power).toBe(powerStart);
  });

  it("launches one egg at a time from the launcher, which falls back down unless it hits a target", () => {
    const launched = woodsChapter.pressed(out(2), "fire");
    expect(launched.launch?.eggsLeft).toBe(1);
    expect(launched.launch?.flying).toMatchObject({
      x: launcherX,
      y: launcherY,
    });
    expect(launchEgg(launched)).toEqual(launched);
    const flying = launched.launch?.flying;
    const next = tickLaunch(launched).launch?.flying;
    expect(next?.vy).toBe((flying?.vy ?? 0) + 4);
    expect(next?.x).toBe(launcherX + (flying?.vx ?? 0));
    const landed = play(
      { ...launched, level: { ...launched.level, targets: [] } },
      200,
    );
    expect(landed.launch?.flying).toBeNull();
    expect(landed.launch?.score).toBe(0);
    expect(launchEgg(startWoods(3))).toEqual(startWoods(3));
  });

  it("scores a target's value for each egg that hits it, and is over once the eggs are all down", () => {
    const launched = launchEgg(out(1));
    const egg = launched.launch?.flying;
    if (egg === null || egg === undefined) throw new Error("no egg");
    // A basket just where the egg will be in a moment.
    const target = {
      height: 64,
      value: 300,
      width: 64,
      x: egg.x + egg.vx - 32,
      y: egg.y + egg.vy - 32,
    };
    const aimed = {
      ...launched,
      level: { ...launched.level, targets: [target] },
    };
    const hit = tickLaunch(aimed);
    expect(hit.launch).toMatchObject({
      ended: true,
      flying: null,
      hits: [1, 0, 0, 0, 0],
      last: { target: 0, tick: hit.tick },
      score: 300,
    });
    expect(woodsChapter.done(hit)).toBe(true);
    expect(tickLaunch(hit).launch).toBe(hit.launch);
    expect(woodsChapter.pressed(hit, "fire")).toEqual(hit);
  });

  it("is over when its time runs out, eggs or not", () => {
    const waiting = out(3, 100);
    expect(play(waiting, launchTicks - 1).launch?.ended).toBe(false);
    expect(play(waiting, launchTicks).launch?.ended).toBe(true);
  });
});

describe("the new marks of the Whispering Woods", () => {
  it("are earned for building the launcher, a thousand bonus points, a secret charm and a great deal of metaplasma", () => {
    const start = startWoods(3);
    expect(woodsEarned({ ...start, parts: all(partCount) })).toEqual([
      "woods-launcher",
    ]);
    const scored = (score: number) => ({
      ...out(0),
      launch: { ...startLaunch(0, 5, 0), score },
    });
    expect(woodsEarned(scored(999))).not.toContain("woods-launch-1000");
    expect(woodsEarned(scored(1000))).toContain("woods-launch-1000");
    expect(woodsEarned({ ...start, charms: [false, false, true] })).toEqual([
      "secret-charm",
    ]);
    expect(
      woodsEarned({ ...start, plasma: { ...start.plasma, gathered: 300 } }),
    ).toEqual(["metaplasma-300"]);
  });
});
