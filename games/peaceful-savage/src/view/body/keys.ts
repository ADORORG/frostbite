import type { HandKey } from "../../rules/constants.ts";
import type { Pose } from "./rig.ts";

// The six hand-keys as the lore gives them, each a pose that may move with its phase (0 to 1):
// - the cup: both palms up at the chest, fingers curled;
// - the comb: fingers drawn slowly across the air, left to right;
// - the knot: a fist wrapped inside the other palm, held at the heart;
// - the knock: two taps on the sternum, then one open palm forward;
// - the split: two fingers drawn apart;
// - the let-go: both palms open, and fall.
export const both = (values: Readonly<Record<string, number>>): Pose => {
  const pose: Record<string, number> = {};
  for (const [name, value] of Object.entries(values)) {
    pose[`${name}L`] = value;
    pose[`${name}R`] = value;
  }
  return pose;
};

export const hand = (
  curl: number,
  thumb = curl * 0.7,
): Record<string, number> => ({
  index: curl,
  middle: curl,
  pinky: curl,
  ring: curl,
  thumb,
});

// Only one side's values of a pose.
export const side = (pose: Pose, from: "L" | "R"): Pose => {
  const picked: Record<string, number> = {};
  for (const [name, value] of Object.entries(pose))
    if (name.endsWith(from) && typeof value === "number") picked[name] = value;
  return picked;
};

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (t: number): number => t * t * (3 - 2 * t);

const loose = (): Pose =>
  side(both({ ...hand(0.3), "arm.side": 0.06, elbow: 0.2 }), "L");

function knock(phase: number): Pose {
  if (phase < 0.6) {
    const tap = Math.max(0, Math.sin((phase / 0.6) * Math.PI * 4)) * 0.22;
    return {
      ...loose(),
      ...side(both(hand(1.45, 1.0)), "R"),
      "arm.frontR": 0.55,
      "arm.sideR": -0.25,
      "arm.twistR": -0.6,
      elbowR: 2.3 - tap,
    };
  }
  const open = ease((phase - 0.6) / 0.4);
  return {
    ...loose(),
    ...side(both(hand(1.4 * (1 - open))), "R"),
    "arm.frontR": mix(0.55, 1.45, open),
    "arm.sideR": mix(-0.25, 0.05, open),
    "arm.twistR": mix(-0.6, 0, open),
    elbowR: mix(2.3, 0.25, open),
    "fore.twistR": mix(0.2, -1.4, open),
    "wrist.bendR": -0.9 * open,
  };
}

export function handKey(key: HandKey, phase: number): Pose {
  const t = ease(Math.min(1, Math.max(0, phase)));
  switch (key) {
    case "cup":
      return {
        ...both({
          ...hand(0.55, 0.4),
          "arm.front": 0.55,
          "arm.side": 0.12,
          "arm.twist": -0.5,
          elbow: 1.95,
          "fore.twist": 1.45,
          "wrist.bend": -0.15,
        }),
        "chest.bend": 0.05,
        "head.nod": 0.2,
      };
    case "comb":
      return {
        ...side(both({ ...hand(0.12, 0.2), spread: 0.45 }), "R"),
        ...loose(),
        "arm.frontR": 1.25,
        "arm.sideR": mix(-0.35, 0.75, t),
        elbowR: 0.35,
        "fore.twistR": -0.4,
        "head.turn": mix(0.35, -0.45, t),
        "spine.twist": mix(0.2, -0.25, t),
      };
    case "knot":
      return {
        ...both({
          "arm.front": 0.72,
          "arm.side": -0.12,
          "arm.twist": -0.7,
          elbow: 2.0,
          "fore.twist": 0.4,
          "wrist.bend": 0.2,
        }),
        ...side(both(hand(1.55, 1.1)), "R"),
        ...side(both(hand(0.95, 0.9)), "L"),
        "chest.bend": 0.08,
      };
    case "knock":
      return knock(phase);
    case "split": {
      const fingers = {
        index: 0,
        middle: 0,
        pinky: 1.5,
        ring: 1.5,
        thumb: 1.1,
      };
      return {
        ...both({
          ...fingers,
          "arm.front": 1.25,
          "arm.side": mix(-0.25, 0.85, t),
          elbow: mix(0.9, 0.2, t),
          "fore.twist": -0.3,
          spread: 0.3,
        }),
        "head.nod": -0.1,
      };
    }
    case "letgo":
      return {
        ...both({
          ...hand(0.05, 0.1),
          "arm.front": mix(1.5, 0.15, t),
          "arm.side": mix(0.35, 0.15, t),
          elbow: mix(0.35, 0.15, t),
          "fore.twist": 1.2 * (1 - t),
          spread: 0.45,
        }),
        "head.nod": mix(-0.25, 0.15, t),
      };
  }
}

// The whole knock of the end: a big fist, opened wide, two taps on the chest, one palm to the sky.
export function openHand(phase: number): Pose {
  if (phase < 0.25)
    return {
      ...both({ ...hand(1.6, 1.2), "arm.front": 0.9, elbow: 1.6 }),
      "chest.bend": 0.12,
    };
  if (phase < 0.45)
    return both({
      ...hand(0, 0),
      "arm.front": 0.9,
      "arm.side": 0.6,
      elbow: 0.6,
      spread: 0.5,
    });
  if (phase < 0.75) return knock(((phase - 0.45) / 0.3) * 0.6);
  return {
    ...both({
      ...hand(0, 0),
      "arm.front": 2.2,
      "arm.side": 0.25,
      elbow: 0.25,
      "fore.twist": 1.4,
    }),
    "head.nod": -0.35,
  };
}
