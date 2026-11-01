// Metaplasma: little bits of light, like pollen, laid out in every chapter. When Glitchy comes close they drift toward it and are
// gathered. What a run gathers is banked by the page, to be turned into items one day (it takes a great deal). The rules only count it,
// in whole numbers, in each chapter's own units: a mote within `reach` of Glitchy starts drifting, moves `speed` a tick on each axis,
// and is gathered once it is within `catchWithin`.
export interface Mote {
  readonly x: number;
  readonly y: number;
}

export interface Plasma {
  readonly drifting: readonly Mote[];
  readonly gathered: number;
  // Which of the level's motes have left their place, by their index in the level's list.
  readonly taken: readonly boolean[];
}

export interface Pull {
  readonly catchWithin: number;
  readonly reach: number;
  readonly speed: number;
}

export const freshPlasma = (motes: readonly Mote[]): Plasma => ({
  drifting: [],
  gathered: 0,
  taken: motes.map(() => false),
});

// The first mote at or to the right of `x`, in a list sorted by `x`.
function firstFrom(motes: readonly Mote[], x: number): number {
  let low = 0;
  let high = motes.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((motes[middle]?.x ?? x) < x) low = middle + 1;
    else high = middle;
  }
  return low;
}

const toward = (from: number, to: number, speed: number): number =>
  from + Math.max(-speed, Math.min(speed, to - from));

// One tick of the motes near Glitchy, whose middle is at (x, y). `motes` is sorted by `x`.
export function pullPlasma(
  plasma: Plasma,
  motes: readonly Mote[],
  x: number,
  y: number,
  pull: Pull,
): Plasma {
  const loose: Mote[] = [];
  const newly = new Set<number>();
  for (let at = firstFrom(motes, x - pull.reach); at < motes.length; at += 1) {
    const mote = motes[at];
    if (mote === undefined || mote.x > x + pull.reach) break;
    if (plasma.taken[at] === true || Math.abs(mote.y - y) > pull.reach)
      continue;
    newly.add(at);
    loose.push(mote);
  }
  if (loose.length === 0 && plasma.drifting.length === 0) return plasma;
  let gathered = plasma.gathered;
  const drifting: Mote[] = [];
  for (const mote of [...plasma.drifting, ...loose]) {
    const moved = {
      x: toward(mote.x, x, pull.speed),
      y: toward(mote.y, y, pull.speed),
    };
    if (
      Math.abs(moved.x - x) <= pull.catchWithin &&
      Math.abs(moved.y - y) <= pull.catchWithin
    )
      gathered += 1;
    else drifting.push(moved);
  }
  return {
    drifting,
    gathered,
    taken:
      newly.size === 0
        ? plasma.taken
        : plasma.taken.map((was, at) => was || newly.has(at)),
  };
}

// Sorted by `x`, then `y`, as `pullPlasma` needs them.
export const sortedMotes = (motes: readonly Mote[]): readonly Mote[] =>
  [...motes].sort((a, b) => a.x - b.x || a.y - b.y);
