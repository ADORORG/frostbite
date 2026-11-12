import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import { grooveBonus, stats } from "./cast.ts";
import {
  clues,
  mirrors,
  plasmaPerZone,
  plasmaSpots,
  relics,
} from "./collect.ts";
import {
  breathSlackBase,
  breathSlackPerPoint,
  colourBeforeTheEnd,
  goodWindowBase,
  type HandKey,
  type HeroId,
  perfectWindow,
  startColour,
  visionBaseRadius,
  visionBaseTicks,
  visionRadiusPerPoint,
  visionTicksPerPoint,
  walkBase,
  walkPerPoint,
  type ZoneId,
  zoneIds,
} from "./constants.ts";
import { greyCount } from "./greys.ts";
import {
  breathSkill,
  keyMastered,
  mastered,
  moodOf,
  skillCount,
  sparkStart,
} from "./growth.ts";
import { gardenBeds, startHeading, startPoint } from "./layout.ts";
import { choiceIds } from "./moments.ts";
import { lamps, things } from "./things.ts";
import type { Grey, NewsKind, PlayState } from "./types.ts";

// A new run on a seed: the lead not yet chosen, at the front of the hall, every lamp out and every room almost grey. The seed decides
// where each grey one starts and when it circles, where the tiny plasma and the clues lie, and for every choice which of its two answers
// comes first.
export function startRun(seed: number): PlayState {
  let rng = startState(seed);
  const draw = (below: number): number => {
    const step = stepInt(rng, below);
    rng = step.state;
    return step.value;
  };
  const greys: Grey[] = [];
  for (let at = 0; at < greyCount; at += 1)
    greys.push({
      dropX: 0,
      dropZ: 0,
      fooled: 0,
      healed: false,
      phase: draw(720),
      seen: false,
      spot: draw(3),
      thread: 0,
    });
  const answers = choiceIds.map(() => draw(2));
  // In each room, `plasmaPerZone` different open points, drawn without putting one back.
  const plasmaAt = plasmaSpots.flatMap((spots) => {
    const pool = spots.map((_, index) => index);
    return Array.from(
      { length: plasmaPerZone },
      () => pool.splice(draw(pool.length), 1)[0] ?? 0,
    );
  });
  const clueAt = clues.map(() => draw(2));
  return {
    answers,
    beatsGood: 0,
    beatsMissed: 0,
    beatsPerfect: 0,
    breaths: 0,
    cause: null,
    clueAt,
    cluesSeen: clues.map(() => false),
    cluesTaken: clues.map(() => false),
    colour: zoneIds.map(() => startColour),
    deck: false,
    drawer: false,
    ended: false,
    facing: startHeading,
    finalePerfect: 0,
    garden: gardenBeds.map(() => 0),
    gardenAt: gardenBeds.map(() => -1),
    greyTricks: 0,
    greyed: 0,
    greys,
    jackets: false,
    lamps: lamps.map(() => false),
    lampsAllOn: false,
    lead: null,
    level: 1,
    light: 0,
    mastery: Array.from({ length: skillCount }, () => 0),
    mirrorForce: 0,
    mirrorsUsed: mirrors.map(() => false),
    moment: null,
    moving: -1,
    hurrying: false,
    news: null,
    pancakes: false,
    made: [],
    party: [],
    plasma: 0,
    plasmaAt,
    plasmaTaken: plasmaAt.map(() => false),
    relicsTaken: relics.map(() => false),
    score: 0,
    seed,
    spark: sparkStart,
    sparky: false,
    thingsOn: things.map(() => false),
    thingsTouched: things.map(() => false),
    threads: 0,
    tick: 0,
    touchedTree: false,
    tower: false,
    treeReady: 0,
    tricks: 0,
    visionReady: 0,
    visionUntil: 0,
    visionUses: 0,
    x: startPoint.x,
    z: startPoint.z,
  };
}

const statsOf = (state: PlayState) => stats[state.lead ?? "kai"];
// Each level above the first adds a little to every gift; a dim spark takes some away, a bright one adds.
const above = (state: PlayState): number => state.level - 1;

// How far the lead walks in a tick, in millimetres; running, eight fifths of it.
export const walkSpeed = (state: PlayState): number => {
  const walking =
    walkBase +
    walkPerPoint * statsOf(state).speed +
    above(state) -
    (moodOf(state) === "dim" ? 6 : 0);
  return state.hurrying ? Math.trunc((walking * 8) / 5) : walking;
};
export const visionTicks = (state: PlayState): number =>
  visionBaseTicks +
  visionTicksPerPoint * statsOf(state).vision +
  15 * above(state) +
  ({ bright: 60, dim: -60, steady: 0 } as const)[moodOf(state)];
export const visionRadius = (state: PlayState): number =>
  visionBaseRadius +
  visionRadiusPerPoint * statsOf(state).vision +
  300 * above(state);
export const goodWindow = (state: PlayState, key?: HandKey): number =>
  goodWindowBase +
  statsOf(state).heart +
  Math.floor(above(state) / 2) +
  (key !== undefined && keyMastered(state, key) ? 2 : 0) +
  ({ bright: 1, dim: -2, steady: 0 } as const)[moodOf(state)];
export const perfectWindowOf = (state: PlayState): number =>
  perfectWindow + grooveBonus[state.lead ?? "ali"];
export const breathSlack = (state: PlayState): number =>
  breathSlackBase +
  breathSlackPerPoint * statsOf(state).calm +
  3 * above(state) +
  (mastered(state, breathSkill) ? 10 : 0);

// Everyone who has joined, and the lead: the whole family when this holds all four.
export const family = (state: PlayState): readonly HeroId[] =>
  state.lead === null ? state.party : [state.lead, ...state.party];
export const has = (state: PlayState, hero: HeroId): boolean =>
  family(state).includes(hero);

export const healedCount = (state: PlayState): number =>
  state.greys.filter(({ healed }) => healed).length;
export const touchedCount = (state: PlayState): number =>
  state.thingsTouched.filter(Boolean).length;
// Knowledge: every clue and relic taken, and the card pulled from the deck.
export const knowledge = (state: PlayState): number =>
  state.cluesTaken.filter(Boolean).length +
  state.relicsTaken.filter(Boolean).length +
  (state.deck ? 1 : 0);
export const knowledgeCount = clues.length + relics.length + 1;

// A room's colour, raised by `amount` but never past where it waits for the lit tree.
export function withColour(
  state: PlayState,
  zone: ZoneId,
  amount: number,
): PlayState {
  const at = zoneIds.indexOf(zone);
  return {
    ...state,
    colour: state.colour.map((value, index) =>
      index === at ? Math.min(colourBeforeTheEnd, value + amount) : value,
    ),
  };
}

export const withPoints = (state: PlayState, points: number): PlayState => ({
  ...state,
  score: state.score + points,
});

export const withNews = (
  state: PlayState,
  kind: NewsKind,
  detail = "",
): PlayState => ({
  ...state,
  news: { detail, kind, tick: state.tick },
});
