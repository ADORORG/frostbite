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
import { drawWoods } from "../screen/woods-screen.ts";
import { createRunSession } from "../session.ts";
import { keepCountdown } from "../test-mode/keep.ts";
import { createTestSession } from "../test-mode/sessions.ts";
import { actions, type Action } from "./hands.ts";

// One run of whatever is being played, as the page sees it: the same few things for a level and for the whole quest, so the page never
// needs to know which it has. Each level says what the actions mean to it, how it is drawn and heard, and when it counts as cleared.
export interface PlayRun {
  readonly id: PlayId;
  // The levels this run cleared.
  cleared(): readonly ChapterId[];
  // The woods outside the maze, while they are on the screen, for the three-dimensional view (null at any other time).
  depth(): WoodsState | null;
  // With `layered`, the three-dimensional view is already drawn behind the screen.
  draw(context: CanvasRenderingContext2D, layered: boolean): void;
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
  // A test run (the admin's test mode): nothing in it is recorded, scored, saved or sent.
  readonly test: boolean;
  // Plays one tick, and says what is heard because of it.
  tick(): readonly EffectName[];
  // Whether the whole quest was won.
  won(): boolean;
}

// A level as the page plays it. Each level's state counts hearts, which test mode keeps; `keep` is what else test mode does to it.
type Hearted<Control extends string> = Running<Control> & {
  readonly hearts: number;
};

export interface Look<Control extends string, State extends Hearted<Control>> {
  readonly cleared: (state: State) => boolean;
  readonly depth: (state: State) => WoodsState | null;
  readonly draw: (
    context: CanvasRenderingContext2D,
    state: State,
    layered: boolean,
    test: boolean,
  ) => void;
  readonly keep?: (state: State) => State;
  readonly means: Readonly<Partial<Record<Action, Control>>>;
  readonly plasma: (state: State) => number;
  readonly play: ChapterPlay<Control, State>;
  readonly score: (state: State) => number;
  readonly sounds: (before: State, after: State) => readonly EffectName[];
  readonly stats: (state: State) => readonly Stat[];
}

const flat = (): null => null;

export const hillsLook: Look<HillsControl, HillsState> = {
  cleared: (state) => state.finishTick !== null,
  depth: flat,
  draw: drawHills,
  means: {
    act: "jump",
    down: "down",
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
  cleared: (state) => state.outcome === "defused",
  depth: (state) => (state.base === null ? null : state),
  draw: drawWoods,
  keep: keepCountdown,
  means: {
    act: "act",
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
  cleared: (state) => state.goldenEgg,
  depth: flat,
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

function runOf<Control extends string, State extends Hearted<Control>>(
  look: Look<Control, State>,
  seed: number,
  onEarned?: (milestone: string) => void,
  test = false,
): PlayRun {
  const session = test
    ? createTestSession(look.play, seed, look.keep)
    : createRunSession({ onEarned, play: look.play, seed });
  const held = new Set<Action>();
  return {
    cleared: () => (look.cleared(session.state()) ? [look.play.id] : []),
    depth: () => look.depth(session.state()),
    draw: (context, layered) =>
      look.draw(context, session.state(), layered, test),
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
    test,
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

type Starter = (
  seed: number,
  onEarned?: (milestone: string) => void,
  test?: boolean,
) => PlayRun;
const looks: Readonly<Record<ChapterId, Starter>> = {
  castle: (seed, onEarned, test) => runOf(castleLook, seed, onEarned, test),
  hills: (seed, onEarned, test) => runOf(hillsLook, seed, onEarned, test),
  woods: (seed, onEarned, test) => runOf(woodsLook, seed, onEarned, test),
};

// A run of a level alone, on a seed (a test run in test mode). A level's idle screen is one of these that is never played.
export const startRun = (
  chapter: ChapterId,
  seed: number,
  onEarned?: (milestone: string) => void,
  test = false,
): PlayRun => looks[chapter](seed, onEarned, test);
