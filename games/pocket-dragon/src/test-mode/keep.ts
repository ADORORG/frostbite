import type { Running } from "../rules/held.ts";
import {
  legKinds,
  legRun,
  legShown,
  type LegKind,
  type LegRun,
} from "../rules/quest/legs.ts";
import {
  countdownTicks,
  laserEvery,
  waveEvery,
} from "../rules/woods/constants.ts";
import { countdownLeft } from "../rules/woods/lair.ts";
import type { WoodsState } from "../rules/woods/types.ts";

// What test mode does to a run as it is played, so the admin can see every part of the game: a heart lost is given back at once (the
// hearts never go below the most the run has had), DeFu's rocket countdown never runs out (it winds back by whole rounds of her laser
// and shockwave, so her weapons keep their rhythm), and in the whole quest no level runs out of time. None of it is in the rules: a run
// played like this is never recorded, so it can never be sent, replayed or counted.
const gcd = (one: number, other: number): number =>
  other === 0 ? one : gcd(other, one % other);
const round = (laserEvery / gcd(laserEvery, waveEvery)) * waveEvery;
export const rewind = Math.floor((countdownTicks - 1) / round) * round;
// The countdown is wound back when this little of it is left.
export const lastTicks = 60;

export const keepHearts = <State extends { readonly hearts: number }>(
  state: State,
  most: number,
): State => (state.hearts >= most ? state : { ...state, hearts: most });

export function keepCountdown(state: WoodsState): WoodsState {
  const { base } = state;
  if (
    base === null ||
    base.lairStart < 0 ||
    state.tick < base.lairStart ||
    countdownLeft(base, state.tick) > lastTicks
  )
    return state;
  return { ...state, base: { ...base, lairStart: base.lairStart + rewind } };
}

// A level's kind with no end to its time, for the whole quest in test mode.
const endless = <Control extends string, State extends Running<Control>>(
  kind: LegKind<Control, State>,
): LegKind<Control, State> => ({
  ...kind,
  chapter: { ...kind.chapter, maxTicks: Number.MAX_SAFE_INTEGER },
});
const kinds = {
  castle: endless(legKinds.castle),
  hills: endless(legKinds.hills),
  woods: endless(legKinds.woods),
};

export function keepLeg(leg: LegRun, most: number): LegRun {
  const shown = legShown(leg);
  switch (shown.id) {
    case "castle":
      return legRun(kinds.castle, keepHearts(shown.state, most));
    case "hills":
      return legRun(kinds.hills, keepHearts(shown.state, most));
    case "woods":
      return legRun(kinds.woods, keepCountdown(keepHearts(shown.state, most)));
  }
}
