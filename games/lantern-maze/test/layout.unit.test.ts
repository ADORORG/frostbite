import { describe, expect, it } from "vitest";

import { cell, lanternPoint, originOf } from "../src/screen/layout.ts";

describe("where the lantern is on the screen", () => {
  it("is the middle of its cell, counted along the row and then down the rows", () => {
    const origin = originOf(7, 5);
    expect(lanternPoint(7, 5, 0)).toEqual({
      x: origin.x + cell / 2,
      y: origin.y + cell / 2,
    });
    expect(lanternPoint(7, 5, 9)).toEqual({
      x: origin.x + 2 * cell + cell / 2,
      y: origin.y + cell + cell / 2,
    });
  });
});
