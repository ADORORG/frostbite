import { stepInt } from "@frostbite/game-sdk/seeded";

import { legalMoves } from "../../src/rules/moves.ts";
import { startRun, type MatchState } from "../../src/rules/state.ts";
import { swapOnce } from "../../src/rules/swap.ts";

// Three players, to measure the game with. The random player makes any swap that makes a line. The greedy player makes the swap that scores
// most at once. The planner looks one swap further: for the best few swaps by score, it adds the best score the board then allows.
export interface Move {
  readonly cell: number;
  readonly to: number;
}
export interface Result {
  readonly state: MatchState;
  readonly swaps: readonly Move[];
}

type Choose = (
  state: MatchState,
  pick: (below: number) => number,
) => Move | null;

const take = (state: MatchState, move: Move): MatchState | null => {
  const next = swapOnce(state, move.cell, move.to);
  return typeof next === "string" ? null : next;
};

export function play(seed: number, choose: Choose, limit = 4_900): Result {
  let state = startRun(seed);
  let rng = seed >>> 0 || 7;
  const pick = (below: number): number => {
    const stepped = stepInt(rng, below);
    rng = stepped.state;
    return stepped.value;
  };
  const swaps: Move[] = [];
  while (!state.ended && swaps.length < limit) {
    const move = choose(state, pick);
    if (move === null) break;
    const next = take(state, move);
    if (next === null) break;
    state = next;
    swaps.push(move);
  }
  return { state, swaps };
}

interface Option {
  readonly after: MatchState;
  readonly gain: number;
  readonly move: Move;
}

const gains = (state: MatchState): Option[] =>
  legalMoves(state.board).flatMap(([cell, to]) => {
    const after = take(state, { cell, to });
    return after === null
      ? []
      : [
          {
            after,
            gain:
              after.score -
              state.score +
              200 * (after.frostBroken - state.frostBroken),
            move: { cell, to },
          },
        ];
  });

export const randomPlayer: Choose = (state, pick) => {
  const moves = legalMoves(state.board);
  const chosen = moves[pick(moves.length)];
  return chosen === undefined ? null : { cell: chosen[0], to: chosen[1] };
};

export const greedyPlayer: Choose = (state) =>
  gains(state).sort((a, b) => b.gain - a.gain)[0]?.move ?? null;

export const plannerPlayer: Choose = (state) => {
  const best = gains(state)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 6);
  let chosen: Move | null = null;
  let top = -1;
  for (const { after, gain, move } of best) {
    const next = after.ended
      ? 0
      : Math.max(0, ...gains(after).map((g) => g.gain));
    if (gain + next > top) {
      top = gain + next;
      chosen = move;
    }
  }
  return chosen;
};
