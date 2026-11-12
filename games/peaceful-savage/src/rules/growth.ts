import { handKeys, type HandKey } from "./constants.ts";
import type { PlayState } from "./types.ts";

// How the lead grows over a run, all in whole numbers.
//
// Spark: the lead's own light, 0 to 100. Grey ones close by quiet it, a believed trick and a missed beat lower it; a breath, the truth,
// family, a lit room and gathered plasma raise it. Low, it makes the work harder; high, easier. It never ends a run: a breath brings it
// back.
//
// Light and levels: plasma, clues, relics and practice add to the lead's light. At the tree, light enough raises the lead one level (the
// tree gives power one step at a time), up to level 7, fully empowered.
//
// Mastery: practising a hand-key on the beat (or the breath) adds to its mastery: practised at 3, skilled at 8, mastered at 15. A mastered
// key has more give on the beat in the story's moments.
export const sparkStart = 60;
export const sparkDim = 25;
export const sparkBright = 75;
export const spark = {
  beatMiss: -2,
  beatPerfect: 2,
  bloomed: 5,
  breath: 15,
  clue: 3,
  found: 10,
  greyNear: -2,
  healed: 6,
  plasma: 1,
  relic: 4,
  steadyGain: 1,
  tricked: -15,
  truth: 8,
} as const;
// Spark drifts once a second: down near an unhealed grey, up with family or in a room with colour.
export const sparkEvery = 30;
export const greyAura = 3_000;
export const warmRoom = 60;

export const levelAt: readonly number[] = [0, 10, 25, 45, 70, 100, 140];
export const topLevel = levelAt.length;

export const light = {
  bloomed: 3,
  breathPractice: 3,
  clue: 5,
  good: 1,
  perfect: 2,
  plasma: 1,
  relic: 8,
} as const;

// The skills a lead can practise: the six hand-keys, then the breath and the body (index 6), then the family huddle (index 7, only with
// family to huddle with, and mastered before the giant snake can be faced).
export const breathSkill = handKeys.length;
export const huddleSkill = handKeys.length + 1;
export const skillCount = handKeys.length + 2;
export const masteryAt = [3, 8, 15] as const;
export const masteryCap = 15;
export const breathPracticePoints = 5;

// Mirror force: breathing and re-centring at a mirror fills the spark and gives a charge of mirror force (up to three), which turns a
// believed trick back on itself once. Once the tree has recovered (half the grey ones healed), a hand on it powers the lead up too:
// spark and a charge, once every thirty seconds.
export const mirrorForceCap = 3;
export const mirrorLight = 6;
export const treeRecoveredAt = 3;
export const treePowerSpark = 40;
export const treePowerRest = 900;

export const masteryLevel = (points: number): number =>
  masteryAt.filter((at) => points >= at).length;

export const mastered = (state: PlayState, skill: number): boolean =>
  (state.mastery[skill] ?? 0) >= masteryCap;

export const keyMastered = (state: PlayState, key: HandKey): boolean =>
  mastered(state, handKeys.indexOf(key));

export const withSpark = (state: PlayState, change: number): PlayState => ({
  ...state,
  spark: Math.max(0, Math.min(100, state.spark + change)),
});

export const withLight = (state: PlayState, gained: number): PlayState => ({
  ...state,
  light: state.light + gained,
});

export const withMastery = (
  state: PlayState,
  skill: number,
  points: number,
): PlayState => ({
  ...state,
  mastery: state.mastery.map((value, index) =>
    index === skill ? Math.min(masteryCap, value + points) : value,
  ),
});

// Whether the lead has light enough for the next level.
export const canRise = (state: PlayState): boolean =>
  state.level < topLevel && state.light >= (levelAt[state.level] ?? 0);

export type Mood = "bright" | "dim" | "steady";
export const moodOf = (state: PlayState): Mood =>
  state.spark < sparkDim
    ? "dim"
    : state.spark >= sparkBright
      ? "bright"
      : "steady";
