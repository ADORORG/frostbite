import { describe, expect, it } from "vitest";

import {
  courseUnits,
  finishClearance,
  firstRockAt,
  minGap,
  topSpeedBonus,
  baseSpeed,
  speedStepUnits,
} from "../src/rules/constants.ts";
import { layRocks, speedAt, startSnowball } from "../src/rules/course.ts";

describe("the slope", () => {
  it("is the same for the same seed and different for another", () => {
    expect(layRocks(7)).toEqual(layRocks(7));
    expect(layRocks(7)).not.toEqual(layRocks(8));
  });

  it("lays a rock as far as the edge of the clear stretch before the finish, and never beyond it", () => {
    const edge = courseUnits - finishClearance;
    const furthest = Math.max(
      ...Array.from({ length: 30_000 }, (_, seed) =>
        Math.max(...layRocks(seed)),
      ),
    );
    expect(furthest).toBe(edge);
  });

  it("starts with a clear stretch, keeps every gap wide enough to land and hop again, and leaves the finish clear", () => {
    for (const seed of [0, 1, 2, 20_261_030, 4_294_967_295]) {
      const rocks = layRocks(seed);
      expect(rocks[0]).toBe(firstRockAt);
      rocks.slice(1).forEach((at, index) => {
        expect(at - (rocks[index] ?? 0)).toBeGreaterThanOrEqual(minGap);
      });
      expect(Math.max(...rocks)).toBeLessThanOrEqual(
        courseUnits - finishClearance,
      );
      expect(rocks.length).toBeGreaterThanOrEqual(15);
    }
  });

  it("speeds up one unit every step, to a top speed and no further", () => {
    expect(speedAt(0)).toBe(baseSpeed);
    expect(speedAt(speedStepUnits - 1)).toBe(baseSpeed);
    expect(speedAt(speedStepUnits)).toBe(baseSpeed + 1);
    expect(speedAt(10 * courseUnits)).toBe(baseSpeed + topSpeedBonus);
  });

  it("starts a run on the snow, alive, at the top", () => {
    const state = startSnowball(5);
    expect(state).toMatchObject({
      air: 0,
      alive: true,
      distance: 0,
      ended: false,
      finished: false,
      hops: 0,
      tick: 0,
    });
    expect(state.rocks).toEqual(layRocks(5));
  });
});
