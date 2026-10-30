import { describe, expect, it } from "vitest";

import {
  baseSpeed,
  bufferTicks,
  coyoteTicks,
  cutSpeed,
  fallDepth,
  jumpSpeed,
  maxTicks,
} from "../src/rules/constants.ts";
import { advanceTo, over, tickOnce } from "../src/rules/tick.ts";
import { bare, hop, pit, press, roll } from "./support/states.ts";

// The most a hop climbs is the sum of its climb each tick: one less each tick, from one less than it started.
const climb = (speed: number): number => (speed * (speed - 1)) / 2;

describe("the snowball on the snow", () => {
  it("rolls on at the base speed, and stays on the snow", () => {
    const state = tickOnce(bare());
    expect(state.distance).toBe(baseSpeed);
    expect(state.tick).toBe(1);
    expect([state.y, state.vy, state.air, state.coyote]).toEqual([
      0,
      0,
      0,
      coyoteTicks,
    ]);
  });

  it("goes nowhere once the run is over", () => {
    const dead = bare({ alive: false });
    expect(over(dead)).toBe(true);
    expect(tickOnce(dead)).toBe(dead);
    const closed = bare({ ended: true });
    expect(tickOnce(closed)).toBe(closed);
    expect(advanceTo(closed, 50)).toBe(closed);
  });

  it("ends a run that has lasted as long as a run may", () => {
    const last = tickOnce(bare({ tick: maxTicks - 1 }));
    expect(last.ended).toBe(true);
    expect(last.tick).toBe(maxTicks);
    expect(advanceTo(bare(), maxTicks + 500).tick).toBe(maxTicks);
  });
});

describe("a hop", () => {
  it("leaves the snow on the tick after the press, at the hop's speed less gravity", () => {
    const state = tickOnce(press(bare(), true));
    expect(state.hops).toBe(1);
    expect(state.vy).toBe(jumpSpeed - 1);
    expect(state.y).toBe(jumpSpeed - 1);
    expect(state.air).toBe(1);
    expect(state.coyote).toBe(0);
  });

  it("climbs as high as the button is held: a hold to the top climbs all the way, and a tap barely lifts", () => {
    let held = press(bare(), true);
    for (let tick = 0; tick < jumpSpeed + 2; tick += 1) held = tickOnce(held);
    expect(held.peak).toBe(climb(jumpSpeed));
    const tapped = hop(bare(), 0);
    expect(tapped.peak).toBe(climb(cutSpeed));
  });

  it("is cut short when the button is let go of on the way up, and not when it is let go of on the way down", () => {
    const up = roll(press(bare(), true), 4);
    const cut = press(up, false);
    expect(up.vy).toBeGreaterThan(cutSpeed);
    expect(cut.vy).toBe(cutSpeed);
    const falling = roll(press(bare(), true), jumpSpeed + 3);
    expect(falling.vy).toBeLessThan(0);
    expect(press(falling, false).vy).toBe(falling.vy);
  });

  it("comes down by gravity and lands back on the snow with the air time counted", () => {
    const landed = hop(bare(), 100);
    expect(landed.y).toBe(0);
    expect(landed.vy).toBe(0);
    expect(landed.air).toBe(0);
    expect(landed.longest).toBe(2 * jumpSpeed - 2);
  });

  it("does not hop in mid-air, and a press kept down hops once", () => {
    const aloft = roll(press(bare(), true), 5);
    expect(aloft.hops).toBe(1);
    const again = roll(press(press(aloft, false), true), 3);
    expect(again.hops).toBe(1);
  });

  it("hops on landing for a press made up to `bufferTicks` before it, and not for one made earlier", () => {
    const aloft = (early: number) => {
      let state = roll(press(bare(), true), 3);
      state = press(state, false);
      while (state.y > 0 || state.vy > 0) {
        const left = ticksToLand(state);
        if (left === early) break;
        state = tickOnce(state);
      }
      return roll(press(state, true), early + 3);
    };
    const ticksToLand = (state: ReturnType<typeof bare>): number => {
      let probe = state;
      let count = 0;
      while (probe.y > 0 || probe.vy > 0) {
        probe = tickOnce(probe);
        count += 1;
      }
      return count;
    };
    expect(aloft(bufferTicks - 2).hops).toBe(2);
    expect(aloft(bufferTicks + 6).hops).toBe(1);
  });
});

describe("a crevasse", () => {
  const edge = (width = 400) =>
    bare({ ahead: [pit(200, width)], distance: 150 });

  it("drops the snowball that rolls into it, and ends the run when it is far enough down", () => {
    let state = edge();
    while (!over(state)) state = tickOnce(state);
    expect(state.alive).toBe(false);
    expect(state.cause).toBe("fell");
    expect(state.y).toBeLessThan(-fallDepth);
  });

  it("lets the snowball hop for `coyoteTicks` after it has rolled off the edge, and not after", () => {
    let state = edge();
    while (state.y >= 0) state = tickOnce(state);
    const early = roll(press(state, true), 2);
    expect(early.hops).toBe(1);
    let late = edge();
    while (late.y >= 0) late = tickOnce(late);
    late = roll(late, coyoteTicks + 1);
    expect(tickOnce(press(late, true)).hops).toBe(0);
  });

  it("is cleared by a hop across it, and counted when the snowball lands on the far side", () => {
    let state = edge(300);
    state = roll(press(state, true), 30);
    while (state.y > 0 || state.vy > 0) state = tickOnce(state);
    expect(state.alive).toBe(true);
    expect(state.cleared.pit).toBe(1);
    expect(state.pitEnd).toBeNull();
    expect(state.distance + 24).toBeGreaterThanOrEqual(500);
  });

  it("is not counted for a snowball that has not crossed it", () => {
    const state = roll(edge(), 3);
    expect(state.cleared.pit).toBe(0);
    expect(state.pitEnd).toBe(600);
  });
});
