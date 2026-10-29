// The one source of randomness a game's rules may use: a seeded generator that gives the same numbers on every engine. It is a
// 32-bit linear congruential generator, so everything is whole-number arithmetic on 32 bits and nothing depends on floating point
// beyond a final division by a power of two. A rule that keeps its state in a plain value (a state machine has no closure to keep it
// in) steps it with `stepSeed`; a caller that wants a function uses `seeded`.
const multiplier = 1_664_525;
const increment = 1_013_904_223;
const modulus = 4_294_967_296;

// One step of the generator: the next state, and the number it gives in [0, 1).
export function stepSeed(state: number): {
  readonly state: number;
  readonly value: number;
} {
  const next = (Math.imul(state >>> 0, multiplier) + increment) >>> 0;
  return { state: next, value: next / modulus };
}

// A zero seed would be a fixed point of the multiplication alone, so it starts from a constant instead.
export const startState = (seed: number): number => seed >>> 0 || 3;

export function seeded(seed: number): () => number {
  let state = startState(seed);
  return () => {
    const step = stepSeed(state);
    state = step.state;
    return step.value;
  };
}

// A whole number in [0, below) from one step, with the state to continue from.
export function stepInt(
  state: number,
  below: number,
): { readonly state: number; readonly value: number } {
  const step = stepSeed(state);
  return { state: step.state, value: Math.floor(step.value * below) };
}
