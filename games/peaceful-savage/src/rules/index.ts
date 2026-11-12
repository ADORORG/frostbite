import {
  fieldsOf,
  refuse,
  tickNamed,
  withFields,
} from "@frostbite/game-sdk/run-inputs";
import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@frostbite/game-sdk/run-record";

import { act } from "./act.ts";
import { heroIds, maxTicks, verifierId, verifierVersion } from "./constants.ts";
import { huddleSkill, skillCount } from "./growth.ts";
import { familyFacing, familySpots } from "./layout.ts";
import { earnedBy } from "./milestones.ts";
import { actInMoment, beginMoment, choose, release } from "./moment.ts";
import { startRun } from "./state.ts";
import { advanceTo, hurry, move, vision } from "./tick.ts";
import type { PlayState } from "./types.ts";

// The rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the platform replay a
// run it issued a seed for. Every input names the tick it came on; the world is played forward to that tick, then the input is applied.
//
// Inputs, each with `{ tick }` and no other field unless named:
// - `lead` `{ tick, hero }`: who leads the run (0 Kai, 1 Zora, 2 Mama Heerah, 3 Dr. Ali), once, before anything else;
// - `move` `{ tick, way }`: walk one of sixteen ways (0 is north, round clockwise), or stand still (-1);
// - `act`: reach for the nearest thing (or, in a moment, press the beat, begin a breath in, or lean in);
// - `release`: let go of a breath in;
// - `vision`: open Savage Vision;
// - `choose` `{ tick, option }`: say one of the two things on offer (0 or 1);
// - `practice` `{ tick, skill }`: practise a skill where the lead stands (0 to 5 the hand-keys, 6 the breath, 7 the huddle, which needs
//   family to huddle with);
// - `end`: close the run as it stands.

function timed(
  state: PlayState,
  data: RunInput["data"],
  names: readonly string[],
  then: (
    state: PlayState,
    fields: Record<string, unknown>,
  ) => Stepped<PlayState>,
): Stepped<PlayState> {
  return withFields(data, ["tick", ...names], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    const at = advanceTo(state, tick);
    if (at.ended) return refuse("the run has ended");
    return then(at, fields);
  });
}

function lead(state: PlayState, hero: unknown): Stepped<PlayState> {
  if (state.lead !== null) return refuse("the lead is already chosen");
  const chosen = typeof hero === "number" ? heroIds[hero] : undefined;
  if (chosen === undefined || !Number.isInteger(hero))
    return refuse("a hero is 0 to 3");
  const place = familySpots[chosen];
  return {
    ok: true,
    state: {
      ...state,
      facing: familyFacing[chosen],
      lead: chosen,
      x: place.x,
      z: place.z,
    },
  };
}

function practice(state: PlayState, skill: unknown): Stepped<PlayState> {
  if (state.moment !== null) return refuse("a moment is going");
  if (
    typeof skill !== "number" ||
    !Number.isInteger(skill) ||
    skill < 0 ||
    skill >= skillCount
  )
    return refuse("a skill is 0 to 7");
  if (skill === huddleSkill && state.party.length === 0)
    return refuse("a huddle needs family to huddle with");
  return { ok: true, state: beginMoment(state, "practice", skill) };
}

const needsLead = (
  state: PlayState,
  then: (state: PlayState) => Stepped<PlayState>,
): Stepped<PlayState> =>
  state.lead === null ? refuse("nobody leads yet") : then(state);

function apply(state: PlayState, input: RunInput): Stepped<PlayState> {
  switch (input.type) {
    case "lead":
      return timed(state, input.data, ["hero"], (at, { hero }) =>
        lead(at, hero),
      );
    case "move":
      return timed(state, input.data, ["way"], (at, { way }) =>
        needsLead(at, (led) =>
          typeof way === "number"
            ? move(led, way)
            : refuse("a way is a number"),
        ),
      );
    case "hurry":
      return timed(state, input.data, ["fast"], (at, { fast }) =>
        needsLead(at, (led) =>
          typeof fast === "number"
            ? hurry(led, fast)
            : refuse("fast is a number"),
        ),
      );
    case "act":
      return timed(state, input.data, [], (at) =>
        needsLead(at, (led) =>
          led.moment === null ? act(led) : actInMoment(led),
        ),
      );
    case "practice":
      return timed(state, input.data, ["skill"], (at, { skill }) =>
        needsLead(at, (led) => practice(led, skill)),
      );
    case "release":
      return timed(state, input.data, [], (at) => release(at));
    case "vision":
      return timed(state, input.data, [], (at) => needsLead(at, vision));
    case "choose":
      return timed(state, input.data, ["option"], (at, { option }) =>
        typeof option === "number"
          ? choose(at, option)
          : refuse("an option is a number"),
      );
    case "end":
      return timed(state, input.data, [], (at) => ({
        ok: true,
        state: { ...at, cause: at.cause ?? "left", ended: true },
      }));
    default:
      return refuse(`no such input: ${input.type}`);
  }
}

export const savageRules: GameVerifier<PlayState> = {
  earned: earnedBy,
  id: verifierId,
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startRun(seed) };
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    return apply(state, input);
  },
  version: verifierVersion,
};
