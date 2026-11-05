import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

import { attachZones } from "@ador/game-sdk/touch-zones";

import type { Direction } from "../rules/constants.ts";
import { cell, screenHeight, screenWidth } from "./layout.ts";

interface Point {
  readonly x: number;
  readonly y: number;
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
// itself (within `restRadius` screen pixels of its middle) is no way at all.
export const stepRepeatMs = 150;
export const restRadius = cell / 2;

// The way from the lantern to a finger, or null when the finger is on the lantern. Both are in screen pixels.
export function steerDirection(
  lantern: Point,
  finger: Point,
): Direction | null {
  const dx = finger.x - lantern.x;
  const dy = finger.y - lantern.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < restRadius) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

// Arrow keys and WASD on the page, and fingers on the screen. `lantern` says where the lantern is on the screen now (null with no run going).
// Returns a function that stops listening.
export function attachControls(
  screen: HTMLElement,
  controls: Controls,
  lantern: () => Point | null,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase !== "down") return;
    if (action === "start" || action === "pause") controls[action]();
    else controls.move(action);
  });
  let walking: { direction: Direction; timer: number } | null = null;
  const stop = (): void => {
    if (walking !== null) window.clearInterval(walking.timer);
    walking = null;
  };
  const stopTouch = attachZones<Direction | null>(screen, {
    enter: (direction) => {
      if (direction === null) return;
      stop();
      controls.move(direction);
      walking = {
        direction,
        timer: window.setInterval(() => controls.move(direction), stepRepeatMs),
      };
    },
    fingersOnly: false,
    leave: (direction) => {
      if (walking?.direction === direction) stop();
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
