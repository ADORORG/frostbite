import { stepInt } from "@frostbite/game-sdk/seeded";

import { pieceCount } from "./pieces.ts";

// The pieces come seven at a time, each once, in an order the seed decides, so no piece is ever more than twelve pieces away.
export function shuffledBag(rng: number): {
  readonly bag: readonly number[];
  readonly rng: number;
} {
  const bag = Array.from({ length: pieceCount }, (_, at) => at + 1);
  let state = rng;
  for (let at = bag.length - 1; at > 0; at -= 1) {
    const step = stepInt(state, at + 1);
    state = step.state;
    const swap = bag[step.value] ?? 0;
    bag[step.value] = bag[at] ?? 0;
    bag[at] = swap;
  }
  return { bag, rng: state };
}

// The queue, with seven pieces at least behind its first.
export function filled(
  queue: readonly number[],
  rng: number,
): { readonly queue: readonly number[]; readonly rng: number } {
  let held = queue;
  let state = rng;
  while (held.length <= pieceCount) {
    const next = shuffledBag(state);
    held = [...held, ...next.bag];
    state = next.rng;
  }
  return { queue: held, rng: state };
}
