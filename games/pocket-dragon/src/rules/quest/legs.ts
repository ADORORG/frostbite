import { refuse } from "@frostbite/game-sdk/run-inputs";
import type { Stepped } from "@frostbite/game-sdk/run-record";

import { castleChapter } from "../castle/index.ts";
import { castleEarned } from "../castle/milestones.ts";
import { startCastle, tickCastle } from "../castle/tick.ts";
import type { CastleControl, CastleState } from "../castle/types.ts";
import type { ChapterId } from "../constants.ts";
import { change, type Chapter, type Running } from "../held.ts";
import { kitOf, noKit, type Kit } from "../kit.ts";
import { hillsChapter } from "../hills/index.ts";
import { hillsEarned } from "../hills/milestones.ts";
import { startHills } from "../hills/state.ts";
import { tickHills } from "../hills/tick.ts";
import type { HillsControl, HillsState } from "../hills/types.ts";
import { startWoods, woodsChapter, woodsDone } from "../woods/index.ts";
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
  // What it hands on to the next level: the backpack, and whether Glitchy is big.
  readonly kit: (state: State) => Kit;
  readonly shown: (state: State) => Leg;
  readonly start: (seed: number, hearts: number, kit: Kit) => State;
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
  kit: (state) => kitOf(state.powers),
  shown: (state) => ({ id: "hills", state }),
  start: (seed) => startHills(seed),
  tick: tickHills,
};

const castle: LegKind<CastleControl, CastleState> = {
  chapter: castleChapter,
  cleared: (state) => state.goldenEgg,
  earned: castleEarned,
  failed: (state) => state.hearts <= 0,
  hearts: (state) => state.hearts,
  heartsLost: (state) => state.heartsLost,
  id: "castle",
  kit: (state) => kitOf(state.powers),
  shown: (state) => ({ id: "castle", state }),
  start: startCastle,
  tick: tickCastle,
};

const woods: LegKind<WoodsControl, WoodsState> = {
  chapter: woodsChapter,
  cleared: (state) => woodsDone(state) && state.outcome === "defused",
  earned: woodsEarned,
  failed: (state) => woodsDone(state) && state.outcome !== "defused",
  hearts: (state) => state.hearts,
  heartsLost: (state) => state.heartsLost,
  id: "woods",
  kit: (state) => kitOf(state.powers),
  shown: (state) => ({ id: "woods", state }),
  start: startWoods,
  tick: tickWoods,
};

// The three kinds, by level.
export const legKinds = { castle, hills, woods } as const;

// A level of the quest begins with the hearts, and the backpack, the level before it ended with (Egg Hills, the first, with none).
export function startLeg(
  id: ChapterId,
  seed: number,
  hearts: number,
  kit: Kit = noKit,
): LegRun {
  switch (id) {
    case "castle":
      return legRun(castle, castle.start(seed, hearts, kit));
    case "hills":
      return legRun(hills, hills.start(seed, hearts, kit));
    case "woods":
      return legRun(woods, woods.start(seed, hearts, kit));
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
export const legKit = (leg: LegRun): Kit =>
  leg.visit((kind, state) => kind.kit(state));
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
