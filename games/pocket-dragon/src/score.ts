import { maxTicks as castleMax } from "./rules/castle/constants.ts";
import { friendsJoined } from "./rules/castle/milestones.ts";
import type { CastleState } from "./rules/castle/types.ts";
import { maxTicks as hillsMax, stages } from "./rules/hills/constants.ts";
import { eggsCaught } from "./rules/hills/milestones.ts";
import type { HillsState } from "./rules/hills/types.ts";
import { maxTicks as woodsMax } from "./rules/woods/constants.ts";
import { chestsOpened, cluesRead, lanternsLit } from "./rules/woods/tick.ts";
import type { WoodsState } from "./rules/woods/types.ts";
import { chapterIds, ticksPerSecond } from "./rules/constants.ts";
import { plasmaGathered } from "./rules/hills/milestones.ts";
import { legHearts, legShown, onLeg, type Leg } from "./rules/quest/legs.ts";
import { legsOf } from "./rules/quest/milestones.ts";
import type { QuestState } from "./rules/quest/types.ts";

// What a run is worth, for the page to show and keep as the chapter's best, and the three counts shown beside it. The rules do not use
// either (the marks are decided by the counts themselves); they are the player's own note. A chapter finished early adds a bonus for the
// time left.
export type Stat = readonly [label: string, value: string];

const bonus = (finishTick: number | null, most: number): number =>
  finishTick === null ? 0 : Math.floor((most - finishTick) / 4);
const of = (count: number, total: number): string =>
  `${String(count)} of ${String(total)}`;

export const hillsScore = (state: HillsState): number =>
  eggsCaught(state) * 100 +
  state.goldens * 1_000 +
  state.cheers * 200 +
  state.meltedCount * 20 +
  state.stagesCleared * 1_000 +
  bonus(state.finishTick, hillsMax);

export const hillsStats = (state: HillsState): readonly Stat[] => [
  ["Eggs", String(eggsCaught(state))],
  ["Hearts", String(state.hearts)],
  ["Stage", of(state.stage, stages)],
];

export const woodsScore = (state: WoodsState): number =>
  cluesRead(state) * 500 +
  chestsOpened(state) * 300 +
  lanternsLit(state) * 200 +
  (state.moonChest ? 1_000 : 0) +
  (state.escaped ? 2_000 : 0) +
  (state.launch?.score ?? 0) +
  bonus(state.finishTick, woodsMax);

export const woodsStats = (state: WoodsState): readonly Stat[] => [
  ["Clues", of(cluesRead(state), state.clues.length)],
  ["Parts", of(state.parts.filter(Boolean).length, state.parts.length)],
  ["Eggs", String(state.launch?.eggsLeft ?? state.eggs.filter(Boolean).length)],
];

export const castleScore = (state: CastleState): number =>
  friendsJoined(state) * 500 +
  state.cheered.filter(Boolean).length * 800 +
  (state.bannerRaised ? 3_000 : 0) +
  bonus(state.finishTick, castleMax);

export const castleStats = (state: CastleState): readonly Stat[] => [
  ["Guild", of(friendsJoined(state), state.friends.length)],
  ["Cheered", of(state.cheered.filter(Boolean).length, state.cheered.length)],
  ["Charms", of(state.charms.filter(Boolean).length, state.charms.length)],
];

// What a level of the quest is worth and holds, whichever it is.
export const legScore = (leg: Leg): number =>
  onLeg(leg, { castle: castleScore, hills: hillsScore, woods: woodsScore });
export const legEggs = (leg: Leg): number =>
  onLeg(leg, {
    castle: () => 0,
    hills: eggsCaught,
    woods: (state) => state.eggs.filter(Boolean).length,
  });
export const legSecrets = (leg: Leg): number =>
  onLeg(leg, {
    castle: (state) => state.charms.filter(Boolean).length,
    hills: (state) => state.charms,
    woods: (state) => state.charms.filter(Boolean).length,
  });
export const legPlasma = (leg: Leg): number =>
  onLeg(leg, {
    castle: (state) => state.plasma.gathered,
    hills: plasmaGathered,
    woods: (state) => state.plasma.gathered,
  });

// The whole quest: every level's score added up and, for a win, a bonus for the win and one for each heart kept.
export const questWin = 5_000;
export const heartBonus = 1_000;
const total = (state: QuestState, of: (leg: Leg) => number): number =>
  legsOf(state).reduce((sum, leg) => sum + of(legShown(leg)), 0);

export const questScore = (state: QuestState): number =>
  total(state, legScore) +
  (state.finishTick === null
    ? 0
    : questWin + legHearts(state.leg) * heartBonus);
export const questEggs = (state: QuestState): number => total(state, legEggs);
export const questSecrets = (state: QuestState): number =>
  total(state, legSecrets);
export const questPlasma = (state: QuestState): number =>
  total(state, legPlasma);

// A time on the quest's clock, as minutes and seconds.
export function clockOf(ticks: number): string {
  const seconds = Math.floor(ticks / ticksPerSecond);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
}

export const questStats = (state: QuestState): readonly Stat[] => [
  ["Time", clockOf(state.finishTick ?? state.tick)],
  ["Hearts", String(legHearts(state.leg))],
  ["Level", of(chapterIds.indexOf(state.leg.id) + 1, chapterIds.length)],
];
