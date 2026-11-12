// The roof's wave: how high its crown and its lip are along the house, and how high it is over any spot.
const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
// How high the roof's crown is along the house (x): a wave, easing down a little over each end wall.
export function crownAt(x: number): number {
  const wave =
    5.65 + 2 * smooth(2.5, 11.5, x) + Math.exp(-(((x + 8) / 4.5) ** 2));
  const past = Math.min(1, Math.max(0, Math.abs(x) - 11) / 1.7);
  return wave * (1 - 0.2 * past * past);
}
export const lipAt = (x: number): number => Math.max(0, crownAt(x) - 1.6);
export const ends = 12.7;
export const [front, back] = [-1.4, 15.4];
// How high the roof is over any spot of the house.
export function roofAt(x: number, z: number): number {
  const v = Math.max(0, Math.min(1, (z - front) / (back - front)));
  const lip = lipAt(x);
  return lip + (crownAt(x) - lip) * Math.sin(Math.PI * v) ** 0.5;
}
