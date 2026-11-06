import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";

import { attachZones } from "@frostbite/game-sdk/touch-zones";

import type { Direction } from "../rules/constants.ts";
import { screenHeight, screenWidth } from "./layout.ts";

interface Point {
  readonly x: number;
  readonly y: number;
}

// Where the lantern is on the screen, and how wide its cell is there.
interface Lantern extends Point {
  readonly size: number;
}

// What the player's hands can do: step the lantern (with the keys, or by a finger on the screen), start a run (Enter) and pause (P or Space, since Space has no other use here).
export interface Controls {
  readonly move: (direction: Direction) => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyD: "right",
  KeyS: "down",
  KeyW: "up",
  Space: "pause",
} as const;

// A finger on the screen steers the lantern: the lantern walks toward it, one step now and then one every `stepRepeatMs` while it stays down,
// and turns as the finger moves round it. A tap is a step; a finger held to one side is a walk; a drag is a turn. A finger on the lantern
// itself (within half a cell of its middle) is no way at all.
export const stepRepeatMs = 150;

// The way from the lantern to a finger, or null when the finger is on the lantern. Both are in screen pixels.
export function steerDirection(
  lantern: Lantern,
  finger: Point,
): Direction | null {
  const dx = finger.x - lantern.x;
  const dy = finger.y - lantern.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < lantern.size / 2) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

// Arrow keys and WASD on the page, and fingers on the screen. `lantern` says where the lantern is on the screen now (null with no run going).
// Returns a function that stops listening.
export function attachControls(
  screen: HTMLElement,
  controls: Controls,
  lantern: () => Lantern | null,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase !== "down") return;
    if (action === "start" || action === "pause") controls[action]();
    else controls.move(action);
  });
  // The ways the fingers on the screen steer, in the order they began, and the walk that follows the latest of them.
  const held: Direction[] = [];
  let walking: { direction: Direction; timer: number } | null = null;
  const stop = (): void => {
    if (walking !== null) window.clearInterval(walking.timer);
    walking = null;
  };
  const walk = (direction: Direction, stepNow: boolean): void => {
    stop();
    if (stepNow) controls.move(direction);
    walking = {
      direction,
      timer: window.setInterval(() => controls.move(direction), stepRepeatMs),
    };
  };
  const stopTouch = attachZones<Direction>(screen, {
    enter: (direction) => {
      held.push(direction);
      walk(direction, true);
    },
    fingersOnly: false,
    leave: (direction) => {
      held.splice(held.indexOf(direction), 1);
      if (walking?.direction !== direction) return;
      const next = held.at(-1);
      if (next === undefined) stop();
      else walk(next, false);
    },
    slide: true,
    zoneAt: ({ x, y }) => {
      const at = lantern();
      return at === null
        ? null
        : steerDirection(at, { x: x * screenWidth, y: y * screenHeight });
    },
  });
  return () => {
    stopKeys();
    stopTouch();
    stop();
  };
}
