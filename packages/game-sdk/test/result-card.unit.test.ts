import { describe, expect, it } from "vitest";

import {
  drawCard,
  drawResult,
  fittedSize,
  glyphWidth,
  widestShare,
  type Guide,
  type ResultCard,
} from "../src/guide.ts";
import { recorder } from "./support/canvas-recorder.ts";

const card: ResultCard = {
  rows: [
    { colour: "#ff0000", text: "RUN OVER", weight: 1.5 },
    { colour: "#00ff00", text: "SCORE 120", weight: 1.2 },
    { colour: "#0000ff", text: "BEST 400", weight: 1 },
  ],
};
const shown = (width: number, height: number, result: ResultCard = card) => {
  const r = recorder();
  drawResult(r.context, width, height, result);
  return r;
};
const lit = (texts: ReturnType<typeof recorder>["texts"]) =>
  texts.filter(({ fill }) => fill !== "#0c0620");

describe("the card after a run", () => {
  it("dims the whole screen and writes each row once, top to bottom, in the colour the game gave it (the shadow first)", () => {
    const { fills, texts } = shown(256, 144);
    expect(fills).toEqual([
      { alpha: 0.84, fill: "#0c0620", height: 144, width: 256 },
    ]);
    expect(lit(texts).map(({ text, fill }) => [text, fill])).toEqual([
      ["RUN OVER", "#ff0000"],
      ["SCORE 120", "#00ff00"],
      ["BEST 400", "#0000ff"],
    ]);
    expect(texts.filter(({ fill }) => fill === "#0c0620")).toHaveLength(3);
    const ys = lit(texts).map(({ y }) => y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ys).size).toBe(3);
    expect(Math.max(...ys)).toBeLessThan(144);
    expect(lit(texts).every(({ x }) => x === 128)).toBe(true);
  });

  it("writes a heavier row larger than a lighter one", () => {
    const sizes = lit(shown(256, 144).texts).map(({ size }) => size);
    expect(sizes[0]).toBeGreaterThan(sizes[1] ?? 0);
    expect(sizes[1]).toBeGreaterThan(sizes[2] ?? 0);
  });

  it("never writes a row wider than the screen may show, however long it is", () => {
    const long: ResultCard = {
      rows: [
        {
          colour: "#fff",
          text: "ENTER, SPACE OR TAP TO ROLL AGAIN AND AGAIN",
          weight: 1.5,
        },
      ],
    };
    for (const [width, height] of [
      [160, 90],
      [640, 360],
    ] as const)
      for (const { size, text } of lit(shown(width, height, long).texts))
        expect(size * glyphWidth * text.length).toBeLessThanOrEqual(
          width * widestShare + 1e-9,
        );
    expect(fittedSize("A".repeat(60), 10, 100)).toBeLessThan(10);
  });

  it("draws a card with no rows as the dimmed screen alone", () => {
    const { fills, texts } = shown(256, 144, { rows: [] });
    expect(fills).toHaveLength(1);
    expect(texts).toEqual([]);
  });
});

describe("whichever card there is", () => {
  const guide: Guide = {
    lines: ["JUMP"],
    start: "ENTER TO START",
    title: "GAME",
  };

  it("draws the card after a run when given rows", () => {
    const r = recorder();
    drawCard(r.context, 256, 144, card);
    expect(lit(r.texts).map(({ text }) => text)).toEqual([
      "RUN OVER",
      "SCORE 120",
      "BEST 400",
    ]);
  });

  it("draws the first-screen card when given a guide", () => {
    const r = recorder();
    drawCard(r.context, 256, 144, guide);
    expect(lit(r.texts).map(({ text }) => text)).toEqual([
      "GAME",
      "JUMP",
      "ENTER TO START",
    ]);
  });
});
