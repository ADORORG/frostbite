import { wayCount } from "../rules/constants.ts";

// A direction from a stick, a finger or the keys, as one of the rules' sixteen ways (clockwise from up, which is north, away from the
// camera). A way is held until the direction is clearly in the next one, so a thumb resting on the line between two ways does not flicker
// between them (and fill the run's record with changes).
const sector = (Math.PI * 2) / wayCount;
const holdMargin = (6 * Math.PI) / 180;

export function wayOf(dx: number, dy: number, held: number): number {
  if (dx === 0 && dy === 0) return -1;
  // Up the screen is north: the angle runs clockwise from it.
  const angle = Math.atan2(dx, -dy);
  if (held >= 0) {
    const centre = held * sector;
    let off = (angle - centre) % (Math.PI * 2);
    if (off > Math.PI) off -= Math.PI * 2;
    if (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) <= sector / 2 + holdMargin) return held;
  }
  return (Math.round(angle / sector) + wayCount) % wayCount;
}

// The way of a stick or a drag, or none inside its dead zone.
export function wayOfStick(
  dx: number,
  dy: number,
  dead: number,
  held: number,
): number {
  return Math.hypot(dx, dy) < dead ? -1 : wayOf(dx, dy, held);
}
