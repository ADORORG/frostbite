import { describe, expect, it } from "vitest";

import { arrow, tapped, toggled } from "../src/picking.ts";

describe("the cursor and the shard picked up", () => {
  it("steps the cursor on an arrow, and stays on the board at an edge", () => {
    expect(arrow({ cursor: 27, grab: -1 }, "right")).toEqual({
      picking: { cursor: 28, grab: -1 },
      swap: null,
    });
    expect(arrow({ cursor: 27, grab: -1 }, "up").picking.cursor).toBe(19);
    expect(arrow({ cursor: 27, grab: -1 }, "down").picking.cursor).toBe(35);
    expect(arrow({ cursor: 27, grab: -1 }, "left").picking.cursor).toBe(26);
    expect(arrow({ cursor: 0, grab: -1 }, "up").picking.cursor).toBe(0);
    expect(arrow({ cursor: 0, grab: -1 }, "left").picking.cursor).toBe(0);
    expect(arrow({ cursor: 63, grab: -1 }, "right").picking.cursor).toBe(63);
    expect(arrow({ cursor: 63, grab: -1 }, "down").picking.cursor).toBe(63);
  });

  it("swaps the shard picked up that way on an arrow, leaving the cursor and the pick for the page to clear", () => {
    expect(arrow({ cursor: 3, grab: 27 }, "down")).toEqual({
      picking: { cursor: 3, grab: 27 },
      swap: { cell: 27, direction: 2 },
    });
    expect(arrow({ cursor: 3, grab: 27 }, "left").swap).toEqual({
      cell: 27,
      direction: 3,
    });
  });

  it("picks the shard under the cursor up on Space, and puts it down on Space again", () => {
    expect(toggled({ cursor: 5, grab: -1 })).toEqual({ cursor: 5, grab: 5 });
    expect(toggled({ cursor: 5, grab: 5 })).toEqual({ cursor: 5, grab: -1 });
    expect(toggled({ cursor: 6, grab: 5 })).toEqual({ cursor: 6, grab: 6 });
  });

  it("swaps on a tap on a neighbour of the shard picked up, and otherwise picks the tapped one up", () => {
    expect(tapped({ cursor: 0, grab: 27 }, 28)).toEqual({
      picking: { cursor: 0, grab: 27 },
      swap: { cell: 27, direction: 1 },
    });
    expect(tapped({ cursor: 0, grab: 27 }, 19).swap).toEqual({
      cell: 27,
      direction: 0,
    });
    expect(tapped({ cursor: 0, grab: 27 }, 30)).toEqual({
      picking: { cursor: 30, grab: 30 },
      swap: null,
    });
    expect(tapped({ cursor: 0, grab: -1 }, 12)).toEqual({
      picking: { cursor: 12, grab: 12 },
      swap: null,
    });
    expect(tapped({ cursor: 12, grab: 12 }, 12)).toEqual({
      picking: { cursor: 12, grab: -1 },
      swap: null,
    });
  });
});
