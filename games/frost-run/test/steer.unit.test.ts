import { describe, expect, it } from "vitest";

import { wayOf, wayOfStick } from "../src/ui/steer.ts";

describe("steering", () => {
  it("turns a direction on the screen into one of sixteen ways, clockwise from up", () => {
    expect(wayOf(0, -1, -1)).toBe(0);
    expect(wayOf(1, 0, -1)).toBe(4);
    expect(wayOf(0, 1, -1)).toBe(8);
    expect(wayOf(-1, 0, -1)).toBe(12);
    expect(wayOf(1, -1, -1)).toBe(2);
    expect(wayOf(0, 0, 3)).toBe(-1);
  });

  it("holds a way until the direction is clearly in the next one", () => {
    const at = (degrees: number): [number, number] => [
      Math.sin((degrees * Math.PI) / 180),
      -Math.cos((degrees * Math.PI) / 180),
    ];
    expect(wayOf(...at(14), -1)).toBe(1);
    expect(wayOf(...at(14), 0)).toBe(0);
    expect(wayOf(...at(20), 0)).toBe(1);
  });

  it("gives no way inside a stick's dead zone", () => {
    expect(wayOfStick(5, 5, 14, 2)).toBe(-1);
    expect(wayOfStick(30, 0, 14, -1)).toBe(4);
  });
});
