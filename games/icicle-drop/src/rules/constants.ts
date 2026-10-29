// Icicle Drop's measures. A tile is held as its level: level 1 is a 2, level 2 a 4, level n is 2 to the n. Nothing here is a float.
export const gameId = "icicle-drop";
export const verifierId = "icicle-drop";
export const verifierVersion = 1;

export const size = 4;
export const cells = size * size;

// The most moves a run may hold, which bounds the work of one replay and keeps a record inside the size the platform accepts (a move is
// a short input of its own, with no data).
export const maxMoves = 3_500;

// A new tile is a 2 nine times in ten, and a 4 otherwise.
export const lowTileChance = 9;
export const spawnRolls = 10;
export const startingTiles = 2;

export const directions = ["left", "right", "up", "down"] as const;
export type Direction = (typeof directions)[number];

export const tileValue = (level: number): number => 2 ** level;
