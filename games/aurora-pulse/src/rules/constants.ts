// Everything the rules measure, in whole numbers. Time is in ticks, sixty a second (the screen's own rate, so a tick is a frame). Nothing here
// is a float, so every engine plays a run out the same way.
export const gameId = "aurora-pulse";
export const verifierId = "aurora-pulse";
export const verifierVersion = 1;

export const ticksPerSecond = 60;

// The music: a beat is 32 ticks (112.5 beats a minute), a bar four beats, and a note of the chart sits on one of the sixteen slots of a bar, 8
// ticks apart. The first bar begins `leadTicks` into the run, so the first notes can be seen coming. A stage is eight bars.
export const slotTicks = 8;
export const slotsPerBar = 16;
export const barTicks = slotTicks * slotsPerBar;
export const leadTicks = 96;
export const stageBars = 8;
export const stageTicks = stageBars * barTicks;

// The run ends at this tick if the player is still in it (about ten minutes), and a record holds at most `maxInputs` taps (the platform's
// ceiling is 5,000 inputs, and the last is the one that closes the run).
export const maxTicks = 36_000;
export const maxInputs = 4_900;

export const lanes = 4;

// A tap in a lane is judged against the nearest note of that lane, by how many ticks off it is: perfect, great or good within these. A note
// not tapped by `goodWindow` ticks after its tick is a miss. A tap with no note in reach is a stray.
export const perfectWindow = 2;
export const greatWindow = 5;
export const goodWindow = 9;

// The light of the aurora (the player's energy) starts at `startEnergy` and is at most `maxEnergy`; a run ends when it is gone.
export const startEnergy = 60;
export const maxEnergy = 100;
export const energyFor = {
  good: 0,
  great: 1,
  miss: -6,
  perfect: 2,
  stray: -3,
} as const;

// Points for a tap, times a multiplier of one more for each ten of the combo, to at most `maxMultiplier`.
export const pointsFor = { good: 100, great: 200, perfect: 300 } as const;
export const comboPerStep = 10;
export const maxMultiplier = 8;

// How far ahead, in ticks, the chart is made (the screen shows notes `lookahead` ticks before they are due).
export const makeAhead = 2 * barTicks;
export const lookahead = 96;
