import type { HeroId } from "../../rules/constants.ts";
import { both, hand, handKey, side } from "./keys.ts";
import type { Pose } from "./rig.ts";

// The body's other words: standing at rest, the Savage Breath, leaning in, sitting, the huddle, the let-go dance, and how each of the
// family stands about or keeps busy where they are found.
export const rest: Pose = both({
  ...hand(0.3, 0.3),
  "arm.side": 0.06,
  elbow: 0.18,
});

// The Savage Breath: the chest and shoulders rise on the breath in, and let go on the breath out.
export const breathIn: Pose = {
  ...both({
    ...hand(0.15, 0.2),
    "arm.side": 0.3,
    clavicle: 0.18,
    elbow: 0.35,
    "fore.twist": 0.9,
  }),
  "chest.bend": -0.1,
  "head.nod": -0.15,
};
export const breathOut: Pose = {
  ...both({ ...hand(0.35, 0.3), "arm.side": 0.04, elbow: 0.12 }),
  "head.nod": 0.12,
  "hips.drop": -0.015,
};

// Folded arms: the upper arms turned in, so the forearms cross the body.
const folded = both({
  "arm.front": 0.35,
  "arm.side": 0.08,
  "arm.twist": -1.25,
  elbow: 1.85,
  ...hand(0.6),
});

// Back to a wall, one foot up against it, arms folded: the lead leaning in.
export const lean: Pose = {
  ...folded,
  "spine.bend": -0.22,
  "head.nod": 0.15,
  "head.tilt": 0.12,
  "leg.frontL": 0.45,
  kneeL: 0.95,
  ankleL: 0.3,
  "hips.roll": 0.06,
};

// Sitting: on a bed, a chair, the floor beside someone.
export const sit = (legLength: number): Pose => ({
  ...both({
    "leg.front": 1.45,
    knee: 1.5,
    ankle: 0.1,
    "arm.front": 0.55,
    elbow: 0.9,
    ...hand(0.4),
  }),
  "hips.drop": -legLength * 0.52,
  "spine.bend": 0.12,
});

// The huddle: arms round the ones either side, everyone leaning in.
export const huddle: Pose = {
  ...both({ "arm.side": 1.15, "arm.front": 0.35, elbow: 0.7, ...hand(0.5) }),
  "spine.bend": 0.38,
  "head.nod": 0.3,
};

// Hand in hand in a line, facing the screen: each arm angled to meet the hand of the one beside, a grown-up's down to a child's, a
// child's up to a grown-up's (the angles fit each one's height and reach, so the hands meet). `line` is the place from the screen's
// left: Daddy, Kai, Zora, Mama; facing the screen, a body's left is the screen's right.
const reachLeft = [0.23, 0.42, 1.6, 0.15];
const reachRight = [0.15, 1.23, 0.96, 0.12];

export function holdHands(line: number): Pose {
  return {
    ...both({ ...hand(0.45, 0.35), "arm.front": 0.08, elbow: 0.05 }),
    "arm.sideL": reachLeft[line] ?? 0.15,
    "arm.sideR": reachRight[line] ?? 0.15,
    "chest.bend": -0.06,
    "head.nod": -0.08,
  };
}

// The big hug for the picture: side by side, facing the screen, the children a little in front. Daddy's arm goes behind Kai, Mama's
// behind Zora, and Kai's behind his sister; Zora holds Sparky in her cupped hands in the middle. Nothing crosses a face. `line` is the
// place from the screen's left: Daddy, Kai, Zora, Mama. Facing the screen, a body's left is the screen's right.
const behindChild = {
  ...hand(0.4),
  "arm.side": 0.28,
  "arm.front": -0.05,
  elbow: 0.3,
};
const behindSister = {
  ...hand(0.4),
  "arm.side": 0.3,
  "arm.front": 0.02,
  elbow: 0.3,
};
const backToParent = {
  ...hand(0.4),
  "arm.side": 0.15,
  "arm.front": -0.3,
  elbow: 0.25,
};
const free = { ...hand(0.3, 0.3), "arm.side": 0.06, elbow: 0.18 };
const toTheirLeft = [behindChild, behindSister, free, free];
const toTheirRight = [free, backToParent, free, behindChild];
const leanIn = [-0.15, -0.08, 0, 0.15];

export function portraitHug(line: number): Pose {
  const lean = leanIn[line] ?? 0;
  // Zora's cup is held low, at her middle, so the light she holds is below her face.
  if (line === 2)
    return {
      ...handKey("cup", 1),
      ...both({ "arm.front": 0.2, elbow: 1.3 }),
      "head.nod": -0.05,
      "head.tilt": 0.05,
    };
  return {
    ...side(both(toTheirLeft[line] ?? free), "L"),
    ...side(both(toTheirRight[line] ?? free), "R"),
    "head.tilt": lean,
    "spine.side": lean * 0.4,
    "chest.bend": -0.04,
  };
}

// Flying: arms spread wide, chest lifted, looking up.
export const soar: Pose = {
  ...both({
    ...hand(0.1, 0.1),
    "arm.side": 1.3,
    "arm.front": 0.25,
    elbow: 0.1,
  }),
  "chest.bend": -0.12,
  "head.nod": -0.25,
};

// The let-go dance: hips that sway, arms up, a little bounce (Zora's ziggle is quicker).
export function dance(phase: number, quick: boolean): Pose {
  const beat = Math.sin(phase * Math.PI * 2 * (quick ? 2 : 1));
  return {
    // Arms up and open in a V to the beat, the face clear between them.
    ...both({
      "arm.front": 0.35,
      "arm.side": 2.0 + beat * 0.25,
      elbow: 0.45 + beat * 0.3,
      ...hand(0.1),
    }),
    "hips.roll": beat * 0.12,
    "hips.sway": beat * 0.05,
    "hips.drop": -Math.abs(beat) * 0.04,
    "head.tilt": -beat * 0.15,
    "spine.side": beat * 0.12,
  };
}

// How each of the family stands when nothing is asked of them.
export function idle(hero: HeroId, time: number, found: boolean): Pose {
  const sway = Math.sin(time * 1.3);
  switch (hero) {
    case "kai":
      return {
        ...folded,
        "head.tilt": 0.1,
        "hips.roll": 0.07,
        "hips.sway": 0.025,
      };
    case "zora":
      return {
        ...rest,
        "hips.drop": -Math.abs(Math.sin(time * 2.6)) * 0.02,
        "spine.side": sway * 0.05,
        "arm.sideL": 0.2 + sway * 0.08,
        "arm.sideR": 0.2 - sway * 0.08,
      };
    case "heerah":
      return {
        ...rest,
        "arm.sideL": 0.55,
        elbowL: 1.7,
        "arm.twistL": -0.9,
        "hips.roll": -0.08 + sway * 0.02,
        "head.tilt": sway * 0.05,
      };
    case "ali":
      return found
        ? { ...rest, "hips.roll": 0.04, "head.nod": -0.05 }
        : {
            ...both({ ...hand(1.55, 1.1), "arm.front": 0.25, elbow: 0.35 }),
            "spine.bend": 0.1,
          };
  }
}

// What each is busy with where they are found: Kai on the porch fitting his crystal tower together, Zora in the meadow reaching up after
// the fireflies, Mama at the tree with her hands on its bark, Daddy at his desk with his fists shut.
export function busy(hero: HeroId, time: number, legLength: number): Pose {
  const turn = time * 2.2;
  switch (hero) {
    case "kai":
      return {
        ...both({
          "arm.front": 1.1,
          "arm.twist": -0.5,
          elbow: 1.2 + Math.sin(turn) * 0.15,
          ...hand(0.7),
        }),
        "spine.bend": 0.5,
        "head.nod": 0.35,
      };
    case "zora":
      return {
        ...both({ elbow: 0.35, ...hand(0.25) }),
        "arm.frontL": 2.5 + Math.sin(turn) * 0.25,
        "arm.sideL": 0.35,
        "arm.frontR": 2.2 - Math.sin(turn) * 0.25,
        "arm.sideR": 0.5,
        "head.nod": -0.45,
        "spine.bend": -0.12,
        "hips.drop": -Math.abs(Math.sin(turn * 0.8)) * 0.03,
      };
    case "heerah":
      return {
        ...both({
          "arm.front": 1.0 + Math.sin(turn) * 0.1,
          elbow: 0.9,
          ...hand(0.3),
        }),
        "head.tilt": Math.sin(time) * 0.12,
      };
    case "ali":
      return {
        ...sit(legLength),
        ...both({
          ...hand(1.6, 1.2),
          "arm.front": 0.95,
          "arm.twist": -0.4,
          elbow: 1.2,
        }),
        "spine.bend": 0.35,
        "head.nod": 0.4,
      };
  }
}
