import { both, hand } from "./keys.ts";
import type { Pose } from "./rig.ts";

// A jump, seen only (it changes nothing in the run): a quick crouch, up off both feet with the knees tucked and the arms thrown up, and
// a bend of the knees to land. A running jump goes higher and longer.
export interface Leap {
  // How far off the ground the feet are, in metres.
  readonly lift: number;
  readonly pose: Pose;
}

const crouch = 0.1;
const land = 0.14;

// How long a jump lasts, in seconds, at a walk (`run` 0) or a run (1).
export const leapSeconds = (run: number): number =>
  crouch + 0.42 + run * 0.1 + land;

// The jump `since` seconds after it began, for legs `legLength` long; null once it is over (or before it began).
export function leapAt(
  since: number,
  legLength: number,
  run: number,
): Leap | null {
  const air = 0.42 + run * 0.1;
  if (since < 0 || since >= crouch + air + land) return null;
  const bend = (deep: number, arms: number): Pose => ({
    ...both({
      "leg.front": 0.75 * deep,
      knee: 1.35 * deep,
      ankle: 0.45 * deep,
      "arm.front": arms,
      "arm.side": 0.25,
      elbow: 0.5,
      ...hand(0.35),
    }),
    "hips.drop": -legLength * 0.2 * deep,
    "spine.bend": 0.3 * deep,
  });
  if (since < crouch) return { lift: 0, pose: bend(since / crouch, -0.6) };
  const t = (since - crouch) / air;
  if (t >= 1) return { lift: 0, pose: bend(1 - (t - 1) * (air / land), 0.2) };
  // Up and down again as a thrown ball goes; the knees tuck at the top.
  const height = legLength * (0.5 + run * 0.18);
  const tuck = Math.sin(t * Math.PI);
  return {
    lift: height * 4 * t * (1 - t),
    pose: {
      ...both({
        "leg.front": 0.2 + tuck * 0.75,
        knee: 0.3 + tuck * 1.2,
        ankle: -0.5 * (1 - tuck),
        "arm.front": 0.4 + tuck * 0.5,
        "arm.side": 0.5 + tuck * 1.5,
        elbow: 0.35,
        ...hand(0.15),
      }),
      "chest.bend": -0.1 * tuck,
      "head.nod": -0.12 * tuck,
    },
  };
}
