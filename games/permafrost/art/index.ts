import {
  chain,
  empty,
  fours,
  gems,
  hold,
  pair,
  rising,
  rows,
  stairs,
  watch,
} from "./glyphs.ts";
import { frame, type Tier } from "./svg.ts";

// Every milestone's drawing: how hard it is (the colour of its frame and how many dots it has) and the picture. The tiers come from what the
// players in `test/fairness.unit.test.ts` earn: a beginner gets the first, a steady player the second, a quick player a few of the
// third, and the last needs technique or the best play there is.
const table: Readonly<Record<string, readonly [Tier, string]>> = {
  "back-to-back": [3, pair(2)],
  "back-to-back-5": [4, pair(5)],
  "combo-10": [4, chain(5)],
  "combo-3": [1, chain(3)],
  "combo-6": [3, chain(4)],
  "first-four": [2, fours(1)],
  "first-hold": [1, hold()],
  "first-line": [1, rows(1)],
  "fours-20": [4, fours(5)],
  "fours-5": [3, fours(3)],
  "level-10": [2, stairs(3)],
  "level-15": [2, stairs(4)],
  "level-20": [4, stairs(5)],
  "level-3": [1, stairs(1)],
  "level-5": [2, stairs(2)],
  "lines-10": [1, rows(2)],
  "lines-100": [2, rows(5)],
  "lines-150": [3, rows(6)],
  "lines-200": [4, rows(7)],
  "lines-25": [1, rows(3)],
  "lines-50": [2, rows(4)],
  "perfect-clear": [4, empty()],
  "rising-10": [2, rising(3)],
  "rising-25": [4, rising(6)],
  "score-100k": [2, gems(5)],
  "score-1k": [1, gems(1)],
  "score-20k": [2, gems(3)],
  "score-250k": [4, gems(6)],
  "score-50k": [2, gems(4)],
  "score-5k": [1, gems(2)],
  "sprint-3min": [2, watch(0.75)],
  "sprint-90s": [2, watch(0.5)],
};

export const drawingIds: readonly string[] = Object.keys(table);

export function drawingOf(id: string): string | null {
  const entry = table[id];
  return entry === undefined ? null : frame(entry[0], entry[1]);
}
