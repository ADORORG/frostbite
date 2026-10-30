// Everything the rules measure, in whole numbers: a distance is in units (ten to a metre) and a time is in ticks (the screen runs
// thirty a second, the rules know only ticks). Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "snowball-dash";
export const verifierId = "snowball-dash";
export const verifierVersion = 1;

export const ticksPerSecond = 30;
export const unitsPerMetre = 10;

// The slope is 600 metres long; the run ends at its foot. At the slowest speed that takes 1,500 ticks, so `maxTicks` (the bound on
// the work one replay does) is never what ends a run.
export const courseUnits = 6_000;
export const maxTicks = 3_000;

// The snowball speeds up by one unit a tick for every `speedStepUnits` it rolls, up to the top speed.
export const baseSpeed = 4;
export const topSpeedBonus = 3;
export const speedStepUnits = 1_000;

// A hop is a parabola `hopPeak` high that lasts `hopTicks` ticks; the snowball is `ballWidth` wide and a rock is
// `rockWidth` by `rockHeight`. A rock is cleared by being over its top while the two overlap.
export const hopTicks = 22;
export const hopPeak = 24;
export const ballWidth = 6;
export const rockWidth = 8;
export const rockHeight = 10;
// Within this many units of a rock's top is a close call.
export const closeCallClearance = 2;

// Rocks are laid out from the seed: the first at `firstRockAt`, then a gap of `minGap` plus up to `gapVariety` more. The least gap
// leaves room to land and hop again at top speed (22 ticks at 7 units is 154 units).
export const firstRockAt = 400;
export const minGap = 220;
export const gapVariety = 200;
// No rock is laid within this many units of the finish.
export const finishClearance = 150;
