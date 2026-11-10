import {
  createGuideLayer,
  type GuideLayer,
} from "@frostbite/game-sdk/guide-layer";
import { linesFor, startLineFor, type Card } from "@frostbite/game-sdk/guide";

import {
  freeArea,
  goalLines,
  guide,
  planCard,
  type Area,
  type Spot,
} from "./card-plan.ts";

// The first screen's card, drawn by the SDK's card layer at the pixels of the display so it stays sharp: the game's name and its goal along
// the top of the room the hero select leaves free, and the controls and how to begin along the bottom. The hero in the middle is not dimmed,
// so the turntable stays in sight; each block has a dark fade of its own behind it.
export { freeArea, goalLines, guide, planCard } from "./card-plan.ts";
export type { Area, Box, Plan, Spot } from "./card-plan.ts";

const colours = {
  goal: "#9fd8f2",
  line: "#eaf6ff",
  shadow: "#0B0A08",
  start: "#3FE0A0",
  title: "#eaf6ff",
} as const;
const font = 'ui-monospace, "Cascadia Mono", Menlo, "Courier New", monospace';
function write(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
): void {
  context.font = `bold ${String(size)}px ${font}`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = colours.shadow;
  context.fillText(text, x + size / 14, y + size / 14);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

// A dark fade behind a block of writing, from full at (`x0`, `y0`) to nothing at (`x1`, `y1`), over the box given.
function fade(
  context: CanvasRenderingContext2D,
  from: readonly [number, number],
  to: readonly [number, number],
  box: Area,
): void {
  const shade = context.createLinearGradient(from[0], from[1], to[0], to[1]);
  shade.addColorStop(0, "rgba(11, 10, 8, 0.78)");
  shade.addColorStop(1, "rgba(11, 10, 8, 0)");
  context.fillStyle = shade;
  context.fillRect(box.x, box.y, box.width, box.height);
}

// Draws the first-screen card into `area`. A card after a run is not drawn here: the game shows its own.
export function drawGuideCard(
  context: CanvasRenderingContext2D,
  area: Area,
  card: Card,
  touch = false,
): void {
  if ("rows" in card || area.width < 40 || area.height < 40) return;
  const plan = planCard(area, card, touch);
  const { at, middle, size, unit } = plan;
  const bottom = area.y + area.height;
  if (plan.side)
    fade(context, [plan.left, 0], [plan.right + unit * 2, 0], {
      height: bottom,
      width: plan.right + unit * 2 - area.x,
      x: area.x,
      y: 0,
    });
  else {
    const topEnd = at.goal + size.goal * 3.6 + unit * 1.2;
    fade(context, [0, area.y], [0, topEnd], {
      height: topEnd - area.y,
      width: area.width,
      x: area.x,
      y: area.y,
    });
    const from = at.lines - unit * 2;
    fade(context, [0, bottom], [0, from], {
      height: bottom - from,
      width: area.width,
      x: area.x,
      y: from,
    });
  }
  write(context, card.title, middle, at.title, size.title, colours.title);
  goalLines.forEach((line, index) =>
    write(
      context,
      line,
      middle,
      at.goal + size.goal * 1.45 * index,
      size.goal,
      colours.goal,
    ),
  );
  linesFor(card).forEach((line, index) =>
    write(
      context,
      line,
      middle,
      at.lines + size.line * 1.45 * index,
      size.line,
      colours.line,
    ),
  );
  write(
    context,
    startLineFor(card.start, card.touchStart),
    middle,
    at.start,
    size.start,
    colours.start,
  );
}

// The icons and the way out along the top of a touch screen, which the card keeps clear of, in pixels.
const touchInset = 52;

const areaOf = (
  screen: HTMLCanvasElement,
  panel: HTMLElement,
  touch: boolean,
): Area =>
  freeArea(
    screen.getBoundingClientRect(),
    panel.getBoundingClientRect(),
    touch ? touchInset : 0,
  );

// Where the hero select leaves its hero in sight, as shares of the screen: what the camera frames the turntable by.
export function heroFrame(
  screen: HTMLCanvasElement,
  panel: HTMLElement,
  touch: boolean,
): Spot {
  const box = screen.getBoundingClientRect();
  if (box.width < 40 || box.height < 40) return { height: 1, x: 0.5, y: 0.5 };
  const { hero } = planCard(areaOf(screen, panel, touch), guide, touch);
  return {
    height: hero.height / box.height,
    x: hero.x / box.width,
    y: hero.y / box.height,
  };
}

// The card layer over `screen`, drawing into the room `panel` (the hero select) leaves free.
export const createFirstCard = (
  screen: HTMLCanvasElement,
  panel: HTMLElement,
  touch: boolean,
): GuideLayer =>
  createGuideLayer(screen, {
    draw: (context, _width, _height, card) =>
      drawGuideCard(context, areaOf(screen, panel, touch), card, touch),
  });
