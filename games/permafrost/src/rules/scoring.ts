import {
  backToBackFactor,
  comboPoints,
  fourLines,
  lineScores,
  perfectClearPoints,
} from "./constants.ts";

export interface ClearInput {
  readonly backToBack: boolean;
  readonly cleared: number;
  readonly combo: number;
  readonly emptied: boolean;
  readonly level: number;
}

// What a clear of `cleared` rows is worth on a level: the rows, three halves of that for a four after a four, the combo, and the
// board left empty. Nothing cleared is worth nothing.
export function clearPoints(input: ClearInput): number {
  if (input.cleared === 0) return 0;
  const base = (lineScores[input.cleared] ?? 0) * input.level;
  const again = input.backToBack && input.cleared === fourLines;
  const lines = again
    ? Math.floor(
        (base * backToBackFactor.numerator) / backToBackFactor.denominator,
      )
    : base;
  const combo = input.combo >= 1 ? comboPoints * input.combo * input.level : 0;
  const empty = input.emptied ? perfectClearPoints * input.level : 0;
  return lines + combo + empty;
}
