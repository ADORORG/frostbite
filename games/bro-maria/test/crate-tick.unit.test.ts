import { describe, expect, it } from "vitest";

import { groundRow, tile } from "../src/rules/constants.ts";
import { tickOnce } from "../src/rules/tick.ts";
import { flatLevel, onFlat, withHero } from "./support/states.ts";

describe("a crate", () => {
  const crate = { x: 10, y: groundRow - 3 };
  const level = flatLevel({
    crates: [crate],
    solid: new Set([10 * 64 + crate.y]),
  });
  const below = withHero(onFlat(level), {
    grounded: false,
    vy: -50,
    x: 10 * tile + 30,
    y: (crate.y + 1) * tile + 20,
  });

  it("is bumped from below once, and counted", () => {
    const bumped = tickOnce(below);
    expect(bumped.crates).toBe(1);
    expect(bumped.cratesUsed).toEqual([true]);
    const again = tickOnce(
      withHero(bumped, {
        grounded: false,
        vy: -50,
        y: (crate.y + 1) * tile + 20,
      }),
    );
    expect(again.crates).toBe(1);
  });

  it("counts every crate a head strikes in the same tick", () => {
    const two = flatLevel({
      crates: [crate, { x: 11, y: crate.y }],
      solid: new Set([10 * 64 + crate.y, 11 * 64 + crate.y]),
    });
    const straddling = withHero(onFlat(two), {
      grounded: false,
      vy: -50,
      x: 11 * tile - 96,
      y: (crate.y + 1) * tile + 20,
    });
    expect(tickOnce(straddling).crates).toBe(2);
  });

  it("is not bumped by a hero walking past", () => {
    expect(tickOnce(onFlat(level, 10)).crates).toBe(0);
  });
});
