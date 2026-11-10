import { roundCount, ticksPerSecond } from "./constants.ts";
import { leadIds } from "./leads.ts";
import { totals } from "./round.ts";
import type { RunState, Tally } from "./types.ts";

// Each milestone is decided by the rules alone, from the state of a run. The names and lines are drafts for the owner. Each is earned by
// a different thing a player does; the ladder runs from a first crystal to a run that misses nothing. There is none for a win as such: a
// win is always some hero's win, and one event earns one milestone, so the five heroes' wins are the wins.
export interface Milestone {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly earned: (state: RunState) => boolean;
}

const tally = (state: RunState, round: number): Tally | undefined =>
  state.tallies[round];
const roundOver = (state: RunState, round: number): boolean =>
  state.round > round || state.ended;
const allIslets = 0b11111;

const winAs = (index: number, title: string): Milestone => ({
  description: `Win a run as ${title}.`,
  earned: (state) => state.won && state.lead === index,
  id: `win-as-${leadIds[index] ?? "lead"}`,
  name: `${title} wins`,
});

export const milestones: readonly Milestone[] = [
  {
    description: "Collect a crystal.",
    earned: (s) => totals(s.tallies).crystal >= 1,
    id: "first-crystal",
    name: "First spark",
  },
  {
    description: "Collect a frost egg.",
    earned: (s) => totals(s.tallies).egg >= 1,
    id: "first-egg",
    name: "Egg in hand",
  },
  {
    description: "Collect a key.",
    earned: (s) => totals(s.tallies).key >= 1,
    id: "first-key",
    name: "Key catch",
  },
  {
    description: "Collect every crystal, egg and key on the Floe.",
    earned: (s) => tally(s, 0)?.cleared === true,
    id: "floe-clear",
    name: "Floe swept",
  },
  {
    description: "Collect every crystal, egg and key in Shatter Sound.",
    earned: (s) => tally(s, 1)?.cleared === true,
    id: "sound-clear",
    name: "Sound swept",
  },
  {
    description: "Collect every crystal, egg and key on the Aurora Crown.",
    earned: (s) => tally(s, 2)?.cleared === true,
    id: "crown-clear",
    name: "Crown swept",
  },
  {
    description: "Collect every item in all three rounds of one run.",
    earned: (s) =>
      s.tallies.length === roundCount && s.tallies.every((t) => t.cleared),
    id: "perfect-haul",
    name: "Not a flake missed",
  },
  {
    description: "Finish the Floe without being hit.",
    earned: (s) => roundOver(s, 0) && tally(s, 0)?.hits === 0,
    id: "untouched-floe",
    name: "Untouched",
  },
  {
    description: "Sweep the Floe with 25 seconds or more left.",
    earned: (s) =>
      tally(s, 0)?.cleared === true &&
      (tally(s, 0)?.timeLeftAtEnd ?? 0) >= 25 * ticksPerSecond,
    id: "swift-floe",
    name: "Swift floe",
  },
  {
    description: "Hop over 10 snowballs in one run.",
    earned: (s) => s.feats.hoppedOver >= 10,
    id: "hop-scotch",
    name: "Hop-scotch",
  },
  {
    description: "Duck under 8 icicle darts in one run.",
    earned: (s) => s.feats.ducked >= 8,
    id: "heads-down",
    name: "Heads down",
  },
  {
    description: "Let a snowball brush past without touching you.",
    earned: (s) => s.feats.closeShave,
    id: "close-shave",
    name: "Close shave",
  },
  {
    description: "Collect two crystals within a second and a half.",
    earned: (s) => s.feats.quickPair,
    id: "double-spark",
    name: "Double spark",
  },
  {
    description: "Set foot on all five islets of Shatter Sound.",
    earned: (s) => tally(s, 1)?.isletsVisited === allIslets,
    id: "island-hopper",
    name: "Island hopper",
  },
  {
    description: "Crack all five ice crates in Shatter Sound.",
    earned: (s) => (tally(s, 1)?.cratesBroken ?? 0) >= 5,
    id: "crate-cracker",
    name: "Crate cracker",
  },
  {
    description: "Smash 12 snowballs or darts by rolling, shooting or growing.",
    earned: (s) => s.feats.crushed >= 12,
    id: "snow-crusher",
    name: "Snow crusher",
  },
  {
    description: "Break all five ice cages on the Aurora Crown.",
    earned: (s) => (tally(s, 2)?.cagesBroken ?? 0) >= 5,
    id: "wall-breaker",
    name: "Cage breaker",
  },
  {
    description: "Find all four ghost keys with frost vision.",
    earned: (s) => (tally(s, 2)?.ghostKeys ?? 0) >= 4,
    id: "frost-sight",
    name: "Frost sight",
  },
  winAs(0, "Volt"),
  winAs(1, "Nib"),
  winAs(2, "Lumen"),
  winAs(3, "Hrimm"),
  winAs(4, "Pip"),
];

export const earnedIds = (state: RunState): string[] =>
  milestones.filter((m) => m.earned(state)).map((m) => m.id);
