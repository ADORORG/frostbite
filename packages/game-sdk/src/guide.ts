import { block } from "./pixels.ts";

// The card every game shows on its first screen, before the first run: what the game is called, what the player does (a line for each key or
// touch), and how to begin. It is drawn over whatever the screen shows, in the platform's colours and a small monospace type scaled to the
// screen, and a line too long for the screen is made smaller until it fits, so a game cannot cut its own instructions off.
export interface Guide {
  // What the player does, one line for each: "SPACE OR UP: JUMP". Written in capitals, as the screen's type is.
  readonly lines: readonly string[];
  // The line that says how to begin: "ENTER TO START".
  readonly start: string;
  readonly title: string;
}

const font = '"Courier New", ui-monospace, monospace';
const back = "#0c0620";
const colours = {
  line: "#ece8ff",
  start: "#ffd23f",
  title: "#38e8ff",
} as const;

// How wide a character of the monospace type is, as a share of its size, and the share of the screen's width a line may take up.
export const glyphWidth = 0.62;
export const widestShare = 0.92;

// The size a line is written at: `wanted`, or less if it would be wider than the screen may show.
export const fittedSize = (
  text: string,
  wanted: number,
  width: number,
): number =>
  Math.min(
    wanted,
    (width * widestShare) / (glyphWidth * Math.max(1, text.length)),
  );

function write(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  size: number,
): void {
  context.font = `bold ${String(size)}px ${font}`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = back;
  context.fillText(text, x + size / 12, y + size / 12);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

// Draws the card over a screen `width` by `height` (in the units the screen is drawn in): the screen dimmed, the title, the lines, the start.
export function drawGuide(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  guide: Guide,
): void {
  context.globalAlpha = 0.84;
  block(context, back, 0, 0, width, height);
  context.globalAlpha = 1;
  const rows = guide.lines.length + 2;
  const step = (height * 0.86) / (rows + 1);
  const wanted = step * 0.62;
  const draw = (
    text: string,
    row: number,
    fill: string,
    scale: number,
  ): void => {
    const size = fittedSize(text, wanted * scale, width);
    write(context, text, width / 2, height * 0.07 + step * row, fill, size);
  };
  draw(guide.title, 0, colours.title, 1.5);
  guide.lines.forEach((line, index) =>
    draw(line, index + 1.3, colours.line, 1),
  );
  draw(guide.start, guide.lines.length + 1.9, colours.start, 1);
}

// The same card for a game whose screen is made of page elements and not a canvas: fills `into` (a box laid over the screen) with the title, the
// lines and the start, as a heading and paragraphs, for the game's stylesheet to set.
export function fillGuide(into: HTMLElement, guide: Guide): void {
  const title = into.ownerDocument.createElement("h2");
  title.textContent = guide.title;
  const lines = guide.lines.map((line) => {
    const item = into.ownerDocument.createElement("p");
    item.textContent = line;
    return item;
  });
  const start = into.ownerDocument.createElement("p");
  start.className = "guide-start";
  start.textContent = guide.start;
  into.replaceChildren(title, ...lines, start);
}
