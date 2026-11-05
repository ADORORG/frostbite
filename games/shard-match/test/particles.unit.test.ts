import { describe, expect, it } from "vitest";

import { burst, life, placeOf } from "../src/screen/particles.ts";
import { kindColours } from "../src/screen/palette.ts";

describe("a burst of confetti", () => {
  it("is the same every time for the same place and seed, and different for another, in the colour of its kind (or ice)", () => {
    expect(burst(10, 20, 2, 5)).toEqual(burst(10, 20, 2, 5));
    expect(burst(10, 20, 2, 5)).not.toEqual(burst(10, 20, 2, 6));
    expect(burst(10, 20, 2, 5).every((p) => p.fill === kindColours[2])).toBe(
      true,
    );
    expect(burst(10, 20, "ice", 5).every((p) => p.fill === "#d8f4ff")).toBe(
      true,
    );
    expect(burst(10, 20, 9, 5)[0]?.fill).toBe("#ffffff");
    expect(burst(0, 0, 1, 1)).toHaveLength(6);
    expect(burst(0, 0, 1, 1, 9)).toHaveLength(9);
    expect(burst(10, 20, 2, 5).every((p) => p.x === 10 && p.y === 20)).toBe(
      true,
    );
  });

  it("starts at its place, flies out, falls with gravity, and is gone after its life", () => {
    const [p] = burst(10, 20, 2, 5);
    if (p === undefined) throw new Error("none");
    expect(placeOf(p, 0)).toEqual({ x: 10, y: 20 });
    const early = placeOf(p, 5);
    const late = placeOf(p, 25);
    expect(early).not.toBeNull();
    expect((late?.y ?? 0) - 20).toBeGreaterThan((early?.y ?? 0) - 20);
    expect(placeOf(p, life - 1)).not.toBeNull();
    expect(placeOf(p, life)).toBeNull();
    expect(placeOf(p, -1)).toBeNull();
  });

  it("scatters the particles of a burst in different directions", () => {
    const speeds = new Set(
      burst(0, 0, 1, 3, 12).map((p) => `${p.vx.toFixed(2)},${p.vy.toFixed(2)}`),
    );
    expect(speeds.size).toBeGreaterThan(8);
  });
});
