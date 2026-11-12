import { plasmaCount, relics } from "./collect.ts";
import { type HeroId, handKeys } from "./constants.ts";
import { bloomed } from "./garden.ts";
import { huddleSkill, mastered } from "./growth.ts";
import { healedCount, touchedCount } from "./state.ts";
import { curiousAt, veryCuriousAt } from "./things.ts";
import type { PlayState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay decides it too), and each once true, true for
// the rest of the run (the platform reads the state a run ends in). The ids are the ones in the game's manifest, which holds their words.
// No two are earned by the same event: each names a different thing the player does.
const found = (hero: HeroId) => (state: PlayState) =>
  state.party.includes(hero);
const madeBy = (hero: HeroId) => (state: PlayState) =>
  state.made.includes(hero);
const litAs = (hero: HeroId) => (state: PlayState) =>
  state.cause === "lit" && state.lead === hero;
const keysMastered = (state: PlayState): number =>
  handKeys.filter((_, skill) => mastered(state, skill)).length;
const count = (flags: readonly boolean[]): number =>
  flags.filter(Boolean).length;

export const milestones: readonly {
  readonly earned: (state: PlayState) => boolean;
  readonly id: string;
}[] = [
  { earned: (state) => state.touchedTree, id: "first-touch" },
  { earned: (state) => state.visionUses > 0, id: "savage-vision" },
  { earned: (state) => state.sparky, id: "sparky" },
  { earned: (state) => state.breaths > 0, id: "first-breath" },
  { earned: found("kai"), id: "found-kai" },
  { earned: found("zora"), id: "found-zora" },
  { earned: found("heerah"), id: "found-heerah" },
  { earned: found("ali"), id: "found-ali" },
  { earned: (state) => healedCount(state) > 0, id: "first-healed" },
  { earned: (state) => state.threads >= 6, id: "all-threads" },
  {
    earned: (state) => healedCount(state) === 6 && state.greyTricks === 0,
    id: "clean-heart",
  },
  { earned: (state) => state.jackets, id: "jackets" },
  { earned: (state) => state.drawer, id: "the-drawer" },
  { earned: (state) => state.deck, id: "the-deck" },
  { earned: (state) => state.pancakes, id: "pancakes" },
  {
    earned: (state) => state.garden.every((stage) => stage === bloomed),
    id: "the-garden",
  },
  { earned: (state) => state.tower, id: "the-tower" },
  { earned: (state) => state.lampsAllOn, id: "lights-on" },
  { earned: (state) => touchedCount(state) >= curiousAt, id: "curious" },
  {
    earned: (state) => touchedCount(state) >= veryCuriousAt,
    id: "very-curious",
  },
  { earned: (state) => state.finalePerfect >= 6, id: "perfect-six" },
  { earned: (state) => state.plasma >= 50, id: "plasma-50" },
  { earned: (state) => state.plasma >= plasmaCount, id: "all-plasma" },
  { earned: (state) => count(state.relicsTaken) > 0, id: "first-relic" },
  {
    earned: (state) => count(state.relicsTaken) >= relics.length,
    id: "all-relics",
  },
  {
    earned: (state) => count(state.cluesTaken) >= state.cluesTaken.length,
    id: "all-clues",
  },
  { earned: (state) => count(state.mirrorsUsed) > 0, id: "mirror-force" },
  { earned: (state) => keysMastered(state) > 0, id: "master-key" },
  {
    earned: (state) => keysMastered(state) >= handKeys.length,
    id: "master-all",
  },
  { earned: (state) => mastered(state, huddleSkill), id: "huddle-master" },
  { earned: (state) => state.level >= 3, id: "level-3" },
  { earned: (state) => state.level >= 7, id: "level-7" },
  { earned: madeBy("kai"), id: "kai-hologram" },
  { earned: madeBy("zora"), id: "zora-masterpiece" },
  { earned: madeBy("heerah"), id: "heerah-song" },
  { earned: madeBy("ali"), id: "ali-relic" },
  { earned: litAs("kai"), id: "light-as-kai" },
  { earned: litAs("zora"), id: "light-as-zora" },
  { earned: litAs("heerah"), id: "light-as-heerah" },
  { earned: litAs("ali"), id: "light-as-ali" },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export const earnedBy = (state: PlayState): readonly string[] =>
  milestones.filter(({ earned }) => earned(state)).map(({ id }) => id);
