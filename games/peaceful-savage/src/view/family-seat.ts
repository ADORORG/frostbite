import { Vector3 } from "three";

import type { HeroId } from "../rules/constants.ts";
import type { Acting } from "./acting.ts";
import type { Character } from "./body/character.ts";
import type { Expression } from "./body/face.ts";
import { leapAt } from "./body/leap.ts";
import { ride, sit } from "./body/poses.ts";
import {
  ropeApart,
  seatAt,
  type Sitting,
  swingHigh,
  swingRope,
} from "./seats.ts";
import { groundAt } from "./world/meadow.ts";

// What the family does beyond walking and the story's moments, seen only: sitting down together, riding the swing, jumping.
// How one of them is shown this frame, over where and how they stand.
export interface Shown {
  readonly acting: Acting;
  // Done once the body is posed and placed (hands brought to the swing's ropes).
  readonly after?: (character: Character) => void;
  // The ground the body stands on, where that is not the meadow's own (a seat's own floor).
  readonly ground?: (x: number, z: number) => number;
  // Tipped forward (radians) about the feet.
  readonly lean?: number;
  // Carried off the ground by this much.
  readonly lift?: Vector3;
  // True when the legs are not to walk (in the air).
  readonly still?: boolean;
  readonly to: Vector3;
  readonly yaw: number;
}

const up = new Vector3(0, 1, 0);

// One of the family on a seat: where they sit and which way, sitting; on the swing, carried along its arc, hands on the ropes.
export function seated(
  hero: HeroId,
  sitting: Sitting,
  character: Character,
  expression: Expression,
): Shown | null {
  const along = sitting.along.get(hero);
  if (along === undefined) return null;
  const { seat } = sitting;
  const at = seatAt(seat, along);
  const floor = groundAt(seat.x, seat.z);
  const base = {
    ground: () => floor,
    to: new Vector3(at.x, 0, at.z),
    yaw: seat.yaw,
  };
  if (seat.kind !== "swing")
    return {
      ...base,
      acting: {
        arms: true,
        expression,
        pose: sit(character.legs, seat.height),
      },
    };
  // The swing: the whole body turns about the branch the ropes hang from.
  const angle = sitting.angle;
  const ahead = new Vector3(Math.sin(seat.yaw), 0, Math.cos(seat.yaw));
  const left = new Vector3(Math.cos(seat.yaw), 0, -Math.sin(seat.yaw));
  const upright = up
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(ahead, -Math.sin(angle));
  const pivot = new Vector3(seat.x, floor + swingHigh, seat.z);
  return {
    ...base,
    acting: {
      arms: true,
      expression: Math.abs(angle) > 0.3 ? "open" : "smile",
      pose: ride(character.legs, seat.height, angle / 0.82),
    },
    after(rider) {
      // Each hand on its rope, a little above the shoulder.
      const grip = swingRope - rider.height * 0.36;
      for (const side of ["L", "R"] as const)
        rider.reach(
          side,
          pivot
            .clone()
            .addScaledVector(left, side === "L" ? ropeApart : -ropeApart)
            .addScaledVector(upright, -grip),
          new Vector3(0, -1, 0).addScaledVector(ahead, -0.4),
        );
    },
    lean: -angle,
    lift: up
      .clone()
      .multiplyScalar(swingHigh * (1 - Math.cos(angle)))
      .addScaledVector(ahead, swingHigh * Math.sin(angle)),
  };
}

// One of the family jumping, `since` seconds after the jump began: lifted, and posed for it (null when they are not in a jump).
export function leaping(
  shown: Shown,
  since: number | null,
  character: Character,
  running: boolean,
): Shown {
  if (since === null) return shown;
  const leap = leapAt(since, character.legs, running ? 1 : 0);
  if (leap === null) return shown;
  return {
    ...shown,
    acting: { arms: true, expression: "smile", pose: leap.pose },
    lift: new Vector3(0, leap.lift, 0),
    still: leap.lift > 0,
  };
}
