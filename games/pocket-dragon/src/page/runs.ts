import type { RunRecord } from "@ador/game-sdk/run-record";

import type { EffectName } from "../audio.ts";
import {
  castlePlay,
  hillsPlay,
  woodsPlay,
  type ChapterPlay,
} from "../chapters.ts";
import { castleSounds, hillsSounds, woodsSounds } from "../feedback.ts";
import type { CastleControl, CastleState } from "../rules/castle/types.ts";
import type { ChapterId } from "../rules/constants.ts";
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

// One run of whichever chapter is being played, as the page sees it: the same few things for all three, so the page never needs to know
// which chapter it has. Each chapter says what the six actions mean to it, how it is drawn and heard, and when it counts as cleared.
export interface ChapterRun {
  readonly id: ChapterId;
  // The actions this chapter gives a meaning to (the touch buttons for the others are not offered).
  readonly uses: readonly Action[];
  cleared(): boolean;
  draw(context: CanvasRenderingContext2D): void;
  earned(): readonly string[];
  ended(): boolean;
  hold(action: Action, on: boolean): void;
  record(): RunRecord;
  score(): number;
  stats(): readonly Stat[];
  // Plays one tick, and says what is heard because of it.
  tick(): readonly EffectName[];
}

interface Look<Control extends string, State extends Running<Control>> {
  readonly cleared: (state: State) => boolean;
  readonly draw: (context: CanvasRenderingContext2D, state: State) => void;
  readonly means: Readonly<Partial<Record<Action, Control>>>;
  readonly play: ChapterPlay<Control, State>;
  readonly score: (state: State) => number;
  readonly sounds: (before: State, after: State) => readonly EffectName[];
  readonly stats: (state: State) => readonly Stat[];
}

const hills: Look<HillsControl, HillsState> = {
  cleared: (state) => state.finishTick !== null,
  draw: drawHills,
  means: {
    act: "jump",
    fire: "fire",
    left: "left",
    right: "right",
    up: "jump",
  },
  play: hillsPlay,
  score: hillsScore,
  sounds: hillsSounds,
  stats: hillsStats,
};

const woods: Look<WoodsControl, WoodsState> = {
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
  play: woodsPlay,
  score: woodsScore,
  sounds: woodsSounds,
  stats: woodsStats,
};

const castle: Look<CastleControl, CastleState> = {
  cleared: (state) => state.bannerRaised,
  draw: drawCastle,
  means: {
    act: "act",
    down: "down",
    fire: "fire",
    left: "left",
    right: "right",
    up: "up",
  },
  play: castlePlay,
  score: castleScore,
  sounds: castleSounds,
  stats: castleStats,
};

function runOf<Control extends string, State extends Running<Control>>(
  look: Look<Control, State>,
  seed: number,
  onEarned?: (milestone: string) => void,
): ChapterRun {
  const session = createRunSession({ onEarned, play: look.play, seed });
  const held = new Set<Action>();
  return {
    cleared: () => look.cleared(session.state()),
    draw: (context) => look.draw(context, session.state()),
    earned: () => session.earned(),
    ended: () => session.state().ended,
    // Two actions may mean one control (Space and up both jump): the control is held while either is.
    hold(action, on) {
      const control = look.means[action];
      if (control === undefined) return;
      if (on) held.add(action);
      else held.delete(action);
      session.hold(
        control,
        actions.some(
          (other) => held.has(other) && look.means[other] === control,
        ),
      );
    },
    id: look.play.id,
    record: () => session.record(),
    score: () => look.score(session.state()),
    stats: () => look.stats(session.state()),
    tick() {
      const before = session.state();
      session.tick();
      return look.sounds(before, session.state());
    },
    uses: actions.filter((action) => look.means[action] !== undefined),
  };
}

const looks = {
  castle: (seed: number, onEarned?: (milestone: string) => void) =>
    runOf(castle, seed, onEarned),
  hills: (seed: number, onEarned?: (milestone: string) => void) =>
    runOf(hills, seed, onEarned),
  woods: (seed: number, onEarned?: (milestone: string) => void) =>
    runOf(woods, seed, onEarned),
} as const satisfies Record<ChapterId, unknown>;

// A run of a chapter on a seed. The idle screen is one of these that is never played.
export const startRun = (
  chapter: ChapterId,
  seed: number,
  onEarned?: (milestone: string) => void,
): ChapterRun => looks[chapter](seed, onEarned);
