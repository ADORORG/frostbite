import { describe, expect, it } from "vitest";

import {
  closePit,
  closeSolid,
  fallDepth,
  hitInset,
  shardReachX,
  topForgive,
  ballWidth,
} from "../src/rules/constants.ts";
import { recoverTicks } from "../src/rules/spawn.ts";
import { over, tickOnce } from "../src/rules/tick.ts";
import { bare, hop, pit, press, roll, rock } from "./support/states.ts";

// The exact edges of the rules: the nearest a hop may come to a rock before it is hit, the nearest a hop may land to a crevasse's edge to
// count as a close call, how far a shard reaches, and how deep a crevasse is. Each is set up so one sub-unit either way changes the answer.
const speed = 11;

describe("the edge of a rock", () => {
  // A rock at x = 1000, with the snowball arriving at its edge on this tick, at `height` after it.
  const arriving = (height: number) =>
    tickOnce(
      bare({
        ahead: [rock(1_000)],
        distance: 1_000 - (ballWidth - hitInset) + 1 - speed,
        vy: -4,
        y: height + 5,
      }),
    );

  it("is cleared by a snowball whose underside is within the forgiveness of its top, and hit by one lower", () => {
    const top = rock(0).h;
    expect(arriving(top - topForgive).alive).toBe(true);
    expect(arriving(top - topForgive - 1).alive).toBe(false);
  });

  it("is counted as a close call by the lowest a snowball was over it, not the last", () => {
    const lowAtFirst = bare({
      ahead: [rock(300)],
      distance: 300 + 60 - hitInset - speed * 3,
      lowest: closeSolid,
      vy: 0,
      y: 200,
    });
    const past = roll(lowAtFirst, 4);
    expect(past.cleared.rock).toBe(1);
    expect(past.closeCalls).toBe(1);
    const roomy = roll({ ...lowAtFirst, lowest: closeSolid + 1 }, 4);
    expect(roomy.cleared.rock).toBe(1);
    expect(roomy.closeCalls).toBe(0);
  });
});

describe("the edge of a crevasse", () => {
  // The snowball lands on the tick this returns, with the middle of it `margin` beyond the crevasse's far edge.
  const landing = (margin: number) =>
    tickOnce(
      bare({
        distance: 1_000 + margin - ballWidth / 2 - speed,
        pitEnd: 1_000,
        vy: -3,
        y: 3,
      }),
    );

  it("is a close call when the snowball lands within a few pixels of its far edge, and not a sub-unit further", () => {
    expect(landing(closePit).closeCalls).toBe(1);
    expect(landing(closePit + 1).closeCalls).toBe(0);
    expect(landing(closePit).cleared.pit).toBe(1);
  });

  it("ends the run once the snowball has fallen past the depth, and not before", () => {
    let state = bare({ ahead: [pit(0, 5_000)], distance: 100 });
    while (!over(state)) state = tickOnce(state);
    expect(state.cause).toBe("fell");
    expect(state.y).toBeLessThan(-fallDepth);
    // It ends the run on the first tick it is past the depth, which is within one tick's fall of it.
    expect(state.y).toBeGreaterThan(-fallDepth - 25);
  });
});

describe("the reach of a shard", () => {
  const passing = (offset: number) =>
    tickOnce(
      bare({
        distance: 500,
        shards: [{ x: 500 + speed + ballWidth / 2 + offset, y: ballWidth / 2 }],
      }),
    );

  it("is taken at exactly its reach from the middle of the snowball, and missed a sub-unit beyond", () => {
    expect(passing(shardReachX).shardsTaken).toBe(1);
    expect(passing(-shardReachX).shardsTaken).toBe(1);
    expect(passing(shardReachX + 1).shardsTaken).toBe(0);
  });
});

describe("the time between patterns", () => {
  it("is shorter by a tick each level, and never less than the room to land and hop again", () => {
    expect(recoverTicks(0)).toBe(52);
    expect(recoverTicks(1)).toBe(51);
    expect(recoverTicks(18)).toBe(34);
    expect(recoverTicks(19)).toBe(34);
    expect(recoverTicks(30)).toBe(34);
  });
});

describe("the press that is let go of", () => {
  it("does not hop again on landing: only a press, not a release, arms the hop that waits for the snowball to land", () => {
    const landed = hop(bare(), 5);
    expect(landed.hops).toBe(1);
    expect(roll(landed, 20).hops).toBe(1);
    const aloft = press(roll(press(bare(), true), 5), false);
    expect(aloft.buffer).toBe(0);
  });
});
