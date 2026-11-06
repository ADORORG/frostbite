import { attachZones } from "@frostbite/game-sdk/touch-zones";

import type { Action } from "./hands.ts";

// Where the thumbs go on a touch screen, the same in every level. The left half of the screen is a stick: pushed one of eight ways from its
// middle, it holds that way (two of them on a slant). The right half acts (jump, talk, use, dance) and fires (or paints). The game's screen
// keeps its 16:9 shape inside the box it is shown in: on a box taller than that (a phone held upright) the picture sits at the top and the
// thumbs have the room under it, the act zone on the outside and fire on the inside; on a wider box (held on its side) the picture is in
// the middle with room either side, acting above and firing below. The marks drawn for them (`thumbs.css`) follow the same sums.
export type Stick =
  | "down"
  | "down-left"
  | "down-right"
  | "left"
  | "right"
  | "up"
  | "up-left"
  | "up-right";
export type Thumb = Stick | "act" | "fire";

export const shape = 16 / 9;
// A thumb this near the stick's middle (a share of the box's shorter side) is resting on it, not pushing.
export const restShare = 0.06;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const upright = (width: number, height: number): boolean =>
  width < height * shape;

// The tab (Levels or the Bag) is in the bottom left corner, under the left thumb, so the stick's middle is lifted clear of it: upright, the
// room under the picture is taken to end this share of the box's height above its foot; on its side, the middle is this share of the way
// down instead of half.
export const footShare = 0.05;
export const sideHeight = 0.4;

// The middle of the stick: in the middle of the room under the picture, halfway across the left half (upright); in the middle of the room
// to the left of the picture, or an eighth of the way in where that room is narrow, and a little above halfway down (on its side).
export function stickMiddle(width: number, height: number): Point {
  if (upright(width, height)) {
    const picture = Math.min(height, width / shape);
    return { x: width / 4, y: (picture + height * (1 - footShare)) / 2 };
  }
  const room = (width - height * shape) / 2;
  return { x: Math.max(room / 2, width / 8), y: height * sideHeight };
}

// The eight ways, by the eighth of a turn they point to (clockwise from right, as the page's y runs down).
const ways: readonly Stick[] = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
];

export function thumbAt(
  x: number,
  y: number,
  width: number,
  height: number,
): Thumb | null {
  if (x >= width / 2) {
    if (upright(width, height)) return x >= (width * 3) / 4 ? "act" : "fire";
    return y < height / 2 ? "act" : "fire";
  }
  const middle = stickMiddle(width, height);
  const dx = x - middle.x;
  const dy = y - middle.y;
  if (Math.hypot(dx, dy) < restShare * Math.min(width, height)) return null;
  const eighth = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ways[(eighth + 8) % 8] ?? null;
}

// What a thumb on each zone holds.
export const thumbHolds: Readonly<Record<Thumb, readonly Action[]>> = {
  act: ["act"],
  down: ["down"],
  "down-left": ["down", "left"],
  "down-right": ["down", "right"],
  fire: ["fire"],
  left: ["left"],
  right: ["right"],
  up: ["up"],
  "up-left": ["up", "left"],
  "up-right": ["up", "right"],
};

// Two thumbs may hold one action (both on a slant to the left): it is let go of only when neither does.
export function createHeld(hold: (action: Action, on: boolean) => void) {
  const counts = new Map<Action, number>();
  return {
    press(actions: readonly Action[]): void {
      for (const action of actions) {
        const count = counts.get(action) ?? 0;
        counts.set(action, count + 1);
        if (count === 0) hold(action, true);
      }
    },
    release(actions: readonly Action[]): void {
      for (const action of actions) {
        const count = counts.get(action) ?? 0;
        if (count === 0) continue;
        counts.set(action, count - 1);
        if (count === 1) hold(action, false);
      }
    },
  };
}

// The thumbs on the screen's box, through the SDK's zones: each zone a finger is in holds its actions, a finger that slides to the next zone
// lets go of the first, and only a finger counts (a mouse has the keys). The SDK says where a finger is as a share of the box; the zones are
// cut by the box's own shape, so its size is asked for each time.
export function attachThumbs(
  stage: HTMLElement,
  hold: (action: Action, on: boolean) => void,
): () => void {
  const held = createHeld(hold);
  return attachZones<Thumb>(stage, {
    enter: (thumb) => held.press(thumbHolds[thumb]),
    fingersOnly: true,
    leave: (thumb) => held.release(thumbHolds[thumb]),
    slide: true,
    zoneAt: ({ x, y }) => {
      const { height, width } = stage.getBoundingClientRect();
      return thumbAt(x * width, y * height, width, height);
    },
  });
}
