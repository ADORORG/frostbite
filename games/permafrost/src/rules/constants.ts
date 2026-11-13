// Everything the rules measure, in whole numbers: a place is a cell of the board, a time is in ticks (the screen runs sixty a second, the
// rules know only ticks). Nothing here is a float, so every engine plays a run out the same way. How hard the game gets is not here but in
// `difficulty.ts`, so the whole curve can be read, and tested, in one place.
export const gameId = "permafrost";
export const verifierId = "permafrost";
export const verifierVersion = 1;

export const ticksPerSecond = 60;
// The longest a run may last (twenty minutes), and so a bound on the work one replay does.
export const maxTicks = 72_000;

// The board is ten wide and twenty-two tall; the top two rows are above the screen, where a piece is born.
export const columns = 10;
export const rows = 22;
export const hiddenRows = 2;
// Where a piece is born: the left column of its box, and the row of its top.
export const spawnColumn = 3;
export const spawnRow = 1;

// A cell of the board holds nothing, one of the seven pieces (1 to 7), or the grey of a garbage row.
export const emptyCell = 0;
export const garbageCell = 8;

export const linesPerLevel = 10;
// A key held down falls this many ticks to a row at most.
export const softDropTicksPerRow = 2;
export const maxLockResets = 15;

// What the play is worth. A clear is worth `lineScores[lines]` times the level it was made on.
export const lineScores: readonly number[] = [0, 100, 300, 500, 800];
export const fourLines = 4;
export const comboPoints = 50;
export const perfectClearPoints = 2_000;
export const softDropPoints = 1;
export const hardDropPoints = 2;
// Four lines in a row of fours are worth three halves.
export const backToBackFactor = { denominator: 2, numerator: 3 } as const;

// The most that one `keys` input may hold, so no single input is a long job.
export const maxKeysPerInput = 256;
