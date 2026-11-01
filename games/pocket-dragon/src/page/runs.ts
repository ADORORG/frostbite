import type { RunRecord } from "@ador/game-sdk/run-record";

import type { EffectName } from "../audio.ts";
import {
  castlePlay,
  hillsPlay,
  woodsPlay,
  type ChapterPlay,
} from "../chapters.ts";
import { castleSounds, hillsSounds, woodsSounds } from "../feedback.ts";
import { plasmaGathered } from "../rules/hills/milestones.ts";
import type { CastleControl, CastleState } from "../rules/castle/types.ts";
import type { ChapterId, PlayId } from "../rules/constants.ts";
import type { FameEntry } from "../progress.ts";
import type { Running } from "../rules/held.ts";
import type { HillsControl, HillsState } from "../rules/hills/types.ts";
import type { WoodsControl, WoodsState } from "../rules/woods/types.ts";
import {
  castleScore,
  castleStats,
  hillsScore,
  hillsStats,
  woodsScore,
  woodsStats,
  type Stat,
} from "../score.ts";
import { drawCastle } from "../screen/castle-draw.ts";
import { drawHills } from "../screen/hills-draw.ts";
import { drawWoods } from "../screen/woods-draw.ts";
import { createRunSession } from "../session.ts";
import { actions, type Action } from "./hands.ts";

// One run of whatever is being played, as the page sees it: the same few things for a level and for the whole quest, so the page never
// needs to know which it has. Each level says what the actions mean to it, how it is drawn and heard, and when it counts as cleared.
export interface PlayRun {
  readonly id: PlayId;
  // The levels this run cleared.
  cleared(): readonly ChapterId[];
  draw(context: CanvasRenderingContext2D): void;
  earned(): readonly string[];
  ended(): boolean;
  // A won quest's entry for the Hall of Fame; null for anything else.
  fame(): FameEntry | null;
  hold(action: Action, on: boolean): void;
  // The level on the screen (in the quest, the one being played).
  level(): ChapterId;
  // Metaplasma gathered in the run.
  plasma(): number;
  record(): RunRecord;
  score(): number;
  stats(): readonly Stat[];
  // Plays one tick, and says what is heard because of it.
  tick(): readonly EffectName[];
  // Whether the whole quest was won.
  won(): boolean;
}

export interface Look<Control extends string, State extends Running<Control>> {
  readonly cleared: (state: State) => boolean;
  readonly draw: (context: CanvasRenderingContext2D, state: State) => void;
  readonly means: Readonly<Partial<Record<Action, Control>>>;
  readonly plasma: (state: State) => number;
  readonly play: ChapterPlay<Control, State>;
  readonly score: (state: State) => number;
  readonly sounds: (before: State, after: State) => readonly EffectName[];
  readonly stats: (state: State) => readonly Stat[];
}

export const hillsLook: Look<HillsControl, HillsState> = {
  cleared: (state) => state.finishTick !== null,
  draw: drawHills,
  means: {
    act: "jump",
    fire: "fire",
    left: "left",
    right: "right",
    up: "jump",
  },
  plasma: plasmaGathered,
  play: hillsPlay,
  score: hillsScore,
  sounds: hillsSounds,
  stats: hillsStats,
};

export const woodsLook: Look<WoodsControl, WoodsState> = {
  cleared: (state) => state.escaped,
  draw: drawWoods,
  means: {
    act: "fire",
    down: "down",
    fire: "fire",
    left: "left",
    right: "right",
    up: "up",
  },
  plasma: (state) => state.plasma.gathered,
  play: woodsPlay,
  score: woodsScore,
  sounds: woodsSounds,
  stats: woodsStats,
};

export const castleLook: Look<CastleControl, CastleState> = {
  cleared: (state) => state.bannerRaised,
  draw: drawCastle,
  means: {
    act: "act",
    charm: "charm",
    down: "down",
    evade: "evade",
    fire: "fire",
    hot1: "show1",
    hot2: "show2",
    hot3: "show3",
    hot4: "show4",
    hot5: "show5",
    left: "left",
    quick: "quick",
    right: "right",
    up: "up",
  },
  plasma: (state) => state.plasma.gathered,
  play: castlePlay,
  score: castleScore,
  sounds: castleSounds,
  stats: castleStats,
};

function runOf<Control extends string, State extends Running<Control>>(
  look: Look<Control, State>,
  seed: number,
  onEarned?: (milestone: string) => void,
): PlayRun {
  const session = createRunSession({ onEarned, play: look.play, seed });
  const held = new Set<Action>();
  return {
    cleared: () => (look.cleared(session.state()) ? [look.play.id] : []),
    draw: (context) => look.draw(context, session.state()),
    earned: () => session.earned(),
    ended: () => session.state().ended,
    fame: () => null,
    hold: (action, on) => holdOn(look.means, held, action, on, session.hold),
    id: look.play.id,
    level: () => look.play.id,
    plasma: () => look.plasma(session.state()),
    record: () => session.record(),
    score: () => look.score(session.state()),
    stats: () => look.stats(session.state()),
    tick() {
      const before = session.state();
      session.tick();
      return look.sounds(before, session.state());
    },
    won: () => false,
  };
}

// Two actions may mean one control (Space and up both jump): the control is held while either is.
export function holdOn(
  means: Readonly<Partial<Record<Action, string>>>,
  held: Set<Action>,
  action: Action,
  on: boolean,
  hold: (control: string, on: boolean) => unknown,
): void {
  if (on) held.add(action);
  else held.delete(action);
  const control = means[action];
  if (control === undefined) return;
  hold(
    control,
    actions.some((other) => held.has(other) && means[other] === control),
  );
}

const looks = {
  castle: (seed: number, onEarned?: (milestone: string) => void) =>
    runOf(castleLook, seed, onEarned),
  hills: (seed: number, onEarned?: (milestone: string) => void) =>
    runOf(hillsLook, seed, onEarned),
  woods: (seed: number, onEarned?: (milestone: string) => void) =>
    runOf(woodsLook, seed, onEarned),
} as const satisfies Record<ChapterId, unknown>;

// A run of a level alone, on a seed. A level's idle screen is one of these that is never played.
export const startRun = (
  chapter: ChapterId,
  seed: number,
  onEarned?: (milestone: string) => void,
): PlayRun => looks[chapter](seed, onEarned);
