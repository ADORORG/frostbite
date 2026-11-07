import { describe, expect, it } from "vitest";

import { maxHearts } from "../src/rules/constants.ts";
import { hurt, startBase } from "../src/rules/woods/base.ts";
import {
  bubbleSpot,
  cages,
  chests,
  guardRoutes,
  heartSpot,
  lairGate,
  panels,
  valves,
} from "../src/rules/woods/base-map.ts";
import {
  baseStep,
  dizzyTicks,
  eggRange,
  fireEvery,
  forceTicks,
  invulnerableTicks,
  launchEvery,
} from "../src/rules/woods/constants.ts";
import { woodsDone } from "../src/rules/woods/index.ts";
import { sceneTicks } from "../src/rules/woods/scenes.ts";
import {
  baseOf,
  inLair,
  maze,
  outside,
  playFor,
  press,
} from "./support/woods-outside.ts";

describe("the woods outside the maze", () => {
  it("begin where the maze's path comes out, with the eggs found in the maze to launch and nothing done yet", () => {
    const base = startBase({ ...maze, eggs: maze.eggs.map((_, at) => at < 4) });
    expect(base).toMatchObject({
      allies: [false, false, false],
      ammo: 4,
      broken: [false, false, false],
      facing: "up",
      lairStart: -1,
      pieces: [false, false, false],
      x: 12,
      y: 26,
    });
    expect(base.guards.map(({ x, y }) => ({ x, y }))).toEqual(
      guardRoutes.map(([from]) => from),
    );
  });

  it("are walked a tile every few ticks while a way is held, on from tile to tile, turning only toward what cannot be walked into", () => {
    const stepping = playFor(press(outside(), "up"), 1);
    expect(baseOf(stepping)).toMatchObject({
      facing: "up",
      step: { from: { x: 12, y: 26 }, start: 1 },
      y: 25,
    });
    const next = playFor(stepping, baseStep);
    expect(baseOf(next)).toMatchObject({
      step: { from: { x: 12, y: 25 }, start: 1 + baseStep },
      y: 24,
    });
    expect(baseOf(next).trail).toEqual([
      { x: 12, y: 25 },
      { x: 12, y: 26 },
    ]);
    const stopped = playFor(press(next, "up", false), baseStep);
    expect(baseOf(stopped)).toMatchObject({ step: null, x: 12, y: 24 });
    const tree = playFor(press(outside(), "down"), 20);
    expect(baseOf(tree)).toMatchObject({ facing: "down", step: null, y: 26 });
  });

  it("free a caged dragon (a heart more, up to five), open a chest for a rocket key, and with nothing to use launch an egg", () => {
    const cage = cages.findIndex(({ x, y }) => x === 12 && y === 22);
    const facingCage = outside({ facing: "up", x: 12, y: 23 });
    const freed = press(facingCage, "act");
    expect(baseOf(freed).allies[cage]).toBe(true);
    expect(freed.hearts).toBe(facingCage.hearts + 1);
    expect(freed.found).toEqual({ kind: "ally", tick: 0 });
    expect(press({ ...facingCage, hearts: maxHearts }, "act").hearts).toBe(
      maxHearts,
    );
    const chest = chests.findIndex(({ x, y }) => x === 7 && y === 21);
    const opened = press(outside({ facing: "up", x: 7, y: 22 }), "act");
    expect(baseOf(opened).pieces[chest]).toBe(true);
    expect(opened.found?.kind).toBe("key");
    const thrown = press(outside({ ammo: 2, facing: "left" }), "act");
    expect(baseOf(thrown)).toMatchObject({
      ammo: 1,
      flight: { dx: -1, dy: 0, left: eggRange, x: 12, y: 26 },
      launchTick: 0,
    });
    const soon = press(playFor(press(thrown, "act", false), 20), "act");
    expect(baseOf(soon).ammo).toBe(1);
    const later = press(
      playFor(press(thrown, "act", false), launchEvery),
      "act",
    );
    expect(baseOf(later).ammo).toBe(0);
    expect(
      baseOf(press(outside({ ammo: 0, facing: "left" }), "act")).flight,
    ).toBeNull();
  });

  it("breathe fire at the tile ahead: a guard is dizzy and, hit again, goes home; a shadow dragon is set free; a valve breaks", () => {
    const guard = {
      dizzy: 0,
      moved: 0,
      route: 0,
      toward: 1 as const,
      x: 12,
      y: 25,
    };
    const dizzy = press(outside({ guards: [guard] }), "fire");
    expect(baseOf(dizzy).guards[0]?.dizzy).toBe(dizzyTicks);
    expect(dizzy).toMatchObject({ breathTick: 0, breaths: 1 });
    const again = (wait: number) =>
      press(press(playFor(dizzy, wait), "fire", false), "fire");
    expect(again(fireEvery - 1).breaths).toBe(1);
    const home = again(fireEvery);
    expect(baseOf(home)).toMatchObject({ cheered: 1, guards: [] });
    expect(home.found?.kind).toBe("home");
    const shadows = [{ moved: 0, x: 12, y: 25 }];
    const freed = press(inLair({ shadows }), "fire");
    expect(baseOf(freed)).toMatchObject({ freed: 1, shadows: [] });
    expect(freed.found?.kind).toBe("freed");
    const valve = valves.findIndex(({ x, y }) => x === 3 && y === 4);
    const burst = press(inLair({ x: 3, y: 5 }), "fire");
    expect(baseOf(burst).broken[valve]).toBe(true);
    expect(burst.found?.kind).toBe("valve");
    expect(baseOf(press(burst, "fire", false)).broken[valve]).toBe(true);
  });

  it("keep DeFu's shield on the rocket until the factory's three valves are broken, then defuse it with the third key", () => {
    const panel = panels.findIndex(({ x, y }) => x === 12 && y === 5);
    const shielded = press(inLair({ x: 12, y: 6 }), "act");
    expect(baseOf(shielded).installed).toEqual([false, false, false]);
    expect(shielded.found).toEqual({ kind: "shielded", tick: 0 });
    const down = { broken: [true, true, true], x: 12, y: 6 };
    const fitted = press(inLair(down), "act");
    expect(baseOf(fitted).installed[panel]).toBe(true);
    expect(fitted).toMatchObject({ found: { kind: "panel" }, outcome: null });
    const others = panels.map((_, at) => at !== panel);
    const last = press(
      inLair({ ...down, installed: others }, { tick: 500 }),
      "act",
    );
    expect(last).toMatchObject({
      finishTick: 500,
      outcome: "defused",
      scene: { id: "peace", start: 500 },
    });
    expect(woodsDone(last)).toBe(false);
    const skipped = press(press(last, "act", false), "act");
    expect(skipped.scene).toBeNull();
    expect(woodsDone(skipped)).toBe(true);
    expect(woodsDone(playFor(last, sceneTicks.peace))).toBe(true);
  });

  it("give the forcefield and the extra heart for walking onto them, and let Glitchy through the lair's gate only with the three keys", () => {
    const onto = (x: number, y: number, more = {}) =>
      playFor(press(outside({ x, y: y + 1, ...more }), "up"), 1 + baseStep);
    const bubble = onto(bubbleSpot.x, bubbleSpot.y);
    expect(baseOf(bubble)).toMatchObject({
      bubbleTaken: true,
      forcefield: forceTicks,
    });
    expect(bubble.found?.kind).toBe("bubble");
    const heart = onto(heartSpot.x, heartSpot.y);
    expect(baseOf(heart).heartTaken).toBe(true);
    expect(heart).toMatchObject({
      found: { kind: "heart" },
      hearts: maze.hearts + 1,
    });
    const shut = onto(lairGate.x, lairGate.y);
    expect(baseOf(shut)).toMatchObject({ lairStart: -1, y: lairGate.y + 1 });
    const open = onto(lairGate.x, lairGate.y, { pieces: [true, true, true] });
    expect(baseOf(open)).toMatchObject({
      lairStart: 1 + baseStep + sceneTicks.lair,
      y: lairGate.y,
    });
    expect(open.scene).toEqual({ id: "lair", start: 1 + baseStep });
  });

  it("cost a heart for a bump, unless Glitchy is blinking from the last or has the forcefield; with no hearts left the rocket launches", () => {
    const state = outside();
    const bumped = hurt(state, baseOf(state));
    expect(bumped).toMatchObject({ hearts: state.hearts - 1, heartsLost: 1 });
    expect(baseOf(bumped).invulnerable).toBe(invulnerableTicks);
    expect(hurt(bumped, baseOf(bumped)).hearts).toBe(bumped.hearts);
    const shielded = outside({ forcefield: 10 });
    expect(hurt(shielded, baseOf(shielded)).hearts).toBe(shielded.hearts);
    const last = outside({}, { hearts: 1 });
    const gone = hurt(last, baseOf(last));
    expect(gone).toMatchObject({
      hearts: 0,
      outcome: "launched",
      scene: { id: "launch", start: 0 },
    });
    expect(woodsDone(gone)).toBe(false);
    expect(woodsDone(playFor(gone, sceneTicks.launch))).toBe(true);
  });
});
