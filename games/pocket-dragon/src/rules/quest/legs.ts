import { refuse } from "@ador/game-sdk/run-inputs";
import type { Stepped } from "@ador/game-sdk/run-record";

import { castleChapter } from "../castle/index.ts";
import { castleEarned } from "../castle/milestones.ts";
import { startCastle, tickCastle } from "../castle/tick.ts";
import type { CastleControl, CastleState } from "../castle/types.ts";
import type { ChapterId } from "../constants.ts";
import { change, type Chapter, type Running } from "../held.ts";
import { hillsChapter } from "../hills/index.ts";
import { hillsEarned } from "../hills/milestones.ts";
import { startHills } from "../hills/state.ts";
import { tickHills } from "../hills/tick.ts";
import type { HillsControl, HillsState } from "../hills/types.ts";
import { startWoods, woodsChapter } from "../woods/index.ts";
import { woodsEarned } from "../woods/milestones.ts";
import { tickWoods } from "../woods/tick.ts";
import type { WoodsControl, WoodsState } from "../woods/types.ts";

// The quest's levels: each is a chapter's own rules, played as they are when the chapter is played alone, and these say how the quest
// starts one, plays it a tick on, takes a press in it, and judges it.

// A level as the screen sees it: which one, and its state.
export type Leg =
  | { readonly id: "castle"; readonly state: CastleState }
  | { readonly id: "hills"; readonly state: HillsState }
  | { readonly id: "woods"; readonly state: WoodsState };

export interface LegKind<
  Control extends string,
  State extends Running<Control>,
> {
  readonly chapter: Chapter<Control, State>;
  readonly cleared: (state: State) => boolean;
  readonly earned: (state: State) => readonly string[];
  // Lost: out of hearts.
  readonly failed: (state: State) => boolean;
  readonly hearts: (state: State) => number;
  readonly heartsLost: (state: State) => number;
  readonly id: ChapterId;
  readonly shown: (state: State) => Leg;
  readonly start: (seed: number, hearts: number) => State;
  readonly tick: (state: State) => State;
}

// A level being played: its kind and its state held together, so levels of three kinds of state can sit in one list without being
// typed away. `visit` hands both to a function that works for any kind.
export interface LegRun {
  readonly id: ChapterId;
  visit<Result>(
    look: <Control extends string, State extends Running<Control>>(
      kind: LegKind<Control, State>,
      state: State,
    ) => Result,
  ): Result;
}

export const legRun = <Control extends string, State extends Running<Control>>(
  kind: LegKind<Control, State>,
  state: State,
): LegRun => ({ id: kind.id, visit: (look) => look(kind, state) });

const hills: LegKind<HillsControl, HillsState> = {
  chapter: hillsChapter,
  cleared: (state) => state.finishTick !== null,
  earned: hillsEarned,
  failed: (state) => state.over,
  hearts: (state) => state.hearts,
  heartsLost: (state) => state.heartsLost,
  id: "hills",
  shown: (state) => ({ id: "hills", state }),
  start: (seed) => startHills(seed),
  tick: tickHills,
};

const castle: LegKind<CastleControl, CastleState> = {
  chapter: castleChapter,
  cleared: (state) => state.bannerRaised,
  earned: castleEarned,
  failed: (state) => state.hearts <= 0,
  hearts: (state) => state.hearts,
  heartsLost: (state) => state.heartsLost,
  id: "castle",
  shown: (state) => ({ id: "castle", state }),
  start: startCastle,
  tick: tickCastle,
};

const woods: LegKind<WoodsControl, WoodsState> = {
  chapter: woodsChapter,
  cleared: (state) =>
    state.hearts > 0 && state.escaped && (state.launch?.ended ?? true),
  earned: woodsEarned,
  failed: (state) => state.hearts <= 0,
  hearts: (state) => state.hearts,
  heartsLost: (state) => state.heartsLost,
  id: "woods",
  shown: (state) => ({ id: "woods", state }),
  start: startWoods,
  tick: tickWoods,
};

// The three kinds, by level.
export const legKinds = { castle, hills, woods } as const;

export function startLeg(id: ChapterId, seed: number, hearts: number): LegRun {
  switch (id) {
    case "castle":
      return legRun(castle, castle.start(seed, hearts));
    case "hills":
      return legRun(hills, hills.start(seed, hearts));
    case "woods":
      return legRun(woods, woods.start(seed, hearts));
  }
}

export const tickLeg = (leg: LegRun): LegRun =>
  leg.visit((kind, state) => legRun(kind, kind.tick(state)));
export const legShown = (leg: LegRun): Leg =>
  leg.visit((kind, state) => kind.shown(state));
export const legEarned = (leg: LegRun): readonly string[] =>
  leg.visit((kind, state) => kind.earned(state));
export const legCleared = (leg: LegRun): boolean =>
  leg.visit((kind, state) => kind.cleared(state));
export const legHearts = (leg: LegRun): number =>
  leg.visit((kind, state) => kind.hearts(state));
export const legHeartsLost = (leg: LegRun): number =>
  leg.visit((kind, state) => kind.heartsLost(state));
export const legTick = (leg: LegRun): number =>
  leg.visit((_, state) => state.tick);

// Lost: out of hearts, or out of the level's time without clearing it.
export const legLost = (leg: LegRun): boolean =>
  leg.visit(
    (kind, state) =>
      kind.failed(state) ||
      (state.tick >= kind.chapter.maxTicks && !kind.cleared(state)),
  );

// Whether the level has a control by this name, and whether it is held.
export const legUses = (leg: LegRun, control: string): boolean =>
  leg.visit((kind) => kind.chapter.controls.some((name) => name === control));
export const legHolds = (leg: LegRun, control: string): boolean =>
  leg.visit((kind, state) => {
    const known = kind.chapter.controls.find((name) => name === control);
    return known !== undefined && state.controls[known] === true;
  });

// A press or a let-go in the level, on the tick it is at, taken as the chapter takes it.
export function changeLeg(
  leg: LegRun,
  control: string,
  on: boolean,
): Stepped<LegRun> {
  return leg.visit((kind, state) => {
    const known = kind.chapter.controls.find((name) => name === control);
    if (known === undefined)
      return refuse(`${kind.id} has no control called ${control}`);
    const changed = change(kind.chapter, state, known, on);
    return changed.ok
      ? { ok: true, state: legRun(kind, changed.state) }
      : changed;
  });
}

// One answer for each kind of level, picked by the level shown.
export type ByLeg<Result> = {
  readonly [Id in Leg["id"]]: (
    state: Extract<Leg, { readonly id: Id }>["state"],
  ) => Result;
};

export function onLeg<Result>(leg: Leg, by: ByLeg<Result>): Result {
  switch (leg.id) {
    case "castle":
      return by.castle(leg.state);
    case "hills":
      return by.hills(leg.state);
    case "woods":
      return by.woods(leg.state);
  }
}
