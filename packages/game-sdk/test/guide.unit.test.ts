// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  drawGuide,
  fillGuide,
  fittedSize,
  glyphWidth,
  widestShare,
  type Guide,
} from "../src/guide.ts";

// A context that remembers each piece of text (with the size and colour it was written in) and each fill.
function recorder() {
  const texts: {
    fill: string;
    size: number;
    text: string;
    x: number;
    y: number;
  }[] = [];
  const fills: {
    alpha: number;
    fill: string;
    height: number;
    width: number;
  }[] = [];
  const state = { alpha: 1, fill: "", font: "" };
  const context = {
    fillRect: (_x: number, _y: number, width: number, height: number) =>
      void fills.push({ alpha: state.alpha, fill: state.fill, height, width }),
    fillText: (text: string, x: number, y: number) =>
      void texts.push({
        fill: state.fill,
        size: Number(/(\d+(?:\.\d+)?)px/u.exec(state.font)?.[1]),
        text,
        x,
        y,
      }),
    get fillStyle() {
      return state.fill;
    },
    set fillStyle(value: string) {
      state.fill = value;
    },
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    get globalAlpha() {
      return state.alpha;
    },
    set globalAlpha(value: number) {
      state.alpha = value;
    },
    textAlign: "",
    textBaseline: "",
  } as unknown as CanvasRenderingContext2D;
  return { context, fills, texts };
}

const guide: Guide = {
  lines: ["SPACE OR UP: JUMP", "ARROWS: RUN"],
  start: "ENTER TO START",
  title: "BRO MARIA",
};
const shown = (width: number, height: number, card: Guide = guide) => {
  const r = recorder();
  drawGuide(r.context, width, height, card);
  return r;
};

describe("the first-screen guide", () => {
  it("dims the whole screen, and writes the title, each line and the start, top to bottom, each once in its colour (the shadow first)", () => {
    const { fills, texts } = shown(256, 144);
    expect(fills).toEqual([
      { alpha: 0.84, fill: "#0c0620", height: 144, width: 256 },
    ]);
    const lit = texts.filter(({ fill }) => fill !== "#0c0620");
    expect(lit.map(({ text }) => text)).toEqual([
      "BRO MARIA",
      "SPACE OR UP: JUMP",
      "ARROWS: RUN",
      "ENTER TO START",
    ]);
    expect(lit.map(({ fill }) => fill)).toEqual([
      "#38e8ff",
      "#ece8ff",
      "#ece8ff",
      "#ffd23f",
    ]);
    expect(texts.filter(({ fill }) => fill === "#0c0620")).toHaveLength(4);
    const ys = lit.map(({ y }) => y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ys).size).toBe(4);
    expect(Math.max(...ys)).toBeLessThan(144);
    expect(lit.every(({ x }) => x === 128)).toBe(true);
    expect(lit[0]?.size).toBeGreaterThan(lit[1]?.size ?? 0);
  });

  it("makes a line smaller until it fits, and leaves one that fits alone", () => {
    expect(fittedSize("ABCD", 10, 1_000)).toBe(10);
    const size = fittedSize("A".repeat(40), 10, 160);
    expect(size).toBeLessThan(10);
    expect(size * glyphWidth * 40).toBeCloseTo(160 * widestShare);
    expect(fittedSize("", 10, 100)).toBe(10);
  });

  it("never writes a line wider than the screen may show, on a small screen or a big one, however long the line", () => {
    const long: Guide = {
      lines: [
        "TAP THE TOP TO JUMP, THE BOTTOM TO SLIDE UNDER THE ICICLES",
        "X",
      ],
      start: "ENTER, SPACE OR TAP TO START A RUN",
      title: "FROST RUNNER",
    };
    for (const [width, height] of [
      [160, 90],
      [256, 144],
      [640, 360],
    ] as const)
      for (const { size, text } of shown(width, height, long).texts)
        expect(size * glyphWidth * text.length).toBeLessThanOrEqual(
          width * widestShare + 1e-9,
        );
  });

  it("spaces a guide with no lines, and with many, down the screen", () => {
    expect(
      shown(160, 90, { ...guide, lines: [] }).texts.filter(
        ({ fill }) => fill !== "#0c0620",
      ),
    ).toHaveLength(2);
    const many = { ...guide, lines: ["A", "B", "C", "D", "E", "F"] };
    const lit = shown(160, 90, many).texts.filter(
      ({ fill }) => fill !== "#0c0620",
    );
    expect(lit).toHaveLength(8);
    expect(Math.max(...lit.map(({ y }) => y))).toBeLessThan(90);
  });
});

describe("the guide as page elements", () => {
  it("fills a box with a heading, a paragraph for each line, and the start last, replacing what was there", () => {
    const box = document.createElement("div");
    box.textContent = "old";
    fillGuide(box, guide);
    expect([...box.children].map((child) => child.tagName)).toEqual([
      "H2",
      "P",
      "P",
      "P",
    ]);
    expect([...box.children].map((child) => child.textContent)).toEqual([
      "BRO MARIA",
      "SPACE OR UP: JUMP",
      "ARROWS: RUN",
      "ENTER TO START",
    ]);
    expect(box.lastElementChild?.className).toBe("guide-start");
    fillGuide(box, { ...guide, lines: [] });
    expect(box.children).toHaveLength(2);
  });
});
