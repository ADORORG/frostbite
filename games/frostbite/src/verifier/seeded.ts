// The one source of randomness the rules may use: a seeded generator that gives the same numbers on every engine. It is
// a 32-bit linear congruential generator (the family the game's boards have always used), so everything is whole-number
// arithmetic on 32 bits and nothing depends on floating point beyond a final division by a power of two.
const multiplier = 1_664_525;
const increment = 1_013_904_223;
const modulus = 4_294_967_296;

export function seeded(seed: number): () => number {
  // A zero seed would be a fixed point of the multiplication alone, so it starts from a constant instead.
  let state = seed >>> 0 || 3;
  return () => {
    state = (Math.imul(state, multiplier) + increment) >>> 0;
    return state / modulus;
  };
}

// `count` distinct cells out of `total`, chosen by a partial Fisher-Yates shuffle: it always takes exactly `count`
// draws, so it cannot loop on untrusted input (picking until enough are distinct could).
export function pickDistinct(
  seed: number,
  total: number,
  count: number,
): readonly number[] {
  const next = seeded(seed);
  const cells = Array.from({ length: total }, (_, index) => index);
  for (let index = 0; index < count; index += 1) {
    const other = index + Math.floor(next() * (total - index));
    const held = cells[index] ?? 0;
    cells[index] = cells[other] ?? 0;
    cells[other] = held;
  }
  return cells.slice(0, count).sort((left, right) => left - right);
}
