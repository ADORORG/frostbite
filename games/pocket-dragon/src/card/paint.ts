import { block } from "@ador/game-sdk/pixels";

import { colour } from "../screen/palette.ts";
import type { Box } from "./layout.ts";

// The card's brushes, all made of blocks, gradients and words, like the game's own screen: chunky pixel corners, big pixel pictures,
// sparkles, a holographic sheen, and type in the game's monospace with a dark shadow. Monospace type is about 0.6 of its size wide, so
// words are fitted by counting letters, the same in every browser.
const face = '"Courier New", ui-monospace, monospace';
export const letterWidth = 0.6;

export function say(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  align: CanvasTextAlign = "left",
  style = "bold",
): void {
  context.font = `${style} ${String(Math.round(size))}px ${face}`;
  context.textAlign = align;
  context.textBaseline = "top";
  const drop = Math.max(2, Math.round(size / 14));
  context.fillStyle = colour.deep;
  context.fillText(text, Math.round(x + drop), Math.round(y + drop));
  context.fillStyle = fill;
  context.fillText(text, Math.round(x), Math.round(y));
}

// Words broken into lines that fit `width` at `size`; a word longer than a line is broken where it must be.
export function wrap(
  text: string,
  width: number,
  size: number,
): readonly string[] {
  const most = Math.max(1, Math.floor(width / (size * letterWidth) + 1e-6));
  const out: string[] = [];
  let line = "";
  for (const whole of text.split(" ")) {
    let word = whole;
    while (word.length > most) {
      if (line.length > 0) out.push(line);
      out.push(word.slice(0, most));
      word = word.slice(most);
      line = "";
    }
    if (line.length > 0 && line.length + 1 + word.length > most) {
      out.push(line);
      line = word;
    } else line = line.length > 0 ? `${line} ${word}` : word;
  }
  if (line.length > 0) out.push(line);
  return out;
}

// The biggest size, up to `most`, at which `text` fits `width` in no more than `rows` lines.
export function fitted(
  text: string,
  width: number,
  most: number,
  rows: number,
): number {
  let size = most;
  while (size > 12 && wrap(text, width, size).length > rows) size -= 2;
  return size;
}

// A panel with its corners cut in pixel steps, and an edge `edge` thick round it.
export function panel(
  context: CanvasRenderingContext2D,
  box: Box,
  fill: string | CanvasGradient,
  edge: string | CanvasGradient,
  thick: number,
  step: number,
): void {
  const { x, y, width, height } = box;
  context.fillStyle = edge;
  context.fillRect(x + step, y, width - 2 * step, height);
  context.fillRect(x, y + step, width, height - 2 * step);
  context.fillStyle = fill;
  context.fillRect(
    x + step + thick,
    y + thick,
    width - 2 * (step + thick),
    height - 2 * thick,
  );
  context.fillRect(
    x + thick,
    y + step + thick,
    width - 2 * thick,
    height - 2 * (step + thick),
  );
}

// A pixel picture `scale` times its size.
export function big(
  context: CanvasRenderingContext2D,
  rows: readonly string[],
  key: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale: number,
): void {
  rows.forEach((row, line) => {
    [...row].forEach((cell, column) => {
      const fill = key[cell];
      if (fill !== undefined)
        block(
          context,
          fill,
          x + column * scale,
          y + line * scale,
          scale,
          scale,
        );
    });
  });
}

// A four-pointed sparkle, `size` from tip to tip.
export function sparkle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
): void {
  const arm = Math.max(1, Math.round(size / 2));
  const thin = Math.max(1, Math.round(size / 8));
  block(context, fill, x - arm, y - thin, arm * 2, thin * 2);
  block(context, fill, x - thin, y - arm, thin * 2, arm * 2);
  block(context, colour.white, x - thin, y - thin, thin * 2, thin * 2);
}

// The holographic sheen of a foil card: rainbow light running across at a slant.
export function sheen(
  context: CanvasRenderingContext2D,
  box: Box,
  strength: number,
): void {
  const light = context.createLinearGradient(
    box.x,
    box.y,
    box.x + box.width,
    box.y + box.height,
  );
  const bands = [
    colour.pink,
    colour.gold,
    colour.mint,
    colour.cyan,
    colour.lavender,
    colour.pink,
    colour.gold,
  ];
  bands.forEach((fill, at) =>
    light.addColorStop(at / (bands.length - 1), fill),
  );
  context.globalAlpha = strength;
  context.fillStyle = light;
  context.fillRect(box.x, box.y, box.width, box.height);
  context.globalAlpha = 1;
}

// A gradient from `from` to `to`, top to bottom of `box`.
export function fall(
  context: CanvasRenderingContext2D,
  box: Box,
  from: string,
  to: string,
): CanvasGradient {
  const gradient = context.createLinearGradient(
    box.x,
    box.y,
    box.x,
    box.y + box.height,
  );
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
}
