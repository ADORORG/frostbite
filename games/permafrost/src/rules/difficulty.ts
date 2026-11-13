import { linesPerLevel } from "./constants.ts";

// The whole difficulty curve, as functions of the level. Level 1 is slow and forgiving; each ten lines the level rises, and with it the
// speed, and from level 11 the time to slide a piece at the last moment shrinks. Past level 12 the grey rows begin to rise from below.
// Nothing else in the rules makes the game harder, so `test/difficulty.unit.test.ts` can hold the curve to account.

// Ticks a piece takes to fall one row, by level (1 to 20); beyond 20 it is as fast as the rules go, a row a tick.
const ticksPerRow: readonly number[] = [
  40, 36, 32, 28, 24, 20, 16, 12, 9, 7, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1,
];
export const topLevelSpeed = 1;
export const levelOf = (lines: number): number =>
  1 + Math.floor(lines / linesPerLevel);

export const gravityFor = (level: number): number =>
  ticksPerRow[Math.min(level, ticksPerRow.length) - 1] ?? topLevelSpeed;

// How long a piece may rest on the stack before it sets, in ticks: half a second to begin with, and less from level 11.
const lockDelayStart = 30;
const lockDelayFloor = 12;
const lockDelayShrinksAfter = 10;
const lockDelayShrinkPerLevel = 2;
export const lockDelayFor = (level: number): number =>
  Math.max(
    lockDelayFloor,
    lockDelayStart -
      Math.max(0, level - lockDelayShrinksAfter) * lockDelayShrinkPerLevel,
  );

// How many pieces are shown ahead: three, then two from level 8, then one from level 12.
export const previewFor = (level: number): number =>
  level >= 12 ? 1 : level >= 8 ? 2 : 3;

// A grey row rises after this many pieces have been set, from level 12; fewer pieces as the level rises, never fewer than six. Null
// before level 12, when there are none.
const garbageFromLevel = 12;
const garbageStart = 18;
const garbageFloor = 6;
export const garbageEvery = (level: number): number | null =>
  level < garbageFromLevel
    ? null
    : Math.max(garbageFloor, garbageStart - level);

// The chance, in a hundred, that a grey row's gap is where the last one's was: so the gaps often line up and can be cleared together,
// but not always.
export const sameGapPercent = 70;
