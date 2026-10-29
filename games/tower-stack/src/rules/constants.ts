// Everything the rules measure, in whole numbers: a width and a place are in units (one to a pixel of the screen), a time is in ticks (the
// screen runs thirty a second, the rules know only ticks). Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "tower-stack";
export const verifierId = "tower-stack";
export const verifierVersion = 1;

// The longest a run may last (about eleven minutes), and so a bound on the work one replay does.
export const maxTicks = 20_000;
export const ticksPerSecond = 30;

// The block slides across a field this wide. The first block is `baseWidth` wide and starts in the middle; every block after it is as wide
// as the block under it, and is trimmed to what overlaps it when it is dropped.
export const fieldWidth = 120;
export const baseWidth = 48;

// A block dropped within this many units of the one under it is perfect: it snaps into place and loses nothing. It is wider than the
// step of the fastest block, so a perfect drop is always there to be met.
export const perfectTolerance = 3;
// After this many perfect drops in a row, every further perfect drop grows the block by `growBy` (up to the width it began with).
export const growStreak = 2;
export const growBy = 4;

// The block slides `startSpeed` units a tick and goes faster every `speedStepLevels` blocks, up to `topSpeed`.
export const startSpeed = 1;
export const speedStepLevels = 8;
export const topSpeed = 4;

// The marks that are earned by how a tower stands rather than how high it is (`milestones.ts` holds the heights and counts).
export const needleHeight = 15;
export const needleWidth = 4;
export const wideLoadHeight = 30;
export const wideLoadWidth = 30;
export const tidyHeight = 20;
export const tidyPerfects = 15;
export const marathonTicks = 5_400;
// A drop that only just catches the tower overlaps it by this much.
export const byHairOverlap = 1;
// A run of this many perfect drops is a streak of five.
export const fiveStreak = 5;
