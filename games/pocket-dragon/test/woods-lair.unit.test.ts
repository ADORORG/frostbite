import { describe, expect, it } from "vitest";

import { defu, hallRows, hatchery } from "../src/rules/woods/base-map.ts";
import {
  countdownTicks,
  eggSpeed,
  guardStep,
  hatchEvery,
  hatchFirst,
  laserEvery,
  laserOn,
  laserWarn,
  mostShadows,
  shadowStep,
  waveEvery,
  waveFirst,
  waveReach,
  waveStep,
  waveWarn,
} from "../src/rules/woods/constants.ts";
import { eggFlies, guardsMove, shadowsMove } from "../src/rules/woods/foes.ts";
import { woodsDone } from "../src/rules/woods/index.ts";
import {
  countdownLeft,
  fromDefu,
  laserPhase,
  lairTick,
} from "../src/rules/woods/lair.ts";
import { waveAt } from "../src/rules/woods/lair.ts";
import { sceneTicks } from "../src/rules/woods/scenes.ts";
import type { BaseGuard } from "../src/rules/woods/types.ts";
import {
  baseOf,
  inLair,
  outside,
  playFor,
  press,
} from "./support/woods-outside.ts";

const guardAt = (
  x: number,
  y: number,
  more: Partial<BaseGuard> = {},
): BaseGuard => ({
  dizzy: 0,
  moved: -guardStep,
  route: 0,
  toward: 1,
  x,
  y,
  ...more,
});

describe("DeFu's guards in the woods", () => {
  it("walk their routes to and fro, chase Glitchy when it comes close, and bump it for a heart (then stand dizzy a while)", () => {
    const walking = outside({ guards: [guardAt(2, 15)] });
    const stepped = guardsMove(walking, baseOf(walking));
    expect(baseOf(stepped).guards[0]).toMatchObject({ moved: 0, x: 3, y: 15 });
    expect(baseOf(guardsMove(stepped, baseOf(stepped))).guards[0]?.x).toBe(3);
    const atEnd = outside({ guards: [guardAt(7, 15)] });
    expect(baseOf(guardsMove(atEnd, baseOf(atEnd))).guards[0]).toMatchObject({
      toward: 0,
      x: 8,
    });
    const near = outside({ guards: [guardAt(9, 26)], x: 12, y: 26 });
    expect(baseOf(guardsMove(near, baseOf(near))).guards[0]).toMatchObject({
      x: 10,
      y: 26,
    });
    const next = outside({ guards: [guardAt(11, 26)] });
    const bumped = guardsMove(next, baseOf(next));
    expect(bumped.hearts).toBe(next.hearts - 1);
    expect(baseOf(bumped).guards[0]).toMatchObject({
      dizzy: guardStep * 6,
      x: 11,
    });
    const dizzy = outside({ guards: [guardAt(11, 26, { dizzy: 5 })] });
    expect(baseOf(guardsMove(dizzy, baseOf(dizzy))).guards[0]).toMatchObject({
      dizzy: 4,
      x: 11,
    });
  });
});

describe("DeFu's lair", () => {
  it("hatches a shadow dragon at the factory's door soon after it begins and then every so often, up to a few, until the valves break", () => {
    const at = (tick: number, more = {}) => {
      const state = inLair({ x: 20, y: 9, ...more }, { tick });
      return baseOf(shadowsMove(state, baseOf(state)));
    };
    expect(at(hatchFirst - 1).shadows).toEqual([]);
    expect(at(hatchFirst)).toMatchObject({
      hatched: 1,
      shadows: [{ x: hatchery.x, y: hatchery.y }],
    });
    expect(at(hatchFirst + hatchEvery).hatched).toBe(1);
    expect(at(hatchFirst + 1).hatched).toBe(0);
    const crowd = Array.from({ length: mostShadows }, () => ({
      moved: 9_999,
      x: 20,
      y: 1,
    }));
    expect(at(hatchFirst, { shadows: crowd }).hatched).toBe(0);
    expect(at(hatchFirst, { broken: [true, true, true] }).hatched).toBe(0);
    expect(at(hatchFirst, { x: hatchery.x, y: hatchery.y }).hatched).toBe(0);
  });

  it("sends its shadow dragons after Glitchy, a tile at a time, and a shadow dragon that reaches Glitchy bumps it", () => {
    const chasing = inLair(
      { shadows: [{ moved: 0, x: 10, y: 5 }], x: 14, y: 8 },
      { tick: shadowStep },
    );
    expect(
      baseOf(shadowsMove(chasing, baseOf(chasing))).shadows[0],
    ).toMatchObject({ x: 10, y: 6 });
    const resting = { ...chasing, tick: shadowStep - 1 };
    expect(
      baseOf(shadowsMove(resting, baseOf(resting))).shadows[0],
    ).toMatchObject({ x: 10, y: 5 });
    const close = inLair(
      { shadows: [{ moved: 0, x: 14, y: 7 }], x: 14, y: 8 },
      { tick: shadowStep },
    );
    const bumped = shadowsMove(close, baseOf(close));
    expect(bumped.hearts).toBe(close.hearts - 1);
    expect(baseOf(bumped).shadows[0]).toMatchObject({
      moved: shadowStep * 5,
      x: 14,
      y: 7,
    });
  });

  it("lets a launched egg fly a tile every few ticks, over water, until it hits someone or a valve, or meets a tree or its range", () => {
    const flight = { dx: -1, dy: 0, left: 6, moved: 0, x: 12, y: 26 };
    const early = outside({ flight }, { tick: eggSpeed - 1 });
    expect(baseOf(eggFlies(early, baseOf(early))).flight).toEqual(flight);
    const flying = outside({ flight }, { tick: eggSpeed });
    expect(baseOf(eggFlies(flying, baseOf(flying))).flight).toMatchObject({
      left: 5,
      x: 11,
    });
    const lastTile = outside(
      { flight: { ...flight, left: 1 } },
      { tick: eggSpeed },
    );
    expect(baseOf(eggFlies(lastTile, baseOf(lastTile))).flight).toBeNull();
    const tree = outside(
      { flight: { ...flight, dx: 0, dy: 1 } },
      { tick: eggSpeed },
    );
    expect(baseOf(eggFlies(tree, baseOf(tree))).flight).toBeNull();
    const pond = outside(
      { flight: { ...flight, x: 15, y: 20 } },
      { tick: eggSpeed },
    );
    expect(baseOf(eggFlies(pond, baseOf(pond))).flight).toMatchObject({
      x: 14,
      y: 20,
    });
    const guard = outside(
      { flight, guards: [guardAt(11, 26)] },
      { tick: eggSpeed },
    );
    expect(baseOf(eggFlies(guard, baseOf(guard)))).toMatchObject({
      flight: null,
      guards: [{ dizzy: 200 }],
    });
    const valve = inLair(
      { flight: { ...flight, x: 4, y: 4 } },
      { tick: eggSpeed },
    );
    expect(baseOf(eggFlies(valve, baseOf(valve))).broken[0]).toBe(true);
  });

  it("aims DeFu's laser along Glitchy's row (the hall's last row from the dungeon), then its column, and burns only on that line in the hall", () => {
    const glow = laserEvery - laserOn - laserWarn;
    const lair = inLair({ x: 6, y: 8 });
    expect(laserPhase(baseOf(lair), glow - 1)).toBeNull();
    expect(laserPhase(baseOf(lair), glow)).toBe("glow");
    expect(laserPhase(baseOf(lair), glow + laserWarn)).toBe("burn");
    expect(laserPhase(baseOf(lair), laserEvery)).toBeNull();
    expect(laserPhase(baseOf(outside()), glow)).toBeNull();
    expect(laserPhase(baseOf(inLair({ lairStart: 100 })), 99)).toBeNull();
    const aim = (tick: number, x: number, y: number) => {
      const state = inLair({ x, y }, { tick });
      return baseOf(lairTick(state, baseOf(state))).laser;
    };
    expect(aim(glow, 6, 8)).toEqual({ horizontal: true, line: 8 });
    expect(aim(glow, 6, 11)).toEqual({ horizontal: true, line: hallRows });
    expect(aim(laserEvery + glow, 6, 8)).toEqual({
      horizontal: false,
      line: 6,
    });
    expect(aim(1, 6, 8)).toBeNull();
    const burning = (x: number, y: number) => {
      const state = inLair(
        { laser: { horizontal: true, line: 8 }, x, y },
        { tick: glow + laserWarn },
      );
      return lairTick(state, baseOf(state)).hearts - state.hearts;
    };
    expect(burning(3, 8)).toBe(-1);
    expect(burning(3, 7)).toBe(0);
    expect(burning(3, 11)).toBe(0);
    const stale = inLair({ laser: { horizontal: true, line: 8 } }, { tick: 5 });
    expect(baseOf(lairTick(stale, baseOf(stale))).laser).toBeNull();
  });

  it("sends DeFu's shockwave out from her platform a tile at a time after a warning, and it hurts where it is, in the hall", () => {
    const lair = baseOf(inLair());
    expect(waveAt(lair, waveFirst - 1)).toBeNull();
    expect(waveAt(lair, waveFirst)).toBe(0);
    expect(waveAt(lair, waveFirst + waveWarn)).toBe(1);
    expect(waveAt(lair, waveFirst + waveWarn + waveStep)).toBe(2);
    expect(
      waveAt(lair, waveFirst + waveWarn + waveStep * waveReach),
    ).toBeNull();
    expect(waveAt(lair, waveFirst + waveEvery)).toBe(0);
    expect(waveAt(baseOf(outside()), waveFirst)).toBeNull();
    expect(fromDefu(defu.x + 3, defu.y - 1)).toBe(3);
    const tick = waveFirst + waveWarn + waveStep * 2;
    const ringed = (x: number, y: number) => {
      const state = inLair({ x, y }, { tick });
      return lairTick(state, baseOf(state)).hearts - state.hearts;
    };
    expect(ringed(defu.x + 3, defu.y + 1)).toBe(-1);
    expect(ringed(defu.x + 4, defu.y + 1)).toBe(0);
  });

  it("counts down from the end of DeFu's scene, and launches the rocket when the count runs out", () => {
    expect(countdownLeft(baseOf(outside()), 9_000)).toBe(countdownTicks);
    expect(countdownLeft(baseOf(inLair({ lairStart: 400 })), 100)).toBe(
      countdownTicks,
    );
    expect(countdownLeft(baseOf(inLair()), 1_000)).toBe(countdownTicks - 1_000);
    const late = inLair({ x: 13, y: 12 }, { tick: countdownTicks });
    const launched = lairTick(late, baseOf(late));
    expect(launched).toMatchObject({
      outcome: "launched",
      scene: { id: "launch", start: countdownTicks },
    });
    expect(woodsDone(playFor(launched, sceneTicks.launch))).toBe(true);
  });
});

describe("the scenes of the woods", () => {
  it("play for their length (only the clock moves), can be skipped with the action key, and DeFu's lair begins when hers ends", () => {
    const playing = outside(
      { x: 13, y: 13 },
      { scene: { id: "rise", start: 0 } },
    );
    const held = press(playing, "up");
    expect(baseOf(playFor(held, 50))).toMatchObject({ step: null, y: 13 });
    expect(playFor(held, sceneTicks.rise).scene).toBeNull();
    expect(press(playing, "fire")).toMatchObject({
      breaths: 0,
      scene: { id: "rise" },
    });
    expect(press(playing, "act").scene).toBeNull();
    const lair = outside(
      { lairStart: 370 },
      { scene: { id: "lair", start: 10 }, tick: 40 },
    );
    const skipped = press(lair, "act");
    expect(skipped.scene).toBeNull();
    expect(baseOf(skipped).lairStart).toBe(40);
    const watched = playFor(lair, 400);
    expect(baseOf(watched).lairStart).toBe(370);
    const over = { ...inLair(), outcome: "launched" as const, tick: 5 };
    expect(baseOf(playFor(over, 3))).toEqual(baseOf(over));
  });
});
