import { ballWidth } from "../../src/rules/constants.ts";
import { createRunSession, type RunSession } from "../../src/session.ts";

// A player that hops when the next rock is within `lead` units of the snowball, and otherwise rolls. A short lead hops late (the
// snowball is over the rock as it comes down), a long one early; some leads clear every rock, and a few of those only just.
export function playWithLead(
  seed: number,
  lead: number,
  onEarned?: (id: string) => void,
): RunSession {
  const session = createRunSession({ onEarned, seed });
  while (!session.state().ended) {
    const state = session.state();
    const rock = state.rocks[state.cleared];
    if (
      state.air === 0 &&
      rock !== undefined &&
      rock - (state.distance + ballWidth) <= lead
    )
      session.hop();
    session.tick();
  }
  return session;
}

export const leads: readonly number[] = Array.from(
  { length: 150 },
  (_, index) => index + 1,
);
