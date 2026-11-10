import { type Lead } from "./leads.ts";
import type {
  Feats,
  Happening,
  HappeningKind,
  Player,
  RunState,
  Tally,
} from "./types.ts";

// One tick is worked out on a draft: a shallow copy of the state whose arrays are fresh and whose entries are replaced, never changed.
// The state it came from is left exactly as it was, so the rules stay a pure function of the state and the inputs.
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export type Draft = Mutable<
  Omit<
    RunState,
    | "items"
    | "crates"
    | "cages"
    | "snowballs"
    | "darts"
    | "bolts"
    | "tallies"
    | "happenings"
    | "player"
    | "feats"
  >
> & {
  items: RunState["items"][number][];
  crates: RunState["crates"][number][];
  cages: RunState["cages"][number][];
  snowballs: RunState["snowballs"][number][];
  darts: RunState["darts"][number][];
  bolts: RunState["bolts"][number][];
  tallies: Tally[];
  happenings: Happening[];
  player: Mutable<Player>;
  feats: Mutable<Feats>;
};

// The screen needs only the latest few happenings; older ones are dropped so a long run's state stays small.
const keepHappenings = 24;

export const openDraft = (state: RunState): Draft => ({
  ...state,
  bolts: [...state.bolts],
  cages: [...state.cages],
  crates: [...state.crates],
  darts: [...state.darts],
  feats: { ...state.feats },
  happenings: [...state.happenings],
  items: [...state.items],
  player: { ...state.player },
  snowballs: [...state.snowballs],
  tallies: [...state.tallies],
});

export const closeDraft = (draft: Draft): RunState => draft;

export const happen = (
  draft: Draft,
  kind: HappeningKind,
  x: number,
  y: number,
  detail = 0,
): void => {
  draft.happened += 1;
  draft.happenings.push({
    detail,
    kind,
    seq: draft.happened,
    tick: draft.tick,
    x,
    y,
  });
  if (draft.happenings.length > keepHappenings)
    draft.happenings.splice(0, draft.happenings.length - keepHappenings);
};

export const tallyOf = (draft: Draft): Tally => {
  const tally = draft.tallies[draft.round];
  if (tally === undefined)
    throw new RangeError(`no tally for round ${draft.round}`);
  return tally;
};

export const setTally = (draft: Draft, change: Partial<Tally>): void => {
  draft.tallies[draft.round] = { ...tallyOf(draft), ...change };
};

// A hit or a fall: the round's clock pays for it, unless the lead's lucky scarf takes it. Either way it counts as a hit.
export const penalize = (
  draft: Draft,
  lead: Lead,
  x: number,
  y: number,
): void => {
  const tally = tallyOf(draft);
  if (tally.freeHitsLeft > 0) {
    setTally(draft, {
      freeHitsLeft: tally.freeHitsLeft - 1,
      hits: tally.hits + 1,
    });
    happen(draft, "free-hit", x, y);
    return;
  }
  setTally(draft, { hits: tally.hits + 1 });
  draft.timeLeft = Math.max(0, draft.timeLeft - lead.hitPenalty);
  happen(draft, "hit", x, y, lead.hitPenalty);
};

export const nextId = (draft: Draft): number => {
  draft.nextId += 1;
  return draft.nextId;
};
