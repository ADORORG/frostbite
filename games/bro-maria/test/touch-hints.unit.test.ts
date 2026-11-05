import { describe, expect, it } from "vitest";

import { onFlat } from "./support/states.ts";
import { surface } from "./support/canvas.ts";
import {
  hintAlpha,
  hintBottom,
  hintTicks,
  touchHints,
} from "../src/screen/touch-hints.ts";
import { backEdge, jumpEdge } from "../src/screen/thumbs.ts";

const width = 256;
const height = 144;
const hints = (tick: number, touch: boolean) => {
  const page = surface();
  touchHints(page.context, { ...onFlat(), tick }, width, height, touch);
  return page;
};

describe("naming the zones for a thumb", () => {
  it("writes the three zones, each in the middle of its own, faintly, for the first moments of a run on a touch screen", () => {
    const { written } = hints(0, true);
    // Each is written twice, a shadow one pixel off and then the writing itself.
    const say = (text: string) => written.filter((w) => w.text === text);
    expect(new Set(written.map(({ text }) => text))).toEqual(
      new Set(["< BACK", "FORWARD >", "JUMP"]),
    );
    expect(say("< BACK")[1]?.x).toBe((backEdge / 2) * width);
    expect(say("FORWARD >")[1]?.x).toBe(((backEdge + jumpEdge) / 2) * width);
    expect(say("JUMP")[1]?.x).toBe(((jumpEdge + 1) / 2) * width);
    for (const { alpha } of written) expect(alpha).toBe(hintAlpha);
    // At the foot of the screen, where a thumb is, and not over the stage's number in the middle.
    for (const { y } of written)
      expect([height - hintBottom, height - hintBottom + 1]).toContain(y);
  });

  it("stops once the moments are over, and is silent for a keyboard", () => {
    expect(hints(hintTicks - 1, true).written.length).toBeGreaterThan(0);
    expect(hints(hintTicks, true).written).toEqual([]);
    expect(hints(0, false).written).toEqual([]);
  });

  it("gives back the page's full opacity", () => {
    const page = hints(0, true);
    expect(
      (page.context as unknown as { globalAlpha: number }).globalAlpha,
    ).toBe(1);
  });
});
