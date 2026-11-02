import { maxTicks as castleMax } from "./rules/castle/constants.ts";
import {
  cluesRead as cluesFound,
  eggsSaved,
  friendsJoined,
  gearFound,
  guildLevel,
} from "./rules/castle/guild.ts";
import { nightEggs } from "./rules/castle/places.ts";
import type { CastleState } from "./rules/castle/types.ts";
import { maxTicks as hillsMax, stages } from "./rules/hills/constants.ts";
import { eggsCaught } from "./rules/hills/milestones.ts";
import type { HillsState } from "./rules/hills/types.ts";
import { maxTicks as woodsMax } from "./rules/woods/constants.ts";
import { chestsOpened, cluesRead, lanternsLit } from "./rules/woods/tick.ts";
import { cages, chests } from "./rules/woods/base-map.ts";
import type { WoodsState } from "./rules/woods/types.ts";
import { chapterIds, ticksPerSecond } from "./rules/constants.ts";
import { plasmaGathered } from "./rules/hills/milestones.ts";
import { plasmaLeft } from "./rules/woods/vision.ts";
import { legHearts, legShown, onLeg, type Leg } from "./rules/quest/legs.ts";
import { legsOf } from "./rules/quest/milestones.ts";
import type { QuestState } from "./rules/quest/types.ts";

// What a run is worth, for the page to show and keep as the chapter's best, and the three counts shown beside it. The rules do not use
// either (the marks are decided by the counts themselves); they are the player's own note. A chapter finished early adds a bonus for the
// time left.
export type Stat = readonly [label: string, value: string];

const bonus = (finishTick: number | null, most: number): number =>
  finishTick === null ? 0 : Math.floor((most - finishTick) / 4);
const of = (got: number, total: number): string =>
  `${String(got)} of ${String(total)}`;
const count = (list: readonly boolean[]): number => list.filter(Boolean).length;

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

// The woods: the maze's finds and the way out, then what was done outside it, and the rocket defused (with a bonus for time left).
export const woodsScore = (state: WoodsState): number => {
  const base = state.base;
  const outside =
    base === null
      ? 0
      : count(base.allies) * 500 +
        count(base.pieces) * 400 +
        count(base.broken) * 200 +
        base.cheered * 200 +
        base.freed * 150;
  return (
    cluesRead(state) * 500 +
    chestsOpened(state) * 300 +
    lanternsLit(state) * 200 +
    (state.moonChest ? 1_000 : 0) +
    (state.escaped ? 2_000 : 0) +
    outside +
    (state.outcome === "defused" ? 5_000 : 0) +
    bonus(state.finishTick, woodsMax)
  );
};

// The clues read, the rocket keys found and the caged dragons freed.
export const woodsStats = (state: WoodsState): readonly Stat[] => [
  ["Clues", of(cluesRead(state), state.clues.length)],
  ["Keys", of(count(state.base?.pieces ?? []), chests.length)],
  ["Allies", of(count(state.base?.allies ?? []), cages.length)],
];

export const castleScore = (state: CastleState): number =>
  friendsJoined(state) * 500 +
  state.cheered.filter(Boolean).length * 800 +
  eggsSaved(state) * 300 +
  cluesFound(state) * 200 +
  gearFound(state) * 200 +
  (state.goldenEgg ? 3_000 : 0) +
  bonus(state.finishTick, castleMax);

// The guild's level, the hearts left and the eggs saved from the night's guards.
export const castleStats = (state: CastleState): readonly Stat[] => [
  ["Guild", `Lv ${String(guildLevel(state))}`],
  ["Hearts", String(state.hearts)],
  ["Eggs", of(eggsSaved(state), nightEggs.length)],
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
    woods: plasmaLeft,
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
