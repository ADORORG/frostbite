import {
  beatLead,
  breathInTicks,
  breathOutTicks,
  type HeroId,
  ticksPerSecond,
} from "../rules/constants.ts";
import { creationOf } from "../rules/create.ts";
import { stepOf } from "../rules/moment.ts";
import type { NewsKind, PlayState } from "../rules/types.ts";
import type { Expression } from "./body/face.ts";
import { handKey, openHand } from "./body/keys.ts";
import {
  breathIn,
  breathOut,
  busy,
  dance,
  huddle,
  idle,
  lean,
} from "./body/poses.ts";
import type { Pose } from "./body/rig.ts";
import type { Drawing } from "./world/holograms.ts";

// What each of the family is doing in a frame, read from the state: the pose they hold (none while they walk), whether it wants their
// arms, and their face. The lead plays each step of a moment (a hand-key landing on its beat, a breath in and out, a lean, a huddle, a
// still look into a mirror); the found walk with the lead; the lost are busy where they are, troubled.
export interface Acting {
  readonly arms: boolean;
  readonly expression: Expression;
  readonly pose: Pose | null;
}

// The news that moves the story on, and makes the family glad.
export const gladNews: readonly NewsKind[] = [
  "found",
  "healed",
  "jackets",
  "level",
  "lit",
  "mastered",
  "pancakes",
  "power",
  "sparky",
  "thread",
];

// The face that goes with a spark: bright is a smile (Kai's is a smirk), low is worry.
function moodOf(
  hero: HeroId,
  spark: number,
  news: NewsKind | null,
): Expression {
  if (news !== null && gladNews.includes(news)) return "smile";
  if (news === "tricked") return "worry";
  if (news === "vision" || news === "rise") return "open";
  if (spark < 25) return "worry";
  if (hero === "kai") return "smirk";
  return spark >= 75 ? "smile" : "calm";
}

// Recent news only: what happened in the last second and a half.
const fresh = (state: PlayState): NewsKind | null =>
  state.news !== null && state.tick - state.news.tick < ticksPerSecond * 1.5
    ? state.news.kind
    : null;

// A celebration: the let-go dance when a level, a power or a mastered skill comes.
export const dancing = (state: PlayState): boolean => {
  const news = fresh(state);
  return news === "level" || news === "power" || news === "mastered";
};

export function leadActing(
  hero: HeroId,
  state: PlayState,
  time: number,
  moving: boolean,
): Acting {
  const step = stepOf(state);
  const moment = state.moment;
  const mood = moodOf(hero, state.spark, fresh(state));
  if (step === null || moment === null) {
    if (dancing(state))
      return {
        arms: true,
        expression: "smile",
        pose: dance(time * 0.8, hero === "zora"),
      };
    return {
      arms: false,
      expression: mood,
      pose: moving ? null : idle(hero, time, true),
    };
  }
  switch (step.kind) {
    case "beat": {
      // The hand-key rises to land on the beat, and holds there a moment after.
      const phase = 1 - (moment.target - state.tick) / beatLead;
      const pose =
        moment.kind === "finale" && step.key === "knock"
          ? openHand(Math.min(1, phase))
          : handKey(step.key, phase);
      return { arms: true, expression: phase > 0.9 ? "smile" : "calm", pose };
    }
    case "breath":
      if (moment.holding >= 0)
        return { arms: true, expression: "calm", pose: breathIn };
      if (moment.exhaleUntil >= 0)
        return { arms: true, expression: "calm", pose: breathOut };
      return { arms: false, expression: "calm", pose: idle(hero, time, true) };
    case "centre":
      return { arms: true, expression: "calm", pose: breathOut };
    case "lean":
      return { arms: true, expression: "calm", pose: lean };
    case "huddle":
      return { arms: true, expression: "smile", pose: huddle };
    case "choose":
      return {
        arms: false,
        expression:
          step.choice.startsWith("grey") || step.choice.startsWith("serpent")
            ? "worry"
            : mood,
        pose: idle(hero, time, true),
      };
  }
}

// One of the family walking with the lead: they join a huddle, share the lead's gladness, and otherwise go about as themselves.
export function companionActing(
  hero: HeroId,
  state: PlayState,
  time: number,
  moving: boolean,
): Acting {
  const step = stepOf(state);
  if (step?.kind === "huddle")
    return { arms: true, expression: "smile", pose: huddle };
  // In the finale everyone plays the keys; making something, its maker plays them beside the lead.
  const moment = state.moment;
  const making = creationOf(moment?.kind ?? "")?.hero === hero;
  if (
    moment !== null &&
    (moment.kind === "finale" || making) &&
    step?.kind === "beat"
  )
    return {
      arms: true,
      expression: "calm",
      pose: handKey(step.key, 1 - (moment.target - state.tick) / beatLead),
    };
  const mood = moodOf(hero, state.spark, fresh(state));
  return {
    arms: false,
    expression: mood,
    pose: moving ? null : idle(hero, time, true),
  };
}

// One of the family not yet found: busy where they are, and troubled, until the lead comes and sits with them.
export function lostActing(
  hero: HeroId,
  state: PlayState,
  time: number,
  legLength: number,
): Acting {
  const talking = state.moment?.kind === hero;
  return {
    arms: true,
    expression: talking ? "calm" : "worry",
    pose: talking ? idle(hero, time, false) : busy(hero, time, legLength),
  };
}

// The shape of light the lead is drawing, if any, and how much of it is drawn: a hand-key as it rises to its beat, a held breath its
// shield, a breath let go its field, the centring its flower, a dance its star.
export function drawingOf(state: PlayState): Drawing | null {
  const step = stepOf(state);
  const moment = state.moment;
  if (step === null || moment === null) {
    const news = state.news;
    if (news === null || !dancing(state)) return null;
    return {
      drawn: (state.tick - news.tick) / (ticksPerSecond * 1.2),
      sigil: "star",
    };
  }
  switch (step.kind) {
    case "beat":
      return {
        drawn: 1 - (moment.target - state.tick) / beatLead,
        sigil: step.key,
      };
    case "breath":
      if (moment.holding >= 0)
        return {
          drawn: (state.tick - moment.holding) / breathInTicks,
          sigil: "shield",
        };
      if (moment.exhaleUntil >= 0)
        return {
          drawn: 1 - (moment.exhaleUntil - state.tick) / breathOutTicks,
          sigil: "field",
        };
      return null;
    case "centre":
      return {
        drawn: (state.tick - moment.since) / (ticksPerSecond * 2),
        sigil: "flower",
      };
    default:
      return null;
  }
}
