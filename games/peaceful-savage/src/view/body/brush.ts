import type { Color } from "three";

import { srgb } from "../palette.ts";
import { faceCentre, faceScale } from "./head.ts";

// Painting on the face: a point of the face (x across, y up, in head units) is a pixel of the face's picture.
export const faceSize = 512;
export type Ink = CanvasRenderingContext2D;
export type Spot = readonly [number, number];

export const at = (x: number, y: number): [number, number] => [
  (0.5 + x * faceScale) * faceSize,
  (0.5 - (y - faceCentre) * faceScale) * faceSize,
];

export const span = (length: number): number => length * faceScale * faceSize;

export const css = (colour: Color, alpha = 1): string => {
  const [r, g, b] = srgb(colour);
  return `rgba(${String(r)},${String(g)},${String(b)},${String(alpha)})`;
};

// A soft round touch of colour, strongest at its middle.
export function glow(
  ink: Ink,
  x: number,
  y: number,
  radius: number,
  colour: Color,
  alpha: number,
): void {
  const [cx, cy] = at(x, y);
  const reach = span(radius);
  const gradient = ink.createRadialGradient(cx, cy, 0, cx, cy, reach);
  gradient.addColorStop(0, css(colour, alpha));
  gradient.addColorStop(1, css(colour, 0));
  ink.fillStyle = gradient;
  ink.fillRect(cx - reach, cy - reach, reach * 2, reach * 2);
}

// A curve from one point to another, bent toward a third; it starts a new path or carries the current one on.
export function curve(
  ink: Ink,
  from: Spot,
  via: Spot,
  to: Spot,
  first: boolean,
): void {
  const a = at(...from);
  const b = at(...via);
  const c = at(...to);
  if (first) ink.moveTo(...a);
  else ink.lineTo(...a);
  ink.quadraticCurveTo(b[0], b[1], c[0], c[1]);
}

// A soft line: drawn a few times, wide and faint then narrow and stronger, so its edges melt.
export function softLine(
  ink: Ink,
  from: Spot,
  via: Spot,
  to: Spot,
  width: number,
  colour: Color,
  alpha: number,
): void {
  ink.lineCap = "round";
  for (const [grow, strength] of [
    [2.2, 0.25],
    [1.4, 0.45],
    [0.8, 1],
  ] as const) {
    ink.strokeStyle = css(colour, alpha * strength);
    ink.lineWidth = span(width * grow);
    ink.beginPath();
    curve(ink, from, via, to, true);
    ink.stroke();
  }
}
