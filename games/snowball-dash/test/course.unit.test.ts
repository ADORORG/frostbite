import { describe, expect, it } from "vitest";

import {
  baseSpeed,
  lastLevel,
  levelLength,
  topSpeed,
} from "../src/rules/constants.ts";
import { levelAt, speedAt } from "../src/rules/course.ts";

describe("how far the snowball has come", () => {
  it("is a new level every levelLength, and the first level is the first stretch", () => {
    expect(levelAt(0)).toBe(0);
    expect(levelAt(levelLength - 1)).toBe(0);
    expect(levelAt(levelLength)).toBe(1);
    expect(levelAt(levelLength * 5 + 3)).toBe(5);
  });

  it("rolls faster by one a tick each level, from the base speed up to the top, and no faster", () => {
    expect(speedAt(0)).toBe(baseSpeed);
    expect(speedAt(1)).toBe(baseSpeed + 1);
    expect(speedAt(topSpeed - baseSpeed)).toBe(topSpeed);
    expect(speedAt(topSpeed - baseSpeed + 1)).toBe(topSpeed);
    expect(speedAt(lastLevel * 3)).toBe(topSpeed);
  });
});
