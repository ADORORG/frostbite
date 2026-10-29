import { describe, expect, it } from "vitest";

import { sceneHeight } from "../../src/engine/index.ts";
import { builder } from "../../src/library/builder.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(builder);
const blocks = (t: number) =>
  frames.at(t).filter(({ height, width }) => width === 22 && height === 6);

describe("block builder", () => {
  it("shows a tower reaching the bottom of the picture from the first moment, not one that has to grow", () => {
    const tower = blocks(0);
    expect(tower.length).toBeGreaterThan(8);
    expect(Math.max(...tower.map(({ y }) => y))).toBeGreaterThan(
      sceneHeight - 12,
    );
  });

  it("lets the tower settle one block down after each block lands", () => {
    const top = (t: number) =>
      Math.min(
        ...blocks(t)
          .filter(({ y }) => y > 20)
          .map(({ y }) => y),
      );
    expect(top(1.25)).toBeLessThan(top(1.25 + 0.37));
    expect(top(1.25 + 0.37)).toBe(top(1.25 + 1.0));
  });

  it("drops the next block from above while the tower waits", () => {
    const falling = (t: number) => Math.min(...blocks(t).map(({ y }) => y));
    expect(falling(0.6)).toBeLessThan(0);
    expect(falling(1.2)).toBeGreaterThan(falling(0.9));
  });

  it("repeats its colours and offsets every few blocks, so the picture is the same one pattern later", () => {
    const key = (t: number) =>
      blocks(t)
        .map(
          ({ colour, x, y }) => `${colour}|${Math.round(x)}|${Math.round(y)}`,
        )
        .sort();
    expect(key(0.4)).toEqual(key(0.4 + 8 * 1.25));
  });
});
