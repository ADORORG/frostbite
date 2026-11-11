import {
  fittedSize,
  linesFor,
  startLineFor,
  type Guide,
} from "@frostbite/game-sdk/guide";

// What the first screen's card says, and where on the screen it says it: the room the hero select leaves free, the writing set in that
// room, and the place left for the hero. No drawing is done here, so the camera can ask the same questions the card does.
export const guide: Guide = {
  lines: [
    "ARROWS OR WASD: MOVE",
    "SPACE: HOP, HOLD TO HOVER",
    "SHIFT: DUCK, ROLL ON THE MOVE",
    "F SHOOT · G GROW · V FROST VISION",
  ],
  start: "ENTER TO START",
  title: "FROST RUN",
  touchLines: [
    "DRAG ANYWHERE TO MOVE",
    "HOP · DUCK · SHOOT · POWER: THE BUTTONS",
  ],
  touchStart: "TAP TO START",
};

export const goalLines = [
  "TAKE 90% OF THE CRYSTALS, EGGS AND KEYS",
  "THREE ROUNDS · SIXTY SECONDS EACH",
] as const;

// Where on the screen a card may be drawn, in the screen's own pixels.
export interface Area {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// The room the hero select leaves on the screen: beside it (a wide screen, where it stands down the right) or above it (a phone held
// upright, where it lies along the bottom), whichever is larger; the whole screen when it has no box. `inset` keeps clear of the icons and
// the way out along the top of a touch screen.
export function freeArea(screen: Box, panel: Box, inset: number): Area {
  const whole = {
    height: screen.height - inset,
    width: screen.width,
    x: 0,
    y: inset,
  };
  if (panel.width === 0 || panel.height === 0) return whole;
  const beside = Math.max(0, panel.left - screen.left);
  const above = Math.max(0, panel.top - screen.top - inset);
  return beside * whole.height >= above * screen.width
    ? { ...whole, width: beside }
    : { ...whole, height: above };
}

// A room shorter than this (a phone on its side, inside the platform's page) has its writing beside the hero and not above and below.
const sideBelow = 230;
const sideAtLeast = 380;
// The platform's way out sits in the top left corner of a touch screen; writing set beside the hero starts to the right of it.
const wayOut = 60;

// Where the hero is left in sight: the middle of that room and how tall it is, in the screen's own pixels.
export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

export interface Plan {
  readonly hero: Spot;
  readonly side: boolean;
  // The column the writing is set in, and its middle.
  readonly left: number;
  readonly right: number;
  readonly middle: number;
  readonly unit: number;
  readonly size: {
    readonly title: number;
    readonly goal: number;
    readonly line: number;
    readonly start: number;
  };
  // Where each block's first line is written.
  readonly at: {
    readonly title: number;
    readonly goal: number;
    readonly lines: number;
    readonly start: number;
  };
}

// Lays the card out in `area`: the name and the goal along the top and the controls and how to begin along the bottom, with the hero
// between them; or, where the room is too short for that, all of the writing in a column on the left and the hero beside it.
export function planCard(area: Area, card: Guide, touch: boolean): Plan {
  const lines = linesFor(card);
  const start = startLineFor(card.start, card.touchStart);
  const side = area.height < sideBelow && area.width >= sideAtLeast;
  const end = area.x + area.width;
  const bottom = area.y + area.height;
  const left = side && touch ? area.x + wayOut : area.x;
  const right = side ? end - Math.min(130, area.width * 0.3) : end;
  const top = side ? 6 : area.y;
  const tall = bottom - top;
  const room = right - left;
  const unit = side
    ? Math.min((tall - 12) / (7.7 + 1.3 * lines.length), 22)
    : Math.min(tall / 16, room / 18, 22);
  const size = {
    goal: Math.min(...goalLines.map((line) => fittedSize(line, unit, room))),
    line: Math.min(...lines.map((line) => fittedSize(line, unit * 0.9, room))),
    start: fittedSize(start, unit * 1.15, room),
    title: fittedSize(card.title, unit * (side ? 2 : 2.3), room),
  };
  const goalTall = size.goal * 1.45 * goalLines.length;
  const linesTall = size.line * 1.45 * lines.length;
  const shared = { left, middle: (left + right) / 2, right, side, size, unit };
  if (side) {
    const whole =
      size.title * 1.25 + goalTall + linesTall + size.start + unit * 1.1;
    const title = top + (tall - whole) / 2;
    const goal = title + size.title * 1.25;
    const linesAt = goal + goalTall + unit * 0.6;
    return {
      ...shared,
      at: {
        goal,
        lines: linesAt,
        start: linesAt + linesTall + unit * 0.5,
        title,
      },
      hero: { height: tall - 12, x: (right + end) / 2, y: top + tall / 2 },
    };
  }
  const title = top + unit * 0.8;
  const goal = title + size.title * 1.25;
  const startAt = bottom - unit * 0.8 - size.start;
  const linesAt = startAt - unit * 0.7 - linesTall;
  return {
    ...shared,
    at: { goal, lines: linesAt, start: startAt, title },
    hero: {
      height: Math.max(0, linesAt - goal - goalTall),
      x: shared.middle,
      y: (goal + goalTall + linesAt) / 2,
    },
  };
}
