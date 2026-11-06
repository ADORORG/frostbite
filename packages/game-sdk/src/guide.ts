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
  // The line that says how to begin on a touch screen, for a game that begins something particular ("TAP TO PRACTISE LEVEL 2"). Without it (or with a blank
  // one) a touch screen is told "TAP TO START".
  readonly touchStart?: string;
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

// The weights of the rows of a card (the first-screen card's title and lines too), so every card has the same shape: the heading largest, then what the run came to, then
// the best, and the line that says how to go again smallest.
export const resultWeight = {
  detail: 1.2,
  heading: 1.5,
  line: 1,
  prompt: 0.85,
} as const;

// What the card layer can show: the first-screen card or the card after a run.
export type Card = Guide | ResultCard;

const font = '"Courier New", ui-monospace, monospace';
const back = "#0c0620";
const colours = {
  line: "#ece8ff",
  start: "#ffd23f",
  title: "#38e8ff",
} as const;

// How much the screen under a card is dimmed, the share of its height the card's rows use, the share of a row's height its writing is, and
// the share of the height left clear above the first row. Both cards use the same, so they sit on the screen alike.
const dimmed = 0.84;
const usedHeight = 0.86;
const rowShare = 0.62;
const topMargin = 0.07;

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
// A touch line that is missing or blank (a game that gave none, or an empty one) is "TAP TO START": a start line of nothing tells the player nothing.
export const startLineFor = (
  keyboardLine: string,
  touchLine?: string,
): string =>
  byInput(
    keyboardLine,
    touchLine === undefined || touchLine.trim() === ""
      ? touchStartLine
      : touchLine,
  );

export const linesFor = (guide: Guide): readonly string[] =>
  isTouchScreen() && guide.touchLines !== undefined
    ? guide.touchLines
    : guide.lines;

function dim(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.globalAlpha = dimmed;
  block(context, back, 0, 0, width, height);
  context.globalAlpha = 1;
}

// What a card says of the best: the best so far, or that this run made a new one.
export const bestLine = (best: number, isNew: boolean): string =>
  isNew ? "NEW BEST!" : `BEST ${String(best)}`;

// Draws the card over a screen `width` by `height` (in the units the screen is drawn in): the screen dimmed, the title, the lines, the start.
export function drawGuide(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  guide: Guide,
): void {
  dim(context, width, height);
  const lines = linesFor(guide);
  const rows = lines.length + 2;
  const step = (height * usedHeight) / (rows + 1);
  const wanted = step * rowShare;
  const draw = (
    text: string,
    row: number,
    fill: string,
    scale: number,
  ): void => {
    const size = fittedSize(text, wanted * scale, width);
    write(
      context,
      text,
      width / 2,
      height * topMargin + step * row,
      fill,
      size,
    );
  };
  draw(guide.title, 0, colours.title, resultWeight.heading);
  lines.forEach((line, index) =>
    draw(line, index + 1.3, colours.line, resultWeight.line),
  );
  draw(
    startLineFor(guide.start, guide.touchStart),
    lines.length + 1.9,
    colours.start,
    resultWeight.line,
  );
}

// Draws the card after a run over a screen `width` by `height`: the screen dimmed, then the rows from the top, each fitted to the screen.
export function drawResult(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  card: ResultCard,
): void {
  dim(context, width, height);
  const step = (height * usedHeight) / (card.rows.length + 1);
  card.rows.forEach(({ colour, text, weight }, index) => {
    const size = fittedSize(text, step * rowShare * weight, width);
    write(
      context,
      text,
      width / 2,
      height * topMargin + step * index,
      colour,
      size,
    );
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
  start.textContent = startLineFor(guide.start, guide.touchStart);
  into.replaceChildren(title, ...lines, start);
}
