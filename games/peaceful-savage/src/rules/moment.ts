import { refuse } from "@frostbite/game-sdk/run-inputs";
import type { Stepped } from "@frostbite/game-sdk/run-record";

import {
  beatLead,
  breathInTicks,
  breathOutTicks,
  handKeys,
  type HeroId,
  heroIds,
  points,
} from "./constants.ts";
import { finish } from "./finish.ts";
import { greyAt, greyHomes } from "./greys.ts";
import {
  breathPracticePoints,
  breathSkill,
  light,
  masteryCap,
  spark,
  withLight,
  withMastery,
  withSpark,
} from "./growth.ts";
import { believed, heartened } from "./greying.ts";
import { choiceIds, type MomentKind, script, type Step } from "./moments.ts";
import {
  breathSlack,
  goodWindow,
  perfectWindowOf,
  withColour,
  withNews,
  withPoints,
} from "./state.ts";
import type { Moment, PlayState } from "./types.ts";

const ok = (state: PlayState): Stepped<PlayState> => ({ ok: true, state });

const argOf = (moment: Moment): number =>
  Math.max(0, moment.kind === "practice" ? moment.skill : moment.arg);
export const stepsOf = (moment: Moment): readonly Step[] =>
  script(moment.kind, argOf(moment));

export const stepOf = (state: PlayState): Step | null => {
  const { moment } = state;
  if (moment === null) return null;
  return stepsOf(moment)[moment.step] ?? null;
};

// A step begins: a beat is set to land `beatLead` ticks from now; anything else waits for the player.
function opened(moment: Moment, step: Step | undefined, tick: number): Moment {
  return {
    ...moment,
    exhaleUntil: -1,
    holding: -1,
    since: tick,
    target: step?.kind === "beat" ? tick + beatLead : -1,
  };
}

export function beginMoment(
  state: PlayState,
  kind: MomentKind,
  arg = -1,
): PlayState {
  const blank: Moment = {
    arg: kind === "practice" ? -1 : arg,
    exhaleUntil: -1,
    holding: -1,
    kind,
    since: state.tick,
    skill: kind === "practice" ? arg : -1,
    step: 0,
    target: -1,
  };
  const first = stepsOf(blank)[0];
  return withNews(
    { ...state, moment: opened(blank, first, state.tick), moving: -1 },
    "moment",
    kind,
  );
}

// The next step, or the end of the moment once its last step is done.
function advanced(state: PlayState): PlayState {
  const { moment } = state;
  if (moment === null) return state;
  const steps = stepsOf(moment);
  const step = moment.step + 1;
  if (step >= steps.length) return finish({ ...state, moment: null }, moment);
  return {
    ...state,
    moment: opened({ ...moment, step }, steps[step], state.tick),
  };
}

// Practice adds to the skill's mastery and to the lead's light, and says so when a skill is mastered. Nothing else grows mastery.
function practised(
  state: PlayState,
  moment: Moment,
  mastery: number,
  gained: number,
): PlayState {
  if (moment.kind !== "practice") return state;
  const before = state.mastery[moment.skill] ?? 0;
  const grown = withLight(withMastery(state, moment.skill, mastery), gained);
  return before < masteryCap && (grown.mastery[moment.skill] ?? 0) >= masteryCap
    ? withNews(grown, "mastered", String(moment.skill))
    : grown;
}

// A press on a beat: perfect, good, or off the beat (which sets the beat again).
function beat(state: PlayState, step: Step, moment: Moment): PlayState {
  const key = step.kind === "beat" ? step.key : undefined;
  const off = Math.abs(state.tick - moment.target);
  if (off > goodWindow(state, key)) return missed(state, moment);
  const perfect = off <= perfectWindowOf(state);
  const six = perfect && step.kind === "beat" && step.six === true ? 1 : 0;
  const scored = withSpark(
    withPoints(
      {
        ...withNews(state, perfect ? "beat-perfect" : "beat-good", key ?? ""),
        beatsGood: state.beatsGood + (perfect ? 0 : 1),
        beatsPerfect: state.beatsPerfect + (perfect ? 1 : 0),
        finalePerfect: state.finalePerfect + six,
      },
      perfect ? points.beatPerfect : points.beatGood,
    ),
    perfect ? spark.beatPerfect : 0,
  );
  const gained = perfect ? light.perfect : light.good;
  return advanced(practised(scored, moment, gained, gained));
}

function missed(state: PlayState, moment: Moment): PlayState {
  return withNews(
    withSpark(
      {
        ...state,
        beatsMissed: state.beatsMissed + 1,
        moment: { ...moment, target: state.tick + beatLead },
      },
      spark.beatMiss,
    ),
    "beat-miss",
  );
}

// The act key within a moment: a beat, the start of a breath in, or the lean.
export function actInMoment(state: PlayState): Stepped<PlayState> {
  const { moment } = state;
  const step = stepOf(state);
  if (moment === null || step === null) return refuse("no moment is going");
  if (step.kind === "beat") return ok(beat(state, step, moment));
  if (step.kind === "lean" || step.kind === "huddle" || step.kind === "centre")
    return ok(advanced(withNews(state, "moment", step.kind)));
  if (step.kind === "choose") return refuse("this step is a choice");
  if (moment.holding >= 0 || moment.exhaleUntil >= 0)
    return refuse("a breath is already going");
  return ok(
    withNews(
      { ...state, moment: { ...moment, holding: state.tick } },
      "breath-in",
    ),
  );
}

// Letting go of the act key ends a breath in: four counts, near enough, and the breath out begins; too short or too long, and it is
// begun again.
export function release(state: PlayState): Stepped<PlayState> {
  const { moment } = state;
  if (moment === null || stepOf(state)?.kind !== "breath" || moment.holding < 0)
    return refuse("no breath is being held");
  const held = state.tick - moment.holding;
  if (Math.abs(held - breathInTicks) > breathSlack(state))
    return ok(
      withNews({ ...state, moment: { ...moment, holding: -1 } }, "breath-miss"),
    );
  return ok(
    withNews(
      {
        ...state,
        moment: {
          ...moment,
          exhaleUntil: state.tick + breathOutTicks,
          holding: -1,
        },
      },
      "breath-out",
    ),
  );
}

// One of the two answers. The true one carries the moment on (and heals a grey one) and warms the spark; the trick does not, and dims it.
export function choose(state: PlayState, option: number): Stepped<PlayState> {
  const { moment } = state;
  const step = stepOf(state);
  if (moment === null || step?.kind !== "choose")
    return refuse("there is nothing to choose");
  if (option !== 0 && option !== 1) return refuse("an option is 0 or 1");
  const truth = state.answers[choiceIds.indexOf(step.choice)] ?? 0;
  if (option === truth) {
    const honest = heartened(withSpark(state, spark.truth));
    return ok(
      moment.kind === "grey" ? healed(honest, moment.arg) : advanced(honest),
    );
  }
  // Mirror force turns a believed trick back on itself: a charge is spent, and the choice is offered again.
  if (state.mirrorForce > 0)
    return ok(
      withNews(
        { ...state, mirrorForce: state.mirrorForce - 1 },
        "reflected",
        step.choice,
      ),
    );
  const tricked = believed(
    withNews(
      withSpark({ ...state, tricks: state.tricks + 1 }, spark.tricked),
      "tricked",
      step.choice,
    ),
  );
  if (moment.kind !== "grey" || tricked.ended) return ok(tricked);
  return ok({
    ...tricked,
    greyTricks: tricked.greyTricks + 1,
    greys: tricked.greys.map((grey, index) =>
      index === moment.arg
        ? { ...grey, fooled: grey.fooled + 1, spot: (grey.spot + 1) % 3 }
        : grey,
    ),
    moment: null,
  });
}

// A grey one answered truly turns gold, and lets its thread fall where it was.
function healed(state: PlayState, which: number): PlayState {
  const grey = state.greys[which];
  const home = greyHomes[which];
  if (grey === undefined || home === undefined)
    return { ...state, moment: null };
  const at = greyAt(home, grey.spot, grey.phase, state.tick);
  const greys = state.greys.map((each, index) =>
    index === which
      ? { ...each, dropX: at.x, dropZ: at.z, healed: true, thread: 1 as const }
      : each,
  );
  const bonus = grey.fooled === 0 ? points.firstAnswer : 0;
  const warmed = withSpark(
    withPoints({ ...state, greys, moment: null }, points.healed + bonus),
    spark.healed,
  );
  return withNews(withColour(warmed, home.zone, 30), "healed", String(which));
}

// What a tick does inside a moment: a beat let pass is missed; a breath held too long is begun again; a breath out counted to its end
// finishes the breath, and fills the spark.
export function momentTick(state: PlayState): PlayState {
  const { moment } = state;
  const step = stepOf(state);
  if (moment === null || step === null) return state;
  if (
    step.kind === "beat" &&
    state.tick > moment.target + goodWindow(state, step.key)
  )
    return missed(state, moment);
  if (step.kind !== "breath") return state;
  if (
    moment.holding >= 0 &&
    state.tick - moment.holding > breathInTicks + breathSlack(state)
  )
    return withNews(
      { ...state, moment: { ...moment, holding: -1 } },
      "breath-miss",
    );
  if (moment.exhaleUntil < 0 || state.tick < moment.exhaleUntil) return state;
  const breathed = heartened(
    withSpark(
      withPoints({ ...state, breaths: state.breaths + 1 }, points.breath),
      spark.breath,
    ),
  );
  return advanced(
    practised(breathed, moment, breathPracticePoints, light.breathPractice),
  );
}

export const isHero = (kind: MomentKind): kind is HeroId =>
  heroIds.some((hero) => hero === kind);

// The name of a skill: a hand-key, or the breath.
export const skillName = (skill: number): string =>
  handKeys[skill] ?? (skill === breathSkill ? "breath" : "");
