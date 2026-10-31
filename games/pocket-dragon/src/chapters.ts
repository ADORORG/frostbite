import type { GameVerifier } from "@ador/game-sdk/run-record";

import { castleChapter, castleRules } from "./rules/castle/index.ts";
import { startCastle, tickCastle } from "./rules/castle/tick.ts";
import type { CastleControl, CastleState } from "./rules/castle/types.ts";
import type { ChapterId } from "./rules/constants.ts";
import type { Chapter, Running } from "./rules/held.ts";
import { hillsChapter, hillsRules } from "./rules/hills/index.ts";
import { startHills } from "./rules/hills/state.ts";
import { tickHills } from "./rules/hills/tick.ts";
import type { HillsControl, HillsState } from "./rules/hills/types.ts";
import { startWoods, woodsChapter, woodsRules } from "./rules/woods/index.ts";
import { tickWoods } from "./rules/woods/tick.ts";
import type { WoodsControl, WoodsState } from "./rules/woods/types.ts";

// What the page needs of a chapter to play it: its rules, how a run of it starts and goes on a tick, and its name in a run's settings.
export interface ChapterPlay<
  Control extends string,
  State extends Running<Control>,
> {
  readonly chapter: Chapter<Control, State>;
  readonly id: ChapterId;
  readonly rules: GameVerifier<State>;
  readonly start: (seed: number) => State;
  readonly tick: (state: State) => State;
}

export const hillsPlay: ChapterPlay<HillsControl, HillsState> = {
  chapter: hillsChapter,
  id: "hills",
  rules: hillsRules,
  start: startHills,
  tick: tickHills,
};

export const woodsPlay: ChapterPlay<WoodsControl, WoodsState> = {
  chapter: woodsChapter,
  id: "woods",
  rules: woodsRules,
  start: startWoods,
  tick: tickWoods,
};

export const castlePlay: ChapterPlay<CastleControl, CastleState> = {
  chapter: castleChapter,
  id: "castle",
  rules: castleRules,
  start: startCastle,
  tick: tickCastle,
};

// The names a chapter is shown by, in order.
export const chapterTitles: Readonly<Record<ChapterId, string>> = {
  castle: "The Guild and the Castle",
  hills: "Egg Hills",
  woods: "The Whispering Woods",
};
