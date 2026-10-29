import { describe, expect, it } from "vitest";

import { block, sprite, wrap } from "../src/pixels.ts";

// A context that only remembers what was filled, so a drawing can be read back as (colour, x, y, width, height).
function recorder() {
  const fills: [string, number, number, number, number][] = [];
  let fill = "";
  const context = {
    fillRect: (x: number, y: number, width: number, height: number) =>
      void fills.push([fill, x, y, width, height]),
    set fillStyle(value: string) {
      fill = value;
    },
  } as unknown as CanvasRenderingContext2D;
  return { context, fills };
}

describe("pixel drawing", () => {
  it("fills a block of one colour on whole pixels", () => {
    const { context, fills } = recorder();
    block(context, "#fff", 1.4, 2.6, 3, 4);
    expect(fills).toEqual([["#fff", 1, 3, 3, 4]]);
  });

  it("draws a picture one pixel for each character, leaving clear what the key does not name", () => {
    const { context, fills } = recorder();
    sprite(context, ["a.b", ".a."], { a: "red", b: "blue" }, 10, 20);
    expect(fills).toEqual([
      ["red", 10, 20, 1, 1],
      ["blue", 12, 20, 1, 1],
      ["red", 11, 21, 1, 1],
    ]);
  });

  it("wraps a position into the layer, either side of zero", () => {
    expect(wrap(5, 4)).toBe(1);
    expect(wrap(-1, 4)).toBe(3);
    expect(wrap(8, 4)).toBe(0);
    expect(wrap(2.6, 4)).toBe(3);
  });
});
