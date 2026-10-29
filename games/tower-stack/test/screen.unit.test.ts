// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { drawBackdrop, drawGround } from "../src/screen/backdrop.ts";
import { draw, type View } from "../src/screen/draw.ts";
import {
  fieldLeft,
  groundY,
  rowTop,
  screenHeight,
  slabHeight,
} from "../src/screen/layout.ts";
import { colour, slabColours } from "../src/screen/palette.ts";
import { tower } from "./support/states.ts";

const gradient = { addColorStop: () => undefined };

// A context that remembers what was filled, as (colour, x, y, width, height), and answers the gradient calls the sky makes.
function recorder() {
  const fills: [string, number, number, number, number][] = [];
  let fill = "";
  const context = {
    createLinearGradient: () => gradient,
    fillRect: (x: number, y: number, width: number, height: number) =>
      void fills.push([fill, x, y, width, height]),
    set fillStyle(value: string) {
      fill = value;
    },
  } as unknown as CanvasRenderingContext2D;
  return { context, fills };
}
const view = (over: Partial<View> = {}): View => ({
  camera: 0,
  clock: 10,
  cut: null,
  movingX: 30,
  slabs: [{ perfect: false, width: 48, x: 36 }],
  state: tower(),
  ...over,
});
const colours = (fills: readonly (readonly [string, ...number[]])[]) =>
  new Set(fills.map(([fill]) => fill));

describe("the sky", () => {
  it("fills the whole screen and draws the stars, the aurora, the ridge and the snow over it", () => {
    const { context, fills } = recorder();
    drawBackdrop(context, 5, 0);
    expect(fills[0]?.slice(1)).toEqual([0, 0, 160, 90]);
    for (const wanted of [
      colour.star,
      colour.aurora,
      colour.ridge,
      colour.frost,
    ])
      expect(colours(fills)).toContain(wanted);
  });

  it("is the same whenever it is drawn, and moves with the tick", () => {
    const once = recorder();
    const again = recorder();
    drawBackdrop(once.context, 5, 12);
    drawBackdrop(again.context, 5, 12);
    expect(again.fills).toEqual(once.fills);
    const later = recorder();
    drawBackdrop(later.context, 50, 12);
    expect(later.fills).not.toEqual(once.fills);
  });

  it("puts the ground at the foot of the first block, and lets it leave when the view has risen past it", () => {
    const low = recorder();
    drawGround(low.context, 0);
    expect(low.fills[0]).toEqual([
      colour.ground,
      0,
      groundY,
      160,
      screenHeight - groundY,
    ]);
    expect(colours(low.fills)).toContain(colour.groundLine);
    const high = recorder();
    drawGround(high.context, screenHeight);
    expect(high.fills).toEqual([]);
  });
});

describe("the tower", () => {
  const slab = (x: number, width = 48, perfect = false) => ({
    perfect,
    width,
    x,
  });

  it("draws each block in its own colour, with a bright top edge, from the ground up", () => {
    const { context, fills } = recorder();
    draw(
      context,
      view({
        slabs: [slab(36), slab(36), slab(40, 44)],
        state: tower({ ended: true }),
      }),
    );
    const [first] = slabColours;
    expect(fills).toContainEqual([
      first?.face,
      fieldLeft + 36,
      rowTop(0, 0),
      48,
      slabHeight,
    ]);
    expect(fills).toContainEqual([
      first?.top,
      fieldLeft + 36,
      rowTop(0, 0),
      48,
      1,
    ]);
    expect(fills).toContainEqual([
      slabColours[1]?.face,
      fieldLeft + 36,
      rowTop(1, 0),
      48,
      slabHeight,
    ]);
    expect(fills).toContainEqual([
      slabColours[2]?.face,
      fieldLeft + 40,
      rowTop(2, 0),
      44,
      slabHeight,
    ]);
  });

  it("repeats the colours for a tall tower", () => {
    const { context, fills } = recorder();
    const tall = Array.from({ length: slabColours.length + 1 }, () => slab(36));
    draw(
      context,
      view({ camera: 30, slabs: tall, state: tower({ ended: true }) }),
    );
    expect(fills).toContainEqual([
      slabColours[0]?.face,
      fieldLeft + 36,
      rowTop(slabColours.length, 30),
      48,
      slabHeight,
    ]);
  });

  it("marks a perfect block with a glint, and a plain one with none", () => {
    const perfect = recorder();
    draw(
      perfect.context,
      view({ slabs: [slab(36, 48, true)], state: tower({ ended: true }) }),
    );
    expect(perfect.fills).toContainEqual([
      colour.core,
      fieldLeft + 37,
      rowTop(0, 0) + 1,
      2,
      1,
    ]);
    const plain = recorder();
    draw(
      plain.context,
      view({ slabs: [slab(36)], state: tower({ ended: true }) }),
    );
    expect(
      plain.fills.some(
        ([fill, x]) => fill === colour.core && x === fieldLeft + 37,
      ),
    ).toBe(false);
  });

  it("draws the moving block one row above the tower, as wide as the top block, and a faint column above the tower to aim by", () => {
    const { context, fills } = recorder();
    draw(context, view({ movingX: 30 }));
    expect(fills).toContainEqual([
      slabColours[1]?.face,
      fieldLeft + 30,
      rowTop(1, 0),
      48,
      slabHeight,
    ]);
    expect(fills).toContainEqual([
      colour.ghost,
      fieldLeft + 36,
      0,
      48,
      rowTop(0, 0),
    ]);
  });

  it("draws no moving block and no aim once the run is over, and shows what fell dropping away", () => {
    const over = tower({ over: true });
    const early = recorder();
    draw(
      early.context,
      view({ clock: 12, cut: { at: 10, width: 20, x: 40 }, state: over }),
    );
    expect(early.fills.some(([fill]) => fill === colour.ghost)).toBe(false);
    expect(
      early.fills.some(
        ([fill, , , w]) => fill === slabColours[1]?.face && w === 48,
      ),
    ).toBe(false);
    const at = (clock: number) => {
      const { context, fills } = recorder();
      draw(
        context,
        view({ clock, cut: { at: 10, width: 20, x: 40 }, state: over }),
      );
      return fills.find(
        ([fill, x, , w]) =>
          fill === slabColours[1]?.foot && x === fieldLeft + 40 && w === 20,
      );
    };
    expect(at(30)?.[2]).toBeGreaterThan(at(12)?.[2] ?? Infinity);
    expect(at(60)).toBeUndefined();
  });

  it("draws what was trimmed off a block that landed, falling away from the tower", () => {
    const { context, fills } = recorder();
    draw(
      context,
      view({
        clock: 14,
        cut: { at: 10, width: 6, x: 80 },
        state: tower({ ended: true }),
      }),
    );
    expect(fills.some(([, x, , w]) => x === fieldLeft + 80 && w === 6)).toBe(
      true,
    );
  });
});
