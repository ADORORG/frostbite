import { maxTicks as castleMax } from "./rules/castle/constants.ts";
import { friendsJoined } from "./rules/castle/milestones.ts";
import type { CastleState } from "./rules/castle/types.ts";
import { maxTicks as hillsMax, stages } from "./rules/hills/constants.ts";
import { eggsCaught } from "./rules/hills/milestones.ts";
import type { HillsState } from "./rules/hills/types.ts";
import { maxTicks as woodsMax } from "./rules/woods/constants.ts";
import { chestsOpened, cluesRead, lanternsLit } from "./rules/woods/tick.ts";
import type { WoodsState } from "./rules/woods/types.ts";

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
  bonus(state.finishTick, woodsMax);

export const woodsStats = (state: WoodsState): readonly Stat[] => [
  ["Clues", of(cluesRead(state), state.clues.length)],
  [
    "Chests",
    of(
      chestsOpened(state) + (state.moonChest ? 1 : 0),
      state.chests.length + 1,
    ),
  ],
  ["Lanterns", of(lanternsLit(state), state.lanterns.length)],
];

export const castleScore = (state: CastleState): number =>
  friendsJoined(state) * 500 +
  state.cheered.filter(Boolean).length * 800 +
  (state.bannerRaised ? 3_000 : 0) +
  bonus(state.finishTick, castleMax);

export const castleStats = (state: CastleState): readonly Stat[] => [
  ["Guild", of(friendsJoined(state), state.friends.length)],
  ["Cheered", of(state.cheered.filter(Boolean).length, state.cheered.length)],
  ["Naps", String(state.naps)],
];
