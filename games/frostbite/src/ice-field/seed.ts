// A fresh 32-bit seed for a run, from the browser's own source of randomness. The seed is written into the run record,
// so the run can be replayed; the rules themselves never ask for randomness. (A seed the player's browser chooses and
// holds also tells that browser where the mines are: see docs/product/plan-g6b-ice-field-cabinet.md, decision 3.)
export function randomSeed(): number {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));
  return seed ?? 0;
}
