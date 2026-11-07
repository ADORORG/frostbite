import { describe, expect, it } from "vitest";

import { challenge } from "../src/rules/castle/battle.ts";
import { plasmaReach, stepTicks } from "../src/rules/castle/constants.ts";
import { mapHeight, mapWidth, tileAt } from "../src/rules/castle/map.ts";
import { castleMotes } from "../src/rules/castle/motes.ts";
import { charmSpots, start } from "../src/rules/castle/places.ts";
import {
  pressCastle,
  standingAt,
  startCastle,
  tickCastle,
} from "../src/rules/castle/tick.ts";
import type { CastleState } from "../src/rules/castle/types.ts";

const floor = new Set([".", ",", "f", "s", "c"]);
const play = (state: CastleState, count: number) => {
  let now = state;
  for (let tick = 0; tick < count; tick += 1) now = tickCastle(now);
  return now;
};

describe("the guild's land", () => {
  it("has metaplasma over every tile Glitchy can walk on, a little off its middle, sorted", () => {
    let tiles = 0;
    for (let y = 0; y < mapHeight; y += 1)
      for (let x = 0; x < mapWidth; x += 1)
        if (floor.has(tileAt(x, y))) tiles += 1;
    expect(castleMotes).toHaveLength(tiles);
    castleMotes.forEach((mote, at) => {
      expect(mote.x).toBeGreaterThanOrEqual(castleMotes[at - 1]?.x ?? 0);
      const x = Math.floor(mote.x / 16);
      const y = Math.floor(mote.y / 16);
      expect(floor.has(tileAt(x, y))).toBe(true);
    });
  });

  it("draws metaplasma to Glitchy from where it stands, part way along a step", () => {
    const begin = startCastle(2);
    expect(standingAt(begin)).toEqual({
      x: start.x * 16 + 8,
      y: start.y * 16 + 8,
    });
    const stepping = {
      ...begin,
      step: { from: { x: start.x - 1, y: start.y }, start: 0 },
      tick: stepTicks / 2,
    };
    expect(standingAt(stepping)).toEqual({
      x: start.x * 16,
      y: start.y * 16 + 8,
    });
    expect(standingAt({ ...stepping, tick: 99 })).toEqual(standingAt(begin));
    const near = castleMotes.filter(
      (mote) =>
        Math.abs(mote.x - (start.x * 16 + 8)) <= plasmaReach &&
        Math.abs(mote.y - (start.y * 16 + 8)) <= plasmaReach,
    );
    expect(near.length).toBeGreaterThan(0);
    expect(play(begin, 30).plasma.gathered).toBe(near.length);
  });

  it("hides a secret charm on each of its spots, found by stepping onto it, once", () => {
    charmSpots.forEach((spot, charm) => {
      const arriving = {
        ...startCastle(2),
        step: { from: { x: spot.x, y: spot.y - 1 }, start: 0 },
        tick: stepTicks - 1,
        x: spot.x,
        y: spot.y,
      };
      const found = tickCastle(arriving);
      expect(found.charms[charm]).toBe(true);
      expect(found.charms.filter(Boolean)).toHaveLength(1);
      expect(found.message?.id).toBe(`found-charm-${String(charm)}`);
      const again = tickCastle({ ...arriving, charms: found.charms });
      expect(again.message?.id).not.toBe(`found-charm-${String(charm)}`);
    });
  });

  it("takes the hotkeys only in a cheer challenge: out of one they do nothing at all", () => {
    const begin = startCastle(2);
    for (const control of [
      "show1",
      "show5",
      "quick",
      "evade",
      "charm",
    ] as const)
      expect(pressCastle(begin, control)).toBe(begin);
    const asked = challenge({ ...begin, friends: [true, true, true, true] }, 0);
    expect(pressCastle(asked, "quick").battle?.phase).toBe("show");
  });
});
