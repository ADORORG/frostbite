import { describe, expect, it } from "vitest";

import {
  ballWidth,
  courseUnits,
  hopPeak,
  hopTicks,
  maxTicks,
  rockHeight,
  rockWidth,
} from "../src/rules/constants.ts";
import { advanceTo, heightAt, over, tickOnce } from "../src/rules/tick.ts";
import { withRocks } from "./support/states.ts";

describe("a hop", () => {
  it("is on the snow at both ends, peaks in the middle, and is the same going up as coming down", () => {
    expect(heightAt(0)).toBe(0);
    expect(heightAt(hopTicks)).toBe(0);
    expect(heightAt(hopTicks / 2)).toBe(hopPeak);
    for (let air = 1; air < hopTicks; air += 1)
      expect(heightAt(air)).toBe(heightAt(hopTicks - air));
  });
});

describe("a tick", () => {
  it("rolls the snowball on and counts the tick", () => {
    const next = tickOnce(withRocks([]));
    expect(next.tick).toBe(1);
    expect(next.distance).toBeGreaterThan(0);
  });

  it("does nothing to a run that is over", () => {
    for (const state of [
      withRocks([], { alive: false }),
      withRocks([], { finished: true }),
      withRocks([], { ended: true }),
    ]) {
      expect(over(state)).toBe(true);
      expect(tickOnce(state)).toBe(state);
    }
  });

  it("carries a hop through its ticks and puts the snowball back on the snow", () => {
    let state = withRocks([], { air: 1 });
    const heights: number[] = [];
    for (let at = 0; at < hopTicks - 1; at += 1) {
      state = tickOnce(state);
      heights.push(state.air);
    }
    expect(heights[0]).toBe(2);
    expect(heights.at(-2)).toBe(hopTicks - 1);
    expect(heights.at(-1)).toBe(0);
    expect(state.air).toBe(0);
  });

  it("ends the run at a rock the snowball is on the snow at", () => {
    const state = withRocks([40]);
    const end = advanceTo(state, 100);
    expect(end.alive).toBe(false);
    expect(over(end)).toBe(true);
    expect(end.cleared).toBe(0);
  });

  it("clears a rock hopped over, and counts it once it is behind", () => {
    let state = withRocks([60], { air: 1 });
    state = advanceTo({ ...state, distance: 20 }, 40);
    expect(state.alive).toBe(true);
    expect(state.cleared).toBe(1);
    expect(state.lowestClearance).toBeNull();
  });

  it("counts a close call only when the rock was cleared by little", () => {
    // Over the rock at its top edge: clearance is what the hop gives at that tick.
    const low = withRocks([100], {
      air: 2,
      distance: 100 - ballWidth - 1,
    });
    const tall = withRocks([100], {
      air: 10,
      distance: 100 - ballWidth - 1,
    });
    const closeOnes = advanceTo(low, 20);
    const clearOnes = advanceTo(tall, 20);
    expect(closeOnes.alive).toBe(true);
    expect(closeOnes.closeCalls).toBe(1);
    expect(clearOnes.alive).toBe(true);
    expect(clearOnes.cleared).toBe(1);
    expect(clearOnes.closeCalls).toBe(0);
  });

  it("treats a rock's edges exactly: touching the edge is not a hit, one unit in is", () => {
    const edge = withRocks([100], { distance: 100 - ballWidth - 4 });
    // Speed is 4: after one tick the snowball's front is exactly at the rock.
    expect(tickOnce(edge).alive).toBe(true);
    const inside = withRocks([100], { distance: 100 - ballWidth - 3 });
    expect(tickOnce(inside).alive).toBe(false);
    const behind = withRocks([100], { distance: 100 + rockWidth - 4 });
    expect(tickOnce(behind).cleared).toBe(1);
    const justBehind = withRocks([100], { distance: 100 + rockWidth - 5 });
    expect(tickOnce(justBehind).alive).toBe(false);
    expect(rockHeight).toBeGreaterThan(0);
  });

  it("finishes at the foot of the slope and no further", () => {
    const end = advanceTo(withRocks([]), maxTicks);
    expect(end.finished).toBe(true);
    expect(end.distance).toBeGreaterThanOrEqual(courseUnits);
    expect(end.tick).toBeLessThan(maxTicks);
    expect(tickOnce(end)).toBe(end);
  });

  it("never goes past the longest a run may be", () => {
    const state = withRocks([], { tick: maxTicks - 5 });
    expect(advanceTo(state, 10 ** 6).tick).toBe(maxTicks);
  });
});
