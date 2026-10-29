import { describe, expect, it } from "vitest";

import { jumpPeak, jumpTicks, slideTicks } from "../src/rules/constants.ts";
import {
  heightOf,
  hits,
  lastsFor,
  overlaps,
  progress,
  touches,
} from "../src/rules/physics.ts";
import type { Action } from "../src/rules/types.ts";
import { icicle, shard, spike } from "./support/states.ts";

const none: Action = { kind: "none", tick: 0 };
const jump = (tick: number): Action => ({ kind: "jump", tick });
const slideAt = (tick: number): Action => ({ kind: "slide", tick });

describe("a jump", () => {
  it("is on the ground before and after, peaks halfway at the top of the arc, and is a whole number throughout", () => {
    expect(heightOf(none)).toBe(0);
    expect(heightOf(slideAt(3))).toBe(0);
    expect(heightOf(jump(0))).toBe(0);
    expect(heightOf(jump(jumpTicks / 2))).toBe(jumpPeak);
    for (let tick = 0; tick < jumpTicks; tick += 1) {
      expect(Number.isInteger(heightOf(jump(tick)))).toBe(true);
      expect(heightOf(jump(tick))).toBeLessThanOrEqual(jumpPeak);
    }
  });

  it("rises to the peak and falls back the same way, symmetrically", () => {
    for (let tick = 1; tick < jumpTicks / 2; tick += 1) {
      expect(heightOf(jump(tick))).toBeGreaterThanOrEqual(
        heightOf(jump(tick - 1)),
      );
      expect(heightOf(jump(tick))).toBe(heightOf(jump(jumpTicks - tick)));
    }
  });

  it("lasts as long as its arc, and a slide as long as its own", () => {
    expect(lastsFor("jump")).toBe(jumpTicks);
    expect(lastsFor("slide")).toBe(slideTicks);
  });
});

describe("an action going on", () => {
  it("goes one tick further, and is over when it has run its course", () => {
    expect(progress(none)).toBe(none);
    expect(progress(jump(3))).toEqual(jump(4));
    expect(progress(jump(jumpTicks - 2))).toEqual(jump(jumpTicks - 1));
    expect(progress(jump(jumpTicks - 1))).toEqual(none);
    expect(progress(slideAt(slideTicks - 2))).toEqual(slideAt(slideTicks - 1));
    expect(progress(slideAt(slideTicks - 1))).toEqual(none);
  });
});

describe("what is in the runner's column", () => {
  it("is anything that starts before the runner's right edge and ends after its left", () => {
    expect(overlaps(11, 5)).toBe(true);
    expect(overlaps(12, 5)).toBe(false);
    expect(overlaps(-4, 5)).toBe(true);
    expect(overlaps(-5, 5)).toBe(false);
  });
});

describe("hitting an obstacle", () => {
  it("is a spike taking the feet of a runner who is not high enough, and nothing when it is not in the column", () => {
    expect(hits(spike(0), none)).toBe(true);
    expect(hits(spike(0), jump(1))).toBe(true);
    expect(hits(spike(0), jump(jumpTicks / 2))).toBe(false);
    expect(hits(spike(40), none)).toBe(false);
  });

  it("is an icicle taking the head of a runner who is standing or in the air, and not one who is sliding under it", () => {
    expect(hits(icicle(0), none)).toBe(true);
    expect(hits(icicle(0), jump(jumpTicks / 2))).toBe(true);
    expect(hits(icicle(0), slideAt(3))).toBe(false);
    expect(hits(icicle(40), none)).toBe(false);
  });
});

describe("touching a shard", () => {
  it("is being in its column with the feet within reach of it: a low one from the ground, a high one only from the air", () => {
    expect(touches(shard(0), none)).toBe(true);
    expect(touches(shard(0), slideAt(2))).toBe(true);
    expect(touches(shard(0, true), none)).toBe(false);
    expect(touches(shard(0, true), jump(jumpTicks / 2))).toBe(true);
    expect(touches(shard(0), jump(jumpTicks / 2))).toBe(false);
    expect(touches(shard(40), none)).toBe(false);
  });
});
