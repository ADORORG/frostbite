import { Vector3 } from "three";

import type { HeroId } from "../rules/constants.ts";
import { blocked } from "../rules/geometry.ts";
import { walls } from "../rules/layout.ts";

// Where the found walk with the lead: close, at their sides, never in single file behind them, so the camera behind the lead sees past
// them. With Kai leading, Zora walks close behind him at his left, Mama beside her further left, and Daddy close on his right; with the
// others leading, the same shape: the youngest close behind at the left, Mama (or the other child) beside them, Daddy (or Kai) on the
// right. A place in a wall, or with a wall between it and the lead (along a wall, in a doorway), is no place: they take the same place
// on the other side, or else close behind, and only where none of those is clear fall in on the lead's own path for a moment.
export const company: Readonly<Record<HeroId, readonly HeroId[]>> = {
  ali: ["zora", "heerah", "kai"],
  heerah: ["zora", "kai", "ali"],
  kai: ["zora", "heerah", "ali"],
  zora: ["kai", "heerah", "ali"],
};

// The three places in the lead's own frame, in metres: across to the lead's left (or right, below zero), and back behind them.
const places = [
  { across: 0.62, back: 0.38 },
  { across: 1.2, back: 0.5 },
  { across: -0.72, back: 0.12 },
];

// Which of the places one of the family walks in with this lead (-1 for the lead themself).
export const placeWith = (lead: HeroId, hero: HeroId): number =>
  company[lead].indexOf(hero);

const clearAt = (point: Vector3): boolean =>
  !blocked(
    { x: Math.round(point.x * 1000), z: Math.round(point.z * 1000) },
    walls,
  );

// The place `place` beside the lead at `lead`, facing `yaw`: as asked, or the same on the other side, or close behind; never on top of
// one already `taken`; null where there is no room for any of them.
export function besideLead(
  lead: Vector3,
  yaw: number,
  place: number,
  taken: readonly Vector3[] = [],
): Vector3 | null {
  const at = places[place];
  if (at === undefined) return null;
  // Facing +z, a body's left is +x.
  const left = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const ahead = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const tries = [
    [at.across, at.back],
    [-at.across, at.back],
    [0, 0.65 + place * 0.4],
  ] as const;
  for (const [across, back] of tries) {
    const there = lead
      .clone()
      .addScaledVector(left, across)
      .addScaledVector(ahead, -back);
    const free = taken.every((one) => one.distanceTo(there) > 0.5);
    if (
      free &&
      [0.4, 0.7, 1].every((along) => clearAt(lead.clone().lerp(there, along)))
    )
      return there;
  }
  return null;
}

// Where each of the found walks with the lead (null where there is no room beside them), the nearest places settled first.
export function walkingPlaces(
  lead: HeroId,
  at: Vector3,
  yaw: number,
  party: readonly HeroId[],
): ReadonlyMap<HeroId, Vector3 | null> {
  const taken: Vector3[] = [];
  const settled = new Map<HeroId, Vector3 | null>();
  const order = party
    .filter((hero) => hero !== lead)
    .sort((a, b) => placeWith(lead, a) - placeWith(lead, b));
  for (const hero of order) {
    const there = besideLead(
      at,
      yaw,
      Math.max(0, placeWith(lead, hero)),
      taken,
    );
    if (there !== null) taken.push(there);
    settled.set(hero, there);
  }
  return settled;
}
