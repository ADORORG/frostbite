import { block } from "./pixels.ts";
import { byInput, isTouchScreen } from "./touch.ts";

// The card every game shows on its first screen, before the first run: what the game is called, what the player does (a line for each key or
// touch), and how to begin. It is drawn over whatever the screen shows, in the platform's colours and a small monospace type scaled to the
// screen, and a line too long for the screen is made smaller until it fits, so a game cannot cut its own instructions off.
export interface Guide {
  // What the player does, one line for each: "SPACE OR UP: JUMP". Written in capitals, as the screen's type is.
  readonly lines: readonly string[];
  // The line that says how to begin: "ENTER TO START".
  readonly start: string;
  readonly title: string;
  // What a touch screen is told instead of `lines`, for a game whose hands are different there (the keys name keys no phone has).
  readonly touchLines?: readonly string[];
}

// The card a game shows after a run: a heading, then what the run came to, then how to go again. The same card layer shows it, so it is as
// sharp as the first-screen card. A row is its text, its colour (from the game's own palette) and its weight, the share of the usual size it is
// written at (the heading is heavier than the rest).
export interface ResultRow {
  readonly colour: string;
  readonly text: string;
  readonly weight: number;
}
export interface ResultCard {
  readonly rows: readonly ResultRow[];
}

// What the card layer can show: the first-screen card or the card after a run.
export type Card = Guide | ResultCard;

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

// How a touch screen is told to begin, in place of what a keyboard is told ("ENTER TO START"): there is no key to press.
export const touchStartLine = "TAP TO START";
export const startLineFor = (keyboardLine: string): string =>
  byInput(keyboardLine, touchStartLine);

export const linesFor = (guide: Guide): readonly string[] =>
  isTouchScreen() && guide.touchLines !== undefined
    ? guide.touchLines
    : guide.lines;

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
  const lines = linesFor(guide);
  const rows = lines.length + 2;
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
  lines.forEach((line, index) => draw(line, index + 1.3, colours.line, 1));
  draw(startLineFor(guide.start), lines.length + 1.9, colours.start, 1);
}

// Draws the card after a run over a screen `width` by `height`: the screen dimmed, then the rows from the top, each fitted to the screen.
export function drawResult(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  card: ResultCard,
): void {
  context.globalAlpha = 0.84;
  block(context, back, 0, 0, width, height);
  context.globalAlpha = 1;
  const step = (height * 0.86) / (card.rows.length + 1);
  card.rows.forEach(({ colour, text, weight }, index) => {
    const size = fittedSize(text, step * 0.62 * weight, width);
    write(context, text, width / 2, height * 0.07 + step * index, colour, size);
  });
}

// Draws whichever card there is.
export function drawCard(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  card: Card,
): void {
  if ("rows" in card) drawResult(context, width, height, card);
  else drawGuide(context, width, height, card);
}

// The same card for a game whose screen is made of page elements and not a canvas: fills `into` (a box laid over the screen) with the title, the
// lines and the start, as a heading and paragraphs, for the game's stylesheet to set.
export function fillGuide(into: HTMLElement, guide: Guide): void {
  const title = into.ownerDocument.createElement("h2");
  title.textContent = guide.title;
  const lines = linesFor(guide).map((line) => {
    const item = into.ownerDocument.createElement("p");
    item.textContent = line;
    return item;
  });
  const start = into.ownerDocument.createElement("p");
  start.className = "guide-start";
  start.textContent = startLineFor(guide.start);
  into.replaceChildren(title, ...lines, start);
}
