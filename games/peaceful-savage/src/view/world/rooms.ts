import type { ZoneId } from "../../rules/constants.ts";
import { zoneIds } from "../../rules/constants.ts";
import type { Tone } from "../palette.ts";

// Each room's colour, as the materials painted in it see it, eased toward what the rules say so a room warms over a second or so rather
// than all at once. The meadow, the hall and the four rooms each have one.
export interface Rooms {
  // The tone a material in a room is painted with.
  readonly tones: Readonly<Record<ZoneId, Tone>>;
  // Eases every room toward its colour from the rules (0 to 100), and returns whether any is still changing.
  ease(colour: readonly number[], dt: number): boolean;
}

export function createRooms(): Rooms {
  const tones = {
    hall: { value: 0.08 },
    kids: { value: 0.08 },
    kitchen: { value: 0.08 },
    meadow: { value: 0.08 },
    office: { value: 0.08 },
    parents: { value: 0.08 },
  };
  return {
    ease(colour, dt) {
      let moving = false;
      zoneIds.forEach((zone, index) => {
        const tone = tones[zone];
        const target = (colour[index] ?? 8) / 100;
        const next =
          tone.value +
          (target - tone.value) * (1 - Math.exp(-2.4 * Math.max(0, dt)));
        moving ||= Math.abs(next - target) > 0.002;
        tone.value = Math.abs(next - target) < 0.002 ? target : next;
      });
      return moving;
    },
    tones,
  };
}

// Millimetres on the plan to metres in the world.
export const metres = (millimetres: number): number => millimetres / 1000;
