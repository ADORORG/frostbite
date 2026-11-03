// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGuideLayer } from "../src/guide-layer.ts";
import type { Guide } from "../src/guide.ts";

const guide: Guide = {
  lines: ["JUMP"],
  start: "ENTER TO START",
  title: "GAME",
};

// A screen the page shows 300x200 at (10, 20), with a drawing surface that remembers what the layer asked of it.
function setUp(ratio = 3) {
  document.body.innerHTML = '<main><canvas id="screen"></canvas></main>';
  const screen = document.querySelector("canvas");
  if (screen === null) throw new Error("no screen");
  screen.getBoundingClientRect = () =>
    ({ height: 200, left: 10, top: 20, width: 300 }) as DOMRect;
  const transforms: number[][] = [];
  const context = {
    setTransform: (...values: number[]) => void transforms.push(values),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const drawn: { guide: Guide; height: number; width: number }[] = [];
  const layer = createGuideLayer(screen, {
    draw: (_context, width, height, shown) =>
      void drawn.push({ guide: shown, height, width }),
    ratio: () => ratio,
  });
  const card = document.querySelectorAll("canvas")[1];
  if (card === undefined) throw new Error("no card");
  return { card, drawn, layer, screen, transforms };
}

afterEach(() => vi.restoreAllMocks());

describe("the card over the screen", () => {
  it("is laid right after the screen, takes no touches, and is hidden until there is a card", () => {
    const { card, screen } = setUp();
    expect(card.previousElementSibling).toBe(screen);
    expect(card.style.pointerEvents).toBe("none");
    expect(card.style.position).toBe("fixed");
    expect(card.style.display).toBe("none");
    expect(card.getAttribute("aria-hidden")).toBe("true");
  });

  it("covers the screen where it is shown, with a pixel for every pixel of the display, and draws the card at the size it is shown", () => {
    const { card, drawn, layer, transforms } = setUp(3);
    layer.show(guide);
    expect(card.style).toMatchObject({
      display: "block",
      height: "200px",
      left: "10px",
      top: "20px",
      width: "300px",
    });
    expect([card.width, card.height]).toEqual([900, 600]);
    expect(transforms).toEqual([[3, 0, 0, 3, 0, 0]]);
    expect(drawn).toEqual([{ guide, height: 200, width: 300 }]);
  });

  it("uses one pixel to the pixel on a display that says less, and does not draw the same card twice", () => {
    const { card, drawn, layer } = setUp(0.5);
    layer.show(guide);
    layer.show(guide);
    expect([card.width, card.height]).toEqual([300, 200]);
    expect(drawn).toHaveLength(1);
  });

  it("is hidden when there is no card, and drawn again when the card comes back", () => {
    const { card, drawn, layer } = setUp();
    layer.show(guide);
    layer.show(null);
    expect(card.style.display).toBe("none");
    layer.show(guide);
    expect(card.style.display).toBe("block");
    expect(drawn).toHaveLength(2);
  });

  it("is drawn again when the screen changes size", () => {
    const { drawn, layer, screen } = setUp();
    layer.show(guide);
    screen.getBoundingClientRect = () =>
      ({ height: 100, left: 0, top: 0, width: 150 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    expect(drawn.map(({ width }) => width)).toEqual([300, 150]);
  });
});
