import { describe, expect, it } from "vitest";

import { markOf } from "../src/cabinet/marks.ts";
import { columns, neighbourMines } from "../src/ice-field/neighbours.ts";

describe("neighbouring mines", () => {
  it("counts the mines among up to eight neighbours, and not the tile itself", () => {
    // The centre tile (12) has eight neighbours: 6, 7, 8, 11, 13, 16, 17, 18.
    expect(neighbourMines(12, [])).toBe(0);
    expect(neighbourMines(12, [12])).toBe(0);
    expect(neighbourMines(12, [6, 8, 16, 18])).toBe(4);
    expect(neighbourMines(12, [6, 7, 8, 11, 13, 16, 17, 18])).toBe(8);
    expect(neighbourMines(12, [0, 4, 20, 24])).toBe(0);
  });

  it("stops at the edges and does not wrap from one row to the next", () => {
    expect(columns).toBe(5);
    // Tile 4 is the end of the first row and tile 5 the start of the second: they are not neighbours.
    expect(neighbourMines(4, [5])).toBe(0);
    expect(neighbourMines(5, [4])).toBe(0);
    expect(neighbourMines(4, [3, 8, 9])).toBe(3);
    expect(neighbourMines(0, [1, 5, 6, 24])).toBe(3);
    expect(neighbourMines(24, [18, 19, 23, 0])).toBe(3);
    expect(neighbourMines(20, [15, 16, 21, 4])).toBe(3);
  });
});

describe("the game's names for milestones", () => {
  it("turns a platform slug into the camel-case mark the game reports by", () => {
    expect(markOf("first-win")).toBe("firstWin");
    expect(markOf("first-glacier")).toBe("firstGlacier");
    expect(markOf("a-b-c")).toBe("aBC");
    expect(markOf("single")).toBe("single");
  });
});
